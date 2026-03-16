/**
 * Request sanitization for Anthropic Messages API.
 *
 * Sanitizes Anthropic-internal content types, parameters, and caching hints
 * that non-Anthropic providers can't handle (OpenRouter, DeepSeek, OpenAI, Gemini).
 *
 * Sanitization applied:
 *   Content blocks:
 *     - thinking / redacted_thinking  → removed entirely
 *     - tool_reference                → converted to text "[Tool loaded: {name}]"
 *     - server_tool_use               → removed (internal Anthropic type)
 *     - web_search_tool_result        → removed (internal Anthropic type)
 *     - cache_control field           → stripped from every content block
 *   Messages:
 *     - cache_control field           → stripped from message-level objects
 *     - Empty content after filtering → placeholder text inserted
 *   System prompt:
 *     - Array form: non-text items filtered, cache_control stripped
 *   Request body:
 *     - thinking parameter            → removed (budget_tokens etc.)
 *     - Gemini 2.5 thinking           → disabled via reasoning.effort="none"
 *     - Tool schemas: $schema field   → removed recursively
 *     - cache_control on tools        → stripped
 *
 * All functions are pure (no I/O, no side effects). Input is never mutated.
 */

// Content types that should be completely removed from messages
const REMOVE_CONTENT_TYPES = new Set([
  "redacted_thinking",       // Extended thinking — leaks [thinking] into output
  "thinking",                // Regular thinking blocks — not supported by non-Anthropic
  "reasoning_content",       // OpenRouter reasoning blocks (Gemini, DeepSeek, etc.)
  "server_tool_use",         // Internal Anthropic server-side tool calls
  "web_search_tool_result",  // Internal Anthropic web search results
]);

// Gemini 2.5 models have thinking/reasoning enabled by default.
// When thinking tokens aren't explicitly disabled, they leak into the
// output stream through OpenRouter, producing messy mixed output.
const GEMINI_THINKING_PREFIXES = [
  "google/gemini-2.5-flash",
  "google/gemini-2.5-pro",
  "google/gemini-3",           // Future-proof: Gemini 3.x will likely have thinking too
];
const GEMINI_THINKING_EXCLUDE = [
  "google/gemini-2.5-flash-lite",  // Lite has thinking off by default
];

/**
 * Check if the model is a Gemini variant with thinking enabled by default.
 * @param {string} model - Model ID (e.g. "google/gemini-2.5-flash")
 * @returns {boolean}
 */
function isGeminiThinkingModel(model) {
  if (!model) return false;
  const m = model.toLowerCase().split(":")[0]; // strip :free, :nitro suffixes
  if (GEMINI_THINKING_EXCLUDE.some(excl => m.startsWith(excl))) return false;
  return GEMINI_THINKING_PREFIXES.some(prefix => m.startsWith(prefix));
}

/**
 * Remove cache_control field from an object (shallow copy).
 * @param {object} obj
 * @returns {object}
 */
function stripCacheControl(obj) {
  if (!obj || typeof obj !== "object" || !("cache_control" in obj)) return obj;
  const copy = { ...obj };
  delete copy.cache_control;
  return copy;
}

/**
 * Sanitize a single content block.
 * Returns null for blocks that should be removed entirely.
 * Recursively sanitizes nested content (e.g., tool_result.content).
 *
 * @param {object} block - Content block
 * @returns {object|null} Sanitized block or null if removed
 */
function sanitizeContentBlock(block) {
  if (!block || typeof block !== "object") return block;

  const type = block.type || "";

  // Remove unsupported types entirely
  if (REMOVE_CONTENT_TYPES.has(type)) return null;

  // Convert tool_reference to text
  if (type === "tool_reference") {
    return { type: "text", text: `[Tool loaded: ${block.tool_name || "unknown"}]` };
  }

  // tool_result blocks have nested 'content' that may contain unsupported types
  if (type === "tool_result") {
    const cleaned = stripCacheControl(block);
    if (cleaned.content != null) {
      return { ...cleaned, content: sanitizeContent(cleaned.content) };
    }
    return cleaned;
  }

  // Strip cache_control from all other blocks
  return stripCacheControl(block);
}

/**
 * Sanitize message content — can be string or array of blocks.
 * Blocks that return null from sanitizeContentBlock are removed entirely.
 * If all blocks are removed, returns a placeholder text to avoid empty content.
 *
 * @param {string|Array} content
 * @returns {string|Array}
 */
function sanitizeContent(content) {
  if (typeof content === "string") return content;

  if (Array.isArray(content)) {
    const sanitized = [];
    for (const block of content) {
      const result = sanitizeContentBlock(block);
      if (result != null) sanitized.push(result);
    }
    // Prevent empty content arrays (causes API errors)
    if (sanitized.length === 0) {
      return [{ type: "text", text: "(continued)" }];
    }
    return sanitized;
  }

  return content;
}

/**
 * Sanitize the system prompt.
 * System can be: string (pass through), array of blocks (filter to text-only,
 * strip cache_control), or null/undefined (pass through).
 *
 * @param {string|Array|null} system
 * @returns {string|Array|null}
 */
function sanitizeSystem(system) {
  if (system == null || typeof system === "string") return system;

  if (Array.isArray(system)) {
    const sanitized = [];
    for (const item of system) {
      if (!item || typeof item !== "object") continue;
      // Only keep text-type items (filter out citations, etc.)
      if (item.type !== "text") continue;
      sanitized.push(stripCacheControl(item));
    }
    // If only one text block left, simplify to string
    if (sanitized.length === 1 && sanitized[0].text) {
      return sanitized[0].text;
    }
    return sanitized.length > 0 ? sanitized : null;
  }

  return system;
}

/**
 * Remove $schema and other problematic fields from tool parameter schemas.
 * Some providers (Groq, Gemini) can't handle $schema in tool definitions.
 * Recursively cleans nested properties (max depth 20 to prevent infinite recursion).
 *
 * @param {object} schema - JSON Schema object
 * @param {number} [depth=0] - Current recursion depth
 * @returns {object} Cleaned schema
 */
function cleanToolSchema(schema, depth = 0) {
  if (!schema || typeof schema !== "object" || depth > 20) return schema;

  const cleaned = { ...schema };
  delete cleaned["$schema"];

  // Recursively clean nested properties
  if (cleaned.properties && typeof cleaned.properties === "object") {
    const props = {};
    for (const [key, val] of Object.entries(cleaned.properties)) {
      props[key] = cleanToolSchema(val, depth + 1);
    }
    cleaned.properties = props;
  }

  // Clean items (for array types)
  if (cleaned.items && typeof cleaned.items === "object") {
    cleaned.items = cleanToolSchema(cleaned.items, depth + 1);
  }

  // Clean anyOf / oneOf / allOf
  for (const comboKey of ["anyOf", "oneOf", "allOf"]) {
    if (Array.isArray(cleaned[comboKey])) {
      cleaned[comboKey] = cleaned[comboKey].map(s => cleanToolSchema(s, depth + 1));
    }
  }

  return cleaned;
}

/**
 * Sanitize tool definitions: clean schemas, strip cache_control.
 *
 * @param {Array} tools - Tool definitions array
 * @returns {Array} Sanitized tools
 */
function sanitizeTools(tools) {
  if (!Array.isArray(tools)) return tools;

  return tools.map(tool => {
    if (!tool || typeof tool !== "object") return tool;
    const cleaned = { ...tool };
    delete cleaned.cache_control;
    if (cleaned.input_schema && typeof cleaned.input_schema === "object") {
      cleaned.input_schema = cleanToolSchema(cleaned.input_schema);
    }
    return cleaned;
  });
}

/**
 * Sanitize all messages: content blocks + message-level cache_control.
 *
 * @param {Array} messages - Array of message objects
 * @returns {Array} Sanitized messages
 */
function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return messages;

  return messages.map(msg => {
    if (!msg || typeof msg !== "object") return msg;
    const cleaned = { ...msg };
    delete cleaned.cache_control;
    if (cleaned.content != null) {
      cleaned.content = sanitizeContent(cleaned.content);
    }
    return cleaned;
  });
}

/**
 * Sanitize the full Anthropic Messages API request body.
 *
 * Handles: messages, system, tools, thinking parameter, cache_control,
 * max_tokens clamping (provider-specific).
 * Returns a new object — never mutates the original.
 *
 * On any internal error, returns the original body unmodified (fail-safe).
 *
 * @param {object} body - Request body
 * @param {object} [opts] - Optional settings
 * @param {number} [opts.maxOutputTokens] - Provider max output token limit (clamp max_tokens)
 * @returns {object} Sanitized body
 */
function sanitizeRequestBody(body, opts) {
  if (!body || typeof body !== "object") return body;

  try {
    // Deep clone to avoid mutating the original
    const sanitized = JSON.parse(JSON.stringify(body));

    // 1. Sanitize messages
    if (sanitized.messages) {
      sanitized.messages = sanitizeMessages(sanitized.messages);
    }

    // 2. Sanitize system prompt (can be string or array with cache_control)
    if ("system" in sanitized) {
      const sys = sanitizeSystem(sanitized.system);
      if (sys == null) {
        delete sanitized.system;
      } else {
        sanitized.system = sys;
      }
    }

    // 3. Remove thinking parameter (budget_tokens etc.)
    delete sanitized.thinking;

    // 3a. Gemini 2.5+ thinking fix: explicitly disable reasoning
    // Gemini 2.5 Flash/Pro have thinking enabled by default. Without explicit
    // disable, thinking tokens leak into the output stream through OpenRouter,
    // producing messy output with internal monologue mixed into task results.
    // OpenRouter docs: effort="none" disables reasoning entirely.
    if (isGeminiThinkingModel(sanitized.model)) {
      sanitized.reasoning = { effort: "none" };
    }

    // 4. Sanitize tools (clean $schema, strip cache_control)
    if (sanitized.tools) {
      sanitized.tools = sanitizeTools(sanitized.tools);
    }

    // 5. Strip tool_choice cache_control if present
    if (sanitized.tool_choice && typeof sanitized.tool_choice === "object") {
      delete sanitized.tool_choice.cache_control;
    }

    // 6. Clamp max_tokens to provider limit (e.g., DeepSeek caps at 8192)
    const cap = opts?.maxOutputTokens;
    if (cap && typeof sanitized.max_tokens === "number" && sanitized.max_tokens > cap) {
      sanitized.max_tokens = cap;
    }

    return sanitized;
  } catch (e) {
    // Sanitization failed — return original unmodified (fail-safe)
    return body;
  }
}

module.exports = {
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
};
