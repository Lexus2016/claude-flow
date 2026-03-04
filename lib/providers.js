/**
 * Provider configurations for Claude Code proxy routing.
 *
 * Each provider defines:
 *   - envKey:       which env var holds the API key
 *   - baseUrl:      API base (Claude Code appends /v1/messages)
 *   - auth:         "auth_token" → ANTHROPIC_AUTH_TOKEN (Bearer header)
 *                   "api_key"    → ANTHROPIC_API_KEY (x-api-key header)
 *   - models:       default model per tier {haiku, sonnet, opus}
 *   - description:  human-readable label
 *   - keyPrefix:    expected key prefix for validation (optional)
 *   - docsUrl:      link to get an API key
 */

const PROVIDERS = {
  openrouter: {
    name: "OpenRouter",
    description: "200+ models from every major provider through one API",
    envKey: "OPENROUTER_API_KEY",
    baseUrl: "https://openrouter.ai/api",
    auth: "auth_token",
    keyPrefix: "sk-or-",
    docsUrl: "https://openrouter.ai/keys",
    models: {
      haiku:  "anthropic/claude-haiku-4-5-20251001",
      sonnet: "anthropic/claude-sonnet-4-6",
      opus:   "anthropic/claude-opus-4-6",
    },
    popularModels: [
      { id: "anthropic/claude-opus-4-6",        name: "Claude Opus 4.6",       tier: "opus" },
      { id: "anthropic/claude-sonnet-4-6",      name: "Claude Sonnet 4.6",     tier: "sonnet" },
      { id: "anthropic/claude-haiku-4-5-20251001", name: "Claude Haiku 4.5",   tier: "haiku" },
      { id: "google/gemini-3.1-pro-preview",    name: "Gemini 3.1 Pro",        tier: "opus" },
      { id: "google/gemini-3-flash-preview",    name: "Gemini 3 Flash",        tier: "sonnet" },
      { id: "openai/gpt-5.2",                   name: "GPT-5.2",               tier: "opus" },
      { id: "openai/gpt-5.2-mini",              name: "GPT-5.2 Mini",          tier: "sonnet" },
      { id: "deepseek/deepseek-v3.2",           name: "DeepSeek V3.2",         tier: "sonnet" },
      { id: "deepseek/deepseek-r1-0528",        name: "DeepSeek R1",           tier: "opus" },
      { id: "minimax/minimax-m2.5",             name: "MiniMax M2.5",          tier: "opus" },
      { id: "moonshotai/kimi-k2.5",             name: "Kimi K2.5",             tier: "opus" },
      { id: "z-ai/glm-5",                       name: "GLM-5",                 tier: "opus" },
      { id: "qwen/qwen3.5-plus",               name: "Qwen 3.5",              tier: "sonnet" },
      { id: "meta-llama/llama-4-maverick",      name: "Llama 4 Maverick",      tier: "sonnet" },
      { id: "z-ai/glm-4.5-air",                name: "GLM-4.5 Air",           tier: "haiku" },
    ],
  },

  deepseek: {
    name: "DeepSeek",
    description: "DeepSeek models via native Anthropic-compatible API",
    envKey: "DEEPSEEK_API_KEY",
    baseUrl: "https://api.deepseek.com/anthropic",
    auth: "api_key",
    keyPrefix: "sk-",
    docsUrl: "https://platform.deepseek.com/api_keys",
    models: {
      haiku:  "deepseek-chat",
      sonnet: "deepseek-v3.2",
      opus:   "deepseek-r1-0528",
    },
    popularModels: [
      { id: "deepseek-v3.2",     name: "DeepSeek V3.2",    tier: "sonnet" },
      { id: "deepseek-r1-0528",  name: "DeepSeek R1",      tier: "opus" },
      { id: "deepseek-chat",     name: "DeepSeek V3",      tier: "haiku" },
    ],
  },

  openai: {
    name: "OpenAI",
    description: "OpenAI models (GPT-5.2, o3, etc.)",
    envKey: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    auth: "api_key",
    keyPrefix: "sk-",
    docsUrl: "https://platform.openai.com/api-keys",
    models: {
      haiku:  "gpt-5.2-mini",
      sonnet: "gpt-5.2",
      opus:   "gpt-5.2",
    },
    popularModels: [
      { id: "gpt-5.2",           name: "GPT-5.2",           tier: "opus" },
      { id: "gpt-5.2-mini",      name: "GPT-5.2 Mini",      tier: "sonnet" },
      { id: "gpt-5.2-thinking",  name: "GPT-5.2 Thinking",  tier: "opus" },
      { id: "o3",                name: "o3",                 tier: "opus" },
      { id: "gpt-4.1",           name: "GPT-4.1",            tier: "sonnet" },
    ],
  },

  gemini: {
    name: "Google Gemini",
    description: "Gemini models via OpenAI-compatible endpoint",
    envKey: "GEMINI_API_KEY",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    auth: "api_key",
    keyPrefix: "AI",
    docsUrl: "https://aistudio.google.com/apikey",
    models: {
      haiku:  "gemini-2.5-flash",
      sonnet: "gemini-3-flash-preview",
      opus:   "gemini-3.1-pro-preview",
    },
    popularModels: [
      { id: "gemini-3.1-pro-preview", name: "Gemini 3.1 Pro",    tier: "opus" },
      { id: "gemini-3-flash-preview", name: "Gemini 3 Flash",    tier: "sonnet" },
      { id: "gemini-2.5-pro",         name: "Gemini 2.5 Pro",    tier: "opus" },
      { id: "gemini-2.5-flash",       name: "Gemini 2.5 Flash",  tier: "haiku" },
    ],
  },

  custom: {
    name: "Custom Provider",
    description: "Any Anthropic-compatible API endpoint",
    envKey: "CUSTOM_API_KEY",
    baseUrl: "",
    auth: "auth_token",
    keyPrefix: "",
    docsUrl: "",
    models: {
      haiku:  "",
      sonnet: "",
      opus:   "",
    },
    popularModels: [],
  },
};

// Aliases for common names
PROVIDERS.or = PROVIDERS.openrouter;
PROVIDERS.ds = PROVIDERS.deepseek;
PROVIDERS.gpt = PROVIDERS.openai;

/**
 * Get provider config by name.
 * @param {string} name - Provider name or alias
 * @returns {object|null} Provider config
 */
function getProvider(name) {
  return PROVIDERS[name.toLowerCase()] || null;
}

/**
 * List all provider names (excluding aliases).
 * @returns {string[]}
 */
function listProviders() {
  return Object.keys(PROVIDERS).filter(k => !["or", "ds", "gpt"].includes(k));
}

/**
 * Get auth configuration for the sanitizing proxy.
 * Maps provider auth type to HTTP header name and value for upstream requests.
 *
 * @param {string} providerName - Provider name or alias
 * @param {string} apiKey - Raw API key
 * @returns {{ authHeader: string, authValue: string }}
 * @throws {Error} If provider unknown
 */
function getAuthConfig(providerName, apiKey) {
  const provider = getProvider(providerName);
  if (!provider) {
    throw new Error(`Unknown provider "${providerName}"`);
  }

  if (provider.auth === "auth_token") {
    return { authHeader: "Authorization", authValue: `Bearer ${apiKey}` };
  }
  return { authHeader: "x-api-key", authValue: apiKey };
}

module.exports = { PROVIDERS, getProvider, listProviders, getAuthConfig };
