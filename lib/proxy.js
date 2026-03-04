/**
 * Sanitizing HTTP proxy for Anthropic Messages API.
 *
 * Sits between Claude Code CLI and the upstream provider (OpenRouter, DeepSeek,
 * OpenAI, Gemini, etc.). Sanitizes Anthropic-internal types that non-Anthropic
 * providers can't handle. Supports streaming (SSE) with graceful disconnect
 * handling, and retries on transient errors.
 *
 * Zero dependencies — uses Node.js built-in http module and global fetch API.
 *
 * Usage:
 *   const { createProxy } = require('./proxy');
 *   const proxy = await createProxy({
 *     targetUrl: 'https://openrouter.ai/api',
 *     authHeader: 'Authorization',
 *     authValue: 'Bearer sk-or-...',
 *     port: 0,  // 0 = random available port
 *   });
 *   console.log(`Proxy on port ${proxy.port}`);
 *   // ... later ...
 *   await proxy.close();
 *
 * Resilience features:
 *   - Safe sanitization: errors fall back to original request (never crash)
 *   - Auto-retry on transient errors (429, 502, 503, 529) with exponential backoff
 *   - Streaming disconnect: graceful handling of client/server drops
 *   - Empty content protection: ensures messages have content after filtering
 *   - Request size limit: rejects payloads > 10MB to prevent OOM
 *   - Structured Anthropic error responses: always returns proper error format
 *   - Timeout: 10-minute total timeout on upstream requests via AbortController
 *
 * Ported from: ai-workers/core/openrouter_proxy.py (Python/aiohttp)
 */

const http = require("http");
const { sanitizeRequestBody } = require("./sanitize");

// ── Constants ────────────────────────────────────────────────────────────────

const MAX_REQUEST_SIZE = 10 * 1024 * 1024; // 10MB
const RETRY_STATUSES = new Set([429, 502, 503, 529]);
const MAX_RETRIES = 2;
const RETRY_DELAYS = [1.0, 3.0]; // seconds per retry attempt
const UPSTREAM_TIMEOUT = 600_000; // 10 minutes
const ALLOWED_PATH_PREFIXES = ["/v1/", "/api/v1/", "/api/"];

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Build an Anthropic-format error response body.
 * @param {number} status - HTTP status code
 * @param {string} errorType - Anthropic error type
 * @param {string} message - Human-readable message
 * @returns {string} JSON string
 */
function anthropicErrorBody(status, errorType, message) {
  return JSON.stringify({
    type: "error",
    error: { type: errorType, message },
  });
}

/**
 * Send an error response in Anthropic Messages API format.
 */
function sendError(res, status, errorType, message) {
  if (res.headersSent || res.destroyed) return;
  const body = anthropicErrorBody(status, errorType, message);
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

/**
 * Read the full request body with size limit.
 * @param {http.IncomingMessage} req
 * @param {number} maxSize
 * @returns {Promise<Buffer>}
 */
function readBody(req, maxSize) {
  return new Promise((resolve, reject) => {
    // Fast reject via Content-Length header
    const contentLength = parseInt(req.headers["content-length"] || "0", 10);
    if (contentLength > maxSize) {
      return reject(new Error(`Request too large: ${contentLength} bytes (max ${maxSize})`));
    }

    const chunks = [];
    let size = 0;

    req.on("data", (chunk) => {
      size += chunk.length;
      if (size > maxSize) {
        req.destroy();
        return reject(new Error(`Request too large: ${size} bytes (max ${maxSize})`));
      }
      chunks.push(chunk);
    });

    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

/**
 * Sleep for the given number of seconds.
 * @param {number} seconds
 * @returns {Promise<void>}
 */
function sleep(seconds) {
  return new Promise(resolve => setTimeout(resolve, seconds * 1000));
}

/**
 * Strip charset and other params from Content-Type.
 * Some upstream servers return "application/json; charset=utf-8" which
 * can cause issues in certain HTTP frameworks.
 *
 * @param {string} ct - Content-Type header value
 * @returns {string} Clean content type
 */
function stripContentType(ct) {
  return ct ? ct.split(";")[0].trim() : "application/json";
}

// ── Proxy Server ─────────────────────────────────────────────────────────────

class SanitizingProxy {
  /**
   * @param {object} opts
   * @param {string} opts.targetUrl - Upstream API base URL (e.g., https://openrouter.ai/api)
   * @param {string} [opts.authHeader="Authorization"] - Auth header name for upstream
   * @param {string} [opts.authValue=""] - Auth header value for upstream
   * @param {boolean} [opts.verbose=false] - Enable debug logging
   */
  constructor({ targetUrl, authHeader = "Authorization", authValue = "", verbose = false }) {
    this._targetUrl = targetUrl.replace(/\/+$/, "");
    this._authHeader = authHeader;
    this._authValue = authValue;
    this._verbose = verbose;
    this._server = null;
    this._requestCount = 0;
  }

  /**
   * Log a debug message (only if verbose).
   * @param {...any} args
   */
  _debug(...args) {
    if (this._verbose) console.error("[proxy]", ...args);
  }

  /**
   * Log a warning.
   * @param {...any} args
   */
  _warn(...args) {
    console.error("[proxy]", ...args);
  }

  /**
   * Build headers for the upstream request.
   * @param {object} incomingHeaders - Headers from the incoming request
   * @returns {object} Headers for the upstream fetch
   */
  _buildHeaders(incomingHeaders) {
    const headers = {
      "Content-Type": "application/json",
      "anthropic-version": incomingHeaders["anthropic-version"] || "2023-06-01",
      [this._authHeader]: this._authValue,
    };

    // Forward extra OpenRouter headers
    if (incomingHeaders["http-referer"]) headers["HTTP-Referer"] = incomingHeaders["http-referer"];
    if (incomingHeaders["x-title"]) headers["X-Title"] = incomingHeaders["x-title"];

    // Forward x-api-key if present and not already the auth header
    if (incomingHeaders["x-api-key"] && this._authHeader.toLowerCase() !== "x-api-key") {
      headers["x-api-key"] = incomingHeaders["x-api-key"];
    }

    return headers;
  }

  /**
   * Parse Retry-After delay from already-consumed response body text.
   * Checks HTTP Retry-After header first, then Anthropic JSON body retry_after.
   *
   * @param {Response} upstream - Fetch Response object (headers only)
   * @param {string} bodyText - Already-consumed response body text
   * @param {number} defaultDelay - Fallback delay in seconds
   * @returns {number} Delay in seconds
   */
  _parseRetryDelay(upstream, bodyText, defaultDelay) {
    // Check standard HTTP Retry-After header
    const retryAfter = upstream.headers.get("retry-after");
    if (retryAfter) {
      const parsed = parseFloat(retryAfter);
      if (!isNaN(parsed)) return Math.min(parsed, 30.0);
    }

    // Fallback: try Anthropic-style JSON body retry_after
    try {
      const json = JSON.parse(bodyText);
      const ra = json?.error?.retry_after;
      if (typeof ra === "number") return Math.min(ra, 30.0);
    } catch {
      // Not JSON or no retry_after
    }

    return defaultDelay;
  }

  /**
   * Handle POST /api/v1/messages — the Anthropic Messages API endpoint.
   *
   * Resilient pipeline:
   * 1. Read & validate request body (size limit)
   * 2. Sanitize (safe — falls back to original on error)
   * 3. Forward with retry on transient errors (429, 502, 503, 529)
   * 4. Stream with graceful disconnect handling
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  async _handleMessages(req, res) {
    this._requestCount++;
    const reqId = this._requestCount;

    // ── 1. Read request body with size limit ──
    let rawBody;
    try {
      rawBody = await readBody(req, MAX_REQUEST_SIZE);
    } catch (e) {
      return sendError(res, 413, "request_too_large", e.message);
    }

    // ── 2. Parse JSON ──
    let body;
    try {
      body = JSON.parse(rawBody.toString("utf8"));
    } catch (e) {
      return sendError(res, 400, "invalid_request_error", `Invalid JSON: ${e.message}`);
    }

    // ── 3. Sanitize (safe — returns original on failure) ──
    const sanitized = sanitizeRequestBody(body);
    const isStreaming = !!sanitized.stream;
    const model = sanitized.model || "?";
    const target = `${this._targetUrl}/v1/messages`;
    const headers = this._buildHeaders(req.headers);
    const bodyStr = JSON.stringify(sanitized);

    this._debug(`[#${reqId}] -> ${model} stream=${isStreaming}`);

    // ── 4. Forward with retry logic ──
    let lastError = null;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        // Abort controller for timeout + client disconnect
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);

        // Abort upstream if client disconnects early
        const onClose = () => controller.abort();
        req.on("close", onClose);

        let upstream;
        try {
          upstream = await fetch(target, {
            method: "POST",
            headers,
            body: bodyStr,
            signal: controller.signal,
          });
        } finally {
          clearTimeout(timeoutId);
          req.removeListener("close", onClose);
        }

        // ── Check retryable status (BEFORE committing response) ──
        if (RETRY_STATUSES.has(upstream.status)) {
          // Always consume body first to free the connection
          let bodyText = "";
          try { bodyText = await upstream.text(); } catch {}

          if (attempt < MAX_RETRIES) {
            const delay = this._parseRetryDelay(
              upstream, bodyText,
              RETRY_DELAYS[attempt] ?? 3.0
            );
            this._warn(`[#${reqId}] HTTP ${upstream.status}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}s`);
            await sleep(delay);
            continue;
          }

          // Last attempt still retryable — give up
          return sendError(res, 502, "api_error",
            `Upstream returned HTTP ${upstream.status} after ${MAX_RETRIES} retries`);
        }

        // ── Stream or non-stream response ──
        if (isStreaming) {
          await this._forwardStreaming(res, upstream, reqId);
        } else {
          await this._forwardNonStreaming(res, upstream, reqId);
        }
        return;

      } catch (e) {
        if (e.name === "AbortError") {
          lastError = new Error("Request to upstream timed out");
        } else {
          lastError = e;
        }

        if (attempt < MAX_RETRIES) {
          const delay = RETRY_DELAYS[attempt] ?? 3.0;
          this._warn(`[#${reqId}] ${lastError.message}, retry ${attempt + 1}/${MAX_RETRIES} in ${delay}s`);
          await sleep(delay);
          continue;
        }

        this._warn(`[#${reqId}] Failed after ${MAX_RETRIES} retries: ${lastError.message}`);
      }
    }

    // All retries exhausted
    sendError(res, 502, "api_error",
      `Proxy error after retries: ${lastError?.message || "Unknown error"}`);
  }

  /**
   * Forward a streaming response from upstream to client.
   *
   * Uses getReader() instead of `for await` for Node 18 compatibility
   * (ReadableStream async iteration requires Node 20+).
   *
   * @param {http.ServerResponse} res
   * @param {Response} upstream - Fetch Response
   * @param {number} reqId - Request ID for logging
   */
  async _forwardStreaming(res, upstream, reqId) {
    const ct = stripContentType(upstream.headers.get("content-type") || "text/event-stream");
    res.writeHead(upstream.status, {
      "Content-Type": ct,
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    });

    if (!upstream.body) {
      try { res.end(); } catch {}
      return;
    }

    const reader = upstream.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        if (res.destroyed) {
          this._debug(`[#${reqId}] Client disconnected during stream`);
          reader.cancel();
          break;
        }
        try {
          res.write(value);
        } catch (writeErr) {
          // Client disconnected mid-write
          this._debug(`[#${reqId}] Client write error: ${writeErr.message}`);
          reader.cancel();
          break;
        }
      }
    } catch (streamErr) {
      // Upstream dropped mid-stream — try to signal error in SSE format
      this._warn(`[#${reqId}] Upstream disconnected: ${streamErr.message}`);
      if (!res.destroyed) {
        try {
          const errEvent = `event: error\ndata: ${JSON.stringify({
            type: "error",
            error: { type: "api_error", message: `Upstream disconnected: ${streamErr.message}` },
          })}\n\n`;
          res.write(errEvent);
        } catch {
          // Best effort — client may already be gone
        }
      }
    }

    try { res.end(); } catch {}
    this._debug(`[#${reqId}] <- stream done (HTTP ${upstream.status})`);
  }

  /**
   * Forward a non-streaming response from upstream to client.
   * @param {http.ServerResponse} res
   * @param {Response} upstream - Fetch Response
   * @param {number} reqId - Request ID for logging
   */
  async _forwardNonStreaming(res, upstream, reqId) {
    const respBody = await upstream.text();
    const ct = stripContentType(upstream.headers.get("content-type") || "application/json");
    this._debug(`[#${reqId}] <- HTTP ${upstream.status} (${Buffer.byteLength(respBody)} bytes)`);

    res.writeHead(upstream.status, {
      "Content-Type": ct,
      "Content-Length": Buffer.byteLength(respBody),
    });
    res.end(respBody);
  }

  /**
   * Handle catchall requests (e.g., /v1/models, /v1/complete).
   * Forwards as-is without sanitization. Only allows safe path prefixes.
   *
   * @param {http.IncomingMessage} req
   * @param {http.ServerResponse} res
   */
  async _handleCatchall(req, res) {
    // Parse pathname (without query string) for security checks
    const fullUrl = req.url;
    let pathname;
    try {
      pathname = new URL(fullUrl, "http://localhost").pathname;
    } catch {
      pathname = fullUrl.split("?")[0];
    }

    // Security: reject path traversal
    if (pathname.includes("..")) {
      return sendError(res, 403, "forbidden", "Path traversal not allowed");
    }

    // Validate path prefix
    if (!ALLOWED_PATH_PREFIXES.some(p => pathname.startsWith(p))) {
      return sendError(res, 403, "forbidden", `Path not allowed: ${pathname}`);
    }

    // Forward full URL (with query string) to upstream
    const target = `${this._targetUrl}${fullUrl}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT);

    try {
      // Read body for non-GET methods
      let rawBody = null;
      if (req.method !== "GET" && req.method !== "HEAD") {
        rawBody = await readBody(req, MAX_REQUEST_SIZE);
      }

      // Whitelist headers to forward (security: don't leak cookies, etc.)
      const headers = {
        [this._authHeader]: this._authValue,
        "anthropic-version": req.headers["anthropic-version"] || "2023-06-01",
      };
      if (req.headers["content-type"]) headers["content-type"] = req.headers["content-type"];
      if (req.headers["accept"]) headers["accept"] = req.headers["accept"];
      if (req.headers["http-referer"]) headers["HTTP-Referer"] = req.headers["http-referer"];
      if (req.headers["x-title"]) headers["X-Title"] = req.headers["x-title"];

      const upstream = await fetch(target, {
        method: req.method,
        headers,
        body: rawBody,
        signal: controller.signal,
      });

      const respBody = Buffer.from(await upstream.arrayBuffer());
      const ct = stripContentType(upstream.headers.get("content-type") || "application/json");

      res.writeHead(upstream.status, {
        "Content-Type": ct,
        "Content-Length": respBody.length,
      });
      res.end(respBody);
    } catch (e) {
      if (e.name === "AbortError") {
        sendError(res, 504, "timeout", "Upstream request timed out");
      } else {
        this._warn(`Catchall proxy error for ${pathname}: ${e.message}`);
        sendError(res, 502, "api_error", `Proxy error: ${e.message}`);
      }
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Start the proxy server.
   *
   * @param {number} [port=0] - Port to listen on (0 = random available port)
   * @param {string} [host="127.0.0.1"] - Host to bind to
   * @returns {Promise<{port: number, host: string, close: function}>}
   */
  start(port = 0, host = "127.0.0.1") {
    return new Promise((resolve, reject) => {
      this._server = http.createServer(async (req, res) => {
        try {
          // Route: POST /api/v1/messages or /v1/messages → sanitize + forward
          // Use pathname (strip query string) for robust matching
          const urlPath = req.url.split("?")[0];
          if (req.method === "POST" && (
            urlPath === "/api/v1/messages" ||
            urlPath === "/v1/messages"
          )) {
            await this._handleMessages(req, res);
          } else {
            await this._handleCatchall(req, res);
          }
        } catch (e) {
          this._warn(`Unhandled proxy error: ${e.message}`);
          if (!res.headersSent && !res.destroyed) {
            sendError(res, 500, "api_error", `Internal proxy error: ${e.message}`);
          }
        }
      });

      this._server.on("error", reject);

      this._server.listen(port, host, () => {
        const addr = this._server.address();
        resolve({
          port: addr.port,
          host: addr.address,
          url: `http://${addr.address}:${addr.port}`,
          close: () => this.stop(),
        });
      });
    });
  }

  /**
   * Stop the proxy server gracefully.
   * @returns {Promise<void>}
   */
  stop() {
    return new Promise((resolve) => {
      if (!this._server) return resolve();
      // Force resolve after 5s if connections linger
      const timer = setTimeout(resolve, 5000);
      this._server.close(() => {
        clearTimeout(timer);
        resolve();
      });
    });
  }
}

/**
 * Create and start a sanitizing proxy server.
 *
 * @param {object} opts
 * @param {string} opts.targetUrl - Upstream API base URL
 * @param {string} [opts.authHeader="Authorization"] - Auth header name for upstream
 * @param {string} [opts.authValue=""] - Auth header value for upstream
 * @param {number} [opts.port=0] - Port to listen on (0 = random)
 * @param {string} [opts.host="127.0.0.1"] - Host to bind to
 * @param {boolean} [opts.verbose=false] - Enable debug logging
 * @returns {Promise<{port: number, host: string, url: string, close: function}>}
 */
async function createProxy(opts) {
  const proxy = new SanitizingProxy(opts);
  return proxy.start(opts.port, opts.host);
}

module.exports = { SanitizingProxy, createProxy, sendError, anthropicErrorBody };
