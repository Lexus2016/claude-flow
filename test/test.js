/**
 * Tests for claude-flow (no test framework needed).
 */

const { buildEnv, toShellExports, mergeEnv } = require("../lib/env");
const { getProvider, listProviders, getAuthConfig } = require("../lib/providers");
const {
  sanitizeRequestBody,
  sanitizeContent,
  sanitizeContentBlock,
  sanitizeSystem,
  sanitizeTools,
  sanitizeMessages,
  cleanToolSchema,
  stripCacheControl,
  isGeminiThinkingModel,
  REMOVE_CONTENT_TYPES,
} = require("../lib/sanitize");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  \u2705 ${message}`);
  } else {
    failed++;
    console.error(`  \u274C ${message}`);
  }
}

function assertDeepEqual(actual, expected, message) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
    console.log(`  \u2705 ${message}`);
  } else {
    failed++;
    console.error(`  \u274C ${message}`);
    console.error(`       Expected: ${e}`);
    console.error(`       Actual:   ${a}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// Provider tests
// ═══════════════════════════════════════════════════════════════════

console.log("\nProviders:");

assert(getProvider("openrouter") !== null, "getProvider('openrouter') returns config");
assert(getProvider("or") !== null, "alias 'or' resolves to openrouter");
assert(getProvider("deepseek") !== null, "getProvider('deepseek') returns config");
assert(getProvider("nonexistent") === null, "unknown provider returns null");
assert(listProviders().includes("openrouter"), "listProviders includes openrouter");
assert(!listProviders().includes("or"), "listProviders excludes aliases");

// ═══════════════════════════════════════════════════════════════════
// Auth config tests
// ═══════════════════════════════════════════════════════════════════

console.log("\ngetAuthConfig:");

const orAuth = getAuthConfig("openrouter", "sk-or-test-123");
assert(orAuth.authHeader === "Authorization", "OpenRouter: uses Authorization header");
assert(orAuth.authValue === "Bearer sk-or-test-123", "OpenRouter: Bearer token format");

const dsAuth = getAuthConfig("deepseek", "sk-test-456");
assert(dsAuth.authHeader === "x-api-key", "DeepSeek: uses x-api-key header");
assert(dsAuth.authValue === "sk-test-456", "DeepSeek: raw key value");

const oaiAuth = getAuthConfig("openai", "sk-proj-abc");
assert(oaiAuth.authHeader === "x-api-key", "OpenAI: uses x-api-key header");

try {
  getAuthConfig("nonexistent", "key");
  assert(false, "Should throw for unknown provider");
} catch (e) {
  assert(e.message.includes("Unknown provider"), "Throws for unknown provider auth config");
}

// ═══════════════════════════════════════════════════════════════════
// buildEnv tests
// ═══════════════════════════════════════════════════════════════════

console.log("\nbuildEnv:");

// OpenRouter (auth_token provider)
const orEnv = buildEnv("openrouter", { apiKey: "sk-or-test-123" });
assert(orEnv.ANTHROPIC_AUTH_TOKEN === "sk-or-test-123", "OpenRouter: sets AUTH_TOKEN");
assert(orEnv.ANTHROPIC_API_KEY === "", "OpenRouter: API_KEY is empty string");
assert(orEnv.ANTHROPIC_API_KEY !== undefined, "OpenRouter: API_KEY is NOT undefined");
assert(orEnv.ANTHROPIC_BASE_URL === "https://openrouter.ai/api", "OpenRouter: correct base URL");
assert(orEnv.ANTHROPIC_DEFAULT_SONNET_MODEL !== undefined, "OpenRouter: sets sonnet model");

// DeepSeek (api_key provider)
const dsEnv = buildEnv("deepseek", { apiKey: "sk-test-456" });
assert(dsEnv.ANTHROPIC_API_KEY === "sk-test-456", "DeepSeek: sets API_KEY");
assert(dsEnv.ANTHROPIC_AUTH_TOKEN === undefined, "DeepSeek: no AUTH_TOKEN");
assert(dsEnv.ANTHROPIC_BASE_URL === "https://api.deepseek.com/anthropic", "DeepSeek: correct base URL");

// Custom models
const customEnv = buildEnv("openrouter", {
  apiKey: "sk-or-test-789",
  haiku: "google/gemini-2.5-flash",
  sonnet: "google/gemini-2.5-pro",
  opus: "openai/gpt-4.1",
});
assert(customEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL === "google/gemini-2.5-flash", "Custom haiku model");
assert(customEnv.ANTHROPIC_DEFAULT_SONNET_MODEL === "google/gemini-2.5-pro", "Custom sonnet model");
assert(customEnv.ANTHROPIC_DEFAULT_OPUS_MODEL === "openai/gpt-4.1", "Custom opus model");

// Single model override
const singleEnv = buildEnv("openrouter", {
  apiKey: "sk-or-test",
  model: "deepseek/deepseek-chat",
});
assert(singleEnv.ANTHROPIC_DEFAULT_HAIKU_MODEL === "deepseek/deepseek-chat", "Single model: all tiers use it");
assert(singleEnv.ANTHROPIC_DEFAULT_SONNET_MODEL === "deepseek/deepseek-chat", "Single model: sonnet");
assert(singleEnv.ANTHROPIC_DEFAULT_OPUS_MODEL === "deepseek/deepseek-chat", "Single model: opus");

// Error cases
console.log("\nError handling:");

try {
  buildEnv("nonexistent", { apiKey: "test" });
  assert(false, "Should throw for unknown provider");
} catch (e) {
  assert(e.message.includes("Unknown provider"), "Throws for unknown provider");
}

try {
  buildEnv("openrouter", {});
  assert(false, "Should throw for missing key");
} catch (e) {
  assert(e.message.includes("No API key"), "Throws for missing API key");
}

// ═══════════════════════════════════════════════════════════════════
// toShellExports tests
// ═══════════════════════════════════════════════════════════════════

console.log("\ntoShellExports:");

const shellOutput = toShellExports(orEnv);
assert(shellOutput.includes("export ANTHROPIC_AUTH_TOKEN="), "Shell: includes AUTH_TOKEN export");
assert(shellOutput.includes("export ANTHROPIC_API_KEY=''"), "Shell: API_KEY is empty string in quotes");
assert(shellOutput.includes("export ANTHROPIC_BASE_URL="), "Shell: includes BASE_URL");

// ═══════════════════════════════════════════════════════════════════
// The Critical Test
// ═══════════════════════════════════════════════════════════════════

console.log("\nCritical behavior (the whole reason this package exists):");

const env = buildEnv("openrouter", { apiKey: "sk-or-v1-real-key" });
assert("ANTHROPIC_API_KEY" in env, "API_KEY key EXISTS in env object");
assert(env.ANTHROPIC_API_KEY === "", "API_KEY value is empty string ''");
assert(env.ANTHROPIC_API_KEY !== null, "API_KEY is NOT null");
assert(env.ANTHROPIC_API_KEY !== undefined, "API_KEY is NOT undefined");
assert(typeof env.ANTHROPIC_API_KEY === "string", "API_KEY is a string");
assert(env.ANTHROPIC_API_KEY.length === 0, "API_KEY length is 0");

// ═══════════════════════════════════════════════════════════════════
// Sanitization tests
// ═══════════════════════════════════════════════════════════════════

console.log("\nSanitization — content blocks:");

// Thinking blocks removed
const thinkingResult = sanitizeContent([
  { type: "thinking", thinking: "let me think..." },
  { type: "text", text: "Hello" },
]);
assert(thinkingResult.length === 1, "Thinking block removed");
assert(thinkingResult[0].text === "Hello", "Text block preserved after thinking removal");

// Redacted thinking removed
const redactedResult = sanitizeContent([
  { type: "redacted_thinking", data: "..." },
  { type: "text", text: "response" },
]);
assert(redactedResult.length === 1, "Redacted thinking removed");

// server_tool_use removed
const stuResult = sanitizeContent([
  { type: "server_tool_use", id: "1", name: "web" },
  { type: "text", text: "done" },
]);
assert(stuResult.length === 1, "server_tool_use removed");

// web_search_tool_result removed
const wsResult = sanitizeContent([
  { type: "web_search_tool_result", search_results: [] },
  { type: "text", text: "found it" },
]);
assert(wsResult.length === 1, "web_search_tool_result removed");

// tool_reference converted to text
const refResult = sanitizeContent([
  { type: "tool_reference", tool_name: "bash" },
]);
assert(refResult.length === 1, "tool_reference produces one block");
assert(refResult[0].type === "text", "tool_reference converted to text type");
assert(refResult[0].text === "[Tool loaded: bash]", "tool_reference text content correct");

// tool_reference without name
const refNoName = sanitizeContentBlock({ type: "tool_reference" });
assert(refNoName.text === "[Tool loaded: unknown]", "tool_reference without name uses 'unknown'");

// cache_control stripped from content blocks
const ccBlock = sanitizeContentBlock({
  type: "text",
  text: "hello",
  cache_control: { type: "ephemeral" },
});
assert(!("cache_control" in ccBlock), "cache_control stripped from text block");
assert(ccBlock.text === "hello", "text preserved after cache_control strip");

// Empty content after filtering gets placeholder
const emptyResult = sanitizeContent([
  { type: "thinking", thinking: "..." },
  { type: "redacted_thinking", data: "..." },
]);
assert(emptyResult.length === 1, "Empty filtered content gets placeholder");
assert(emptyResult[0].text === "(continued)", "Placeholder text is (continued)");

// String content passes through unchanged
assert(sanitizeContent("hello world") === "hello world", "String content passes through");

// Non-array, non-string passes through
assert(sanitizeContent(42) === 42, "Non-string/array content passes through");

// Nested tool_result content sanitized
const toolResult = sanitizeContentBlock({
  type: "tool_result",
  tool_use_id: "1",
  content: [
    { type: "thinking", thinking: "..." },
    { type: "text", text: "result" },
  ],
});
assert(toolResult.content.length === 1, "Nested thinking in tool_result removed");
assert(toolResult.content[0].text === "result", "Nested text in tool_result preserved");

// tool_result cache_control stripped
const toolResultCC = sanitizeContentBlock({
  type: "tool_result",
  tool_use_id: "1",
  cache_control: { type: "ephemeral" },
  content: "ok",
});
assert(!("cache_control" in toolResultCC), "cache_control stripped from tool_result");

console.log("\nSanitization — system prompt:");

// String system passes through
assert(sanitizeSystem("You are helpful") === "You are helpful", "String system passes through");

// null/undefined passes through
assert(sanitizeSystem(null) === null, "null system passes through");
assert(sanitizeSystem(undefined) === undefined, "undefined system passes through");

// Array with single text block simplified to string
const singleSys = sanitizeSystem([
  { type: "text", text: "Be helpful", cache_control: { type: "ephemeral" } },
]);
assert(singleSys === "Be helpful", "Single text block simplified to string");

// Array with multiple text blocks kept as array
const multiSys = sanitizeSystem([
  { type: "text", text: "Part 1" },
  { type: "text", text: "Part 2" },
]);
assert(Array.isArray(multiSys), "Multiple text blocks stay as array");
assert(multiSys.length === 2, "Both text blocks preserved");
assert(!("cache_control" in multiSys[0]), "cache_control stripped from system blocks");

// Non-text types filtered out
const filteredSys = sanitizeSystem([
  { type: "text", text: "Keep me" },
  { type: "citation", data: "..." },
]);
assert(filteredSys === "Keep me", "Non-text types filtered, single text simplified");

// All non-text returns null
const allNonText = sanitizeSystem([
  { type: "citation", data: "..." },
]);
assert(allNonText === null, "All non-text system items returns null");

console.log("\nSanitization — tool schemas:");

// $schema removed
const schema1 = cleanToolSchema({ $schema: "http://json-schema.org/draft-07", type: "object" });
assert(!("$schema" in schema1), "$schema removed from root");
assert(schema1.type === "object", "type preserved after $schema removal");

// Nested properties cleaned
const schema2 = cleanToolSchema({
  type: "object",
  properties: {
    name: { $schema: "...", type: "string" },
    nested: {
      type: "object",
      properties: {
        deep: { $schema: "...", type: "number" },
      },
    },
  },
});
assert(!("$schema" in schema2.properties.name), "$schema removed from nested property");
assert(!("$schema" in schema2.properties.nested.properties.deep), "$schema removed from deep nested");

// items cleaned
const schema3 = cleanToolSchema({
  type: "array",
  items: { $schema: "...", type: "string" },
});
assert(!("$schema" in schema3.items), "$schema removed from items");

// anyOf cleaned
const schema4 = cleanToolSchema({
  anyOf: [
    { $schema: "...", type: "string" },
    { $schema: "...", type: "number" },
  ],
});
assert(!("$schema" in schema4.anyOf[0]), "$schema removed from anyOf[0]");
assert(!("$schema" in schema4.anyOf[1]), "$schema removed from anyOf[1]");

// Depth limit prevents infinite recursion
let deepSchema = { $schema: "...", type: "object" };
for (let i = 0; i < 25; i++) {
  deepSchema = { type: "object", properties: { a: deepSchema } };
}
// Should not throw
cleanToolSchema(deepSchema);
assert(true, "Deep schema (25 levels) handled without stack overflow");

console.log("\nSanitization — tools:");

// cache_control stripped from tools
const tools = sanitizeTools([
  {
    name: "bash",
    cache_control: { type: "ephemeral" },
    input_schema: { $schema: "...", type: "object", properties: { cmd: { type: "string" } } },
  },
]);
assert(!("cache_control" in tools[0]), "cache_control stripped from tool");
assert(!("$schema" in tools[0].input_schema), "$schema removed from tool input_schema");
assert(tools[0].name === "bash", "tool name preserved");

// Non-object tools pass through
const mixedTools = sanitizeTools(["not-an-object", { name: "test" }]);
assert(mixedTools[0] === "not-an-object", "Non-object tool passes through");

console.log("\nSanitization — messages:");

// cache_control stripped from messages
const msgs = sanitizeMessages([
  {
    role: "user",
    cache_control: { type: "ephemeral" },
    content: [
      { type: "text", text: "Hi", cache_control: { type: "ephemeral" } },
    ],
  },
]);
assert(!("cache_control" in msgs[0]), "cache_control stripped from message");
assert(!("cache_control" in msgs[0].content[0]), "cache_control stripped from message content block");

// Thinking removed from messages
const msgsThinking = sanitizeMessages([
  {
    role: "assistant",
    content: [
      { type: "thinking", thinking: "..." },
      { type: "text", text: "response" },
    ],
  },
]);
assert(msgsThinking[0].content.length === 1, "Thinking removed from message content");

console.log("\nSanitization — full request body:");

// Full sanitizeRequestBody
const fullBody = sanitizeRequestBody({
  model: "claude-sonnet-4-20250514",
  messages: [
    {
      role: "user",
      content: "Hello",
      cache_control: { type: "ephemeral" },
    },
    {
      role: "assistant",
      content: [
        { type: "thinking", thinking: "hmm" },
        { type: "text", text: "Hi!" },
      ],
    },
  ],
  system: [
    { type: "text", text: "Be helpful", cache_control: { type: "ephemeral" } },
  ],
  thinking: { type: "enabled", budget_tokens: 10000 },
  tools: [
    {
      name: "bash",
      cache_control: { type: "ephemeral" },
      input_schema: { $schema: "...", type: "object" },
    },
  ],
  tool_choice: { type: "auto", cache_control: { type: "ephemeral" } },
  stream: true,
});

assert(fullBody.model === "claude-sonnet-4-20250514", "Full: model preserved");
assert(!("thinking" in fullBody), "Full: thinking parameter removed");
assert(!("cache_control" in fullBody.messages[0]), "Full: message cache_control stripped");
assert(fullBody.messages[1].content.length === 1, "Full: thinking block removed from assistant");
assert(fullBody.messages[1].content[0].text === "Hi!", "Full: text preserved");
assert(fullBody.system === "Be helpful", "Full: system simplified to string");
assert(!("cache_control" in fullBody.tools[0]), "Full: tool cache_control stripped");
assert(!("$schema" in fullBody.tools[0].input_schema), "Full: tool $schema removed");
assert(!("cache_control" in fullBody.tool_choice), "Full: tool_choice cache_control stripped");
assert(fullBody.stream === true, "Full: stream flag preserved");

// Original body not mutated
const originalBody = {
  messages: [{ role: "user", content: [{ type: "thinking", thinking: "..." }] }],
  thinking: { type: "enabled" },
};
const originalStr = JSON.stringify(originalBody);
sanitizeRequestBody(originalBody);
assert(JSON.stringify(originalBody) === originalStr, "Original body not mutated");

// Sanitization failure falls back to original
const weirdBody = { messages: "not an array" };
const fallback = sanitizeRequestBody(weirdBody);
assert(fallback.messages === "not an array", "Malformed body returned as-is on failure");

console.log("\nSanitization — max_tokens clamping:");

// Clamped when over provider limit
const clampedBody = sanitizeRequestBody(
  { model: "deepseek-chat", messages: [{ role: "user", content: "hi" }], max_tokens: 16384 },
  { maxOutputTokens: 8192 }
);
assert(clampedBody.max_tokens === 8192, "max_tokens clamped to provider limit");

// Not clamped when under limit
const underBody = sanitizeRequestBody(
  { model: "deepseek-chat", messages: [{ role: "user", content: "hi" }], max_tokens: 4096 },
  { maxOutputTokens: 8192 }
);
assert(underBody.max_tokens === 4096, "max_tokens preserved when under limit");

// No opts — no clamping
const noOptsBody = sanitizeRequestBody(
  { model: "test", messages: [{ role: "user", content: "hi" }], max_tokens: 99999 }
);
assert(noOptsBody.max_tokens === 99999, "max_tokens unchanged without opts");

// maxOutputTokens = 0 — no clamping
const zeroCapBody = sanitizeRequestBody(
  { model: "test", messages: [{ role: "user", content: "hi" }], max_tokens: 16384 },
  { maxOutputTokens: 0 }
);
assert(zeroCapBody.max_tokens === 16384, "max_tokens unchanged with maxOutputTokens=0");

console.log("\nSanitization — Gemini thinking fix:");

// isGeminiThinkingModel
assert(isGeminiThinkingModel("google/gemini-2.5-flash") === true, "gemini-2.5-flash is a thinking model");
assert(isGeminiThinkingModel("google/gemini-2.5-pro") === true, "gemini-2.5-pro is a thinking model");
assert(isGeminiThinkingModel("google/gemini-2.5-flash:free") === true, "gemini-2.5-flash:free detected (suffix stripped)");
assert(isGeminiThinkingModel("google/gemini-3-flash-preview") === true, "gemini-3 future-proofed");
assert(isGeminiThinkingModel("google/gemini-2.5-flash-lite") === false, "gemini-2.5-flash-lite excluded (thinking off by default)");
assert(isGeminiThinkingModel("anthropic/claude-sonnet-4-6") === false, "Claude is not a Gemini thinking model");
assert(isGeminiThinkingModel("google/gemini-2.0-flash") === false, "gemini-2.0 is not a thinking model");
assert(isGeminiThinkingModel("") === false, "empty string returns false");
assert(isGeminiThinkingModel(null) === false, "null returns false");

// reasoning.effort injected for Gemini
const geminiBody = sanitizeRequestBody({
  model: "google/gemini-2.5-flash",
  messages: [{ role: "user", content: "Hi" }],
  thinking: { type: "enabled", budget_tokens: 10000 },
});
assert(!("thinking" in geminiBody), "Gemini: thinking parameter removed");
assert(geminiBody.reasoning != null, "Gemini: reasoning parameter injected");
assertDeepEqual(geminiBody.reasoning, { effort: "none" }, "Gemini: reasoning.effort is 'none'");

// reasoning NOT injected for non-Gemini models
const claudeBody = sanitizeRequestBody({
  model: "anthropic/claude-sonnet-4-6",
  messages: [{ role: "user", content: "Hi" }],
});
assert(!("reasoning" in claudeBody), "Claude: no reasoning parameter injected");

// reasoning_content content type removed
const reasoningContentResult = sanitizeContent([
  { type: "reasoning_content", data: "internal reasoning..." },
  { type: "text", text: "actual response" },
]);
assert(reasoningContentResult.length === 1, "reasoning_content block removed");
assert(reasoningContentResult[0].text === "actual response", "text preserved after reasoning_content removal");

console.log("\nSanitization — stripCacheControl:");

const stripped = stripCacheControl({ text: "hi", cache_control: { type: "ephemeral" } });
assert(!("cache_control" in stripped), "stripCacheControl removes field");
assert(stripped.text === "hi", "stripCacheControl preserves other fields");
assert(stripCacheControl(null) === null, "stripCacheControl handles null");
assert(stripCacheControl({ text: "hi" }).text === "hi", "stripCacheControl no-op when no cache_control");

// ═══════════════════════════════════════════════════════════════════
// Proxy integration tests
// ═══════════════════════════════════════════════════════════════════

async function runProxyTests() {
  const http = require("http");
  const { createProxy } = require("../lib/proxy");

  console.log("\nProxy — integration tests:");

  // Helper: make HTTP request to proxy
  function request(port, opts = {}) {
    return new Promise((resolve, reject) => {
      const body = opts.body ? JSON.stringify(opts.body) : null;
      const req = http.request({
        hostname: "127.0.0.1",
        port,
        path: opts.path || "/api/v1/messages",
        method: opts.method || "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          ...opts.headers,
        },
      }, (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const data = Buffer.concat(chunks).toString("utf8");
          resolve({ status: res.statusCode, headers: res.headers, body: data });
        });
      });
      req.on("error", reject);
      if (body) req.write(body);
      req.end();
    });
  }

  // ── Test 1: Proxy sanitizes and forwards ──
  let upstreamReceived = null;
  const mock = http.createServer((req, res) => {
    const chunks = [];
    req.on("data", (c) => chunks.push(c));
    req.on("end", () => {
      const raw = Buffer.concat(chunks).toString("utf8");
      upstreamReceived = {
        path: req.url,
        method: req.method,
        headers: req.headers,
        body: raw ? JSON.parse(raw) : null,
      };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({
        id: "msg_test",
        type: "message",
        content: [{ type: "text", text: "Hello!" }],
      }));
    });
  });

  await new Promise((resolve) => mock.listen(0, "127.0.0.1", resolve));
  const mockPort = mock.address().port;

  const proxy = await createProxy({
    targetUrl: `http://127.0.0.1:${mockPort}`,
    authHeader: "Authorization",
    authValue: "Bearer test-key-12345",
  });

  // Test: sanitization works through proxy
  const resp1 = await request(proxy.port, {
    body: {
      model: "test-model",
      messages: [
        {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "internal thought" },
            { type: "text", text: "Hello" },
          ],
        },
      ],
      thinking: { type: "enabled", budget_tokens: 5000 },
    },
  });

  assert(resp1.status === 200, "Proxy: returns 200 on success");
  assert(upstreamReceived !== null, "Proxy: request forwarded to upstream");
  assert(upstreamReceived.body.messages[0].content.length === 1, "Proxy: thinking block removed");
  assert(upstreamReceived.body.messages[0].content[0].text === "Hello", "Proxy: text preserved");
  assert(!("thinking" in upstreamReceived.body), "Proxy: thinking param removed from body");

  // Test: auth header replaced
  assert(upstreamReceived.headers["authorization"] === "Bearer test-key-12345", "Proxy: auth header set to proxy value");

  // Test: messages endpoint with query string still routes to sanitizer
  upstreamReceived = null;
  const respQS = await request(proxy.port, {
    path: "/v1/messages?beta=true",
    method: "POST",
    body: {
      model: "test",
      messages: [{ role: "user", content: "hi" }],
    },
  });
  assert(respQS.status === 200, "Proxy: /v1/messages?query routes to messages handler");
  assert(upstreamReceived !== null, "Proxy: query string request forwarded to upstream");

  // Test: path validation
  const resp2 = await request(proxy.port, {
    path: "/secret/path",
    method: "GET",
  });
  assert(resp2.status === 403, "Proxy: rejects forbidden paths");

  // Test: path traversal blocked
  const resp3 = await request(proxy.port, {
    path: "/api/v1/../../../etc/passwd",
    method: "GET",
  });
  assert(resp3.status === 403, "Proxy: blocks path traversal");

  // Test: invalid JSON returns 400
  const badJsonResp = await new Promise((resolve, reject) => {
    const req = http.request({
      hostname: "127.0.0.1",
      port: proxy.port,
      path: "/api/v1/messages",
      method: "POST",
      headers: { "Content-Type": "application/json" },
    }, (res) => {
      const chunks = [];
      res.on("data", (c) => chunks.push(c));
      res.on("end", () => resolve({
        status: res.statusCode,
        body: Buffer.concat(chunks).toString("utf8"),
      }));
    });
    req.on("error", reject);
    req.write("not valid json {{{");
    req.end();
  });
  assert(badJsonResp.status === 400, "Proxy: invalid JSON returns 400");
  const badJsonBody = JSON.parse(badJsonResp.body);
  assert(badJsonBody.type === "error", "Proxy: error response in Anthropic format");
  assert(badJsonBody.error.type === "invalid_request_error", "Proxy: correct error type for bad JSON");

  // Test: catchall forwarding
  upstreamReceived = null;
  const resp4 = await request(proxy.port, {
    path: "/api/v1/models",
    method: "GET",
  });
  assert(resp4.status === 200, "Proxy: catchall returns 200");

  // Cleanup
  await proxy.close();
  await new Promise((resolve) => mock.close(resolve));

  // ── Test 2: Proxy handles upstream errors ──
  const errorMock = http.createServer((req, res) => {
    res.writeHead(500, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ type: "error", error: { type: "api_error", message: "Internal error" } }));
  });
  await new Promise((resolve) => errorMock.listen(0, "127.0.0.1", resolve));

  const errorProxy = await createProxy({
    targetUrl: `http://127.0.0.1:${errorMock.address().port}`,
    authHeader: "x-api-key",
    authValue: "test-key",
  });

  const errResp = await request(errorProxy.port, {
    body: { model: "test", messages: [{ role: "user", content: "Hi" }] },
  });
  assert(errResp.status === 500, "Proxy: upstream 500 forwarded to client");

  await errorProxy.close();
  await new Promise((resolve) => errorMock.close(resolve));

  // ── Test 3: Streaming response ──
  const streamMock = http.createServer((req, res) => {
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    });
    res.write('event: message_start\ndata: {"type":"message_start"}\n\n');
    res.write('event: content_block_delta\ndata: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}\n\n');
    res.write('event: message_stop\ndata: {"type":"message_stop"}\n\n');
    res.end();
  });
  await new Promise((resolve) => streamMock.listen(0, "127.0.0.1", resolve));

  const streamProxy = await createProxy({
    targetUrl: `http://127.0.0.1:${streamMock.address().port}`,
    authHeader: "Authorization",
    authValue: "Bearer stream-test",
  });

  const streamResp = await request(streamProxy.port, {
    body: { model: "test", stream: true, messages: [{ role: "user", content: "Hi" }] },
  });
  assert(streamResp.status === 200, "Proxy: streaming returns 200");
  assert(streamResp.body.includes("message_start"), "Proxy: stream contains message_start");
  assert(streamResp.body.includes("text_delta"), "Proxy: stream contains text_delta");
  assert(streamResp.body.includes("message_stop"), "Proxy: stream contains message_stop");

  await streamProxy.close();
  await new Promise((resolve) => streamMock.close(resolve));
}

// ═══════════════════════════════════════════════════════════════════
// Summary (runs after async tests)
// ═══════════════════════════════════════════════════════════════════

async function finish() {
  await runProxyTests();

  console.log(`\n${"─".repeat(50)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  } else {
    console.log("All tests passed! \u2705\n");
  }
}

finish().catch((err) => {
  console.error(`\nTest suite error: ${err.message}`);
  console.error(err.stack);
  process.exit(1);
});
