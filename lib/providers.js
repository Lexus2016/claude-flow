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
      haiku:  "anthropic/claude-haiku-4",
      sonnet: "anthropic/claude-sonnet-4",
      opus:   "anthropic/claude-opus-4",
    },
    popularModels: [
      { id: "anthropic/claude-sonnet-4",       name: "Claude Sonnet 4",     tier: "sonnet" },
      { id: "anthropic/claude-opus-4",          name: "Claude Opus 4",       tier: "opus" },
      { id: "anthropic/claude-haiku-4",         name: "Claude Haiku 4",      tier: "haiku" },
      { id: "google/gemini-2.5-pro",            name: "Gemini 2.5 Pro",      tier: "opus" },
      { id: "google/gemini-2.5-flash",          name: "Gemini 2.5 Flash",    tier: "sonnet" },
      { id: "openai/gpt-4.1",                   name: "GPT-4.1",             tier: "opus" },
      { id: "openai/gpt-4.1-mini",              name: "GPT-4.1 Mini",        tier: "sonnet" },
      { id: "openai/gpt-4.1-nano",              name: "GPT-4.1 Nano",        tier: "haiku" },
      { id: "deepseek/deepseek-r1",             name: "DeepSeek R1",         tier: "opus" },
      { id: "deepseek/deepseek-chat",           name: "DeepSeek V3",         tier: "sonnet" },
      { id: "meta-llama/llama-4-maverick",      name: "Llama 4 Maverick",    tier: "sonnet" },
      { id: "z-ai/glm-5",                       name: "GLM-5",               tier: "opus" },
      { id: "z-ai/glm-4.5-air",                 name: "GLM-4.5 Air",         tier: "haiku" },
      { id: "mistralai/mistral-large",           name: "Mistral Large",       tier: "sonnet" },
      { id: "qwen/qwen3-235b-a22b",             name: "Qwen3 235B",          tier: "opus" },
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
      sonnet: "deepseek-chat",
      opus:   "deepseek-reasoner",
    },
    popularModels: [
      { id: "deepseek-chat",     name: "DeepSeek V3",  tier: "sonnet" },
      { id: "deepseek-reasoner", name: "DeepSeek R1",  tier: "opus" },
    ],
  },

  openai: {
    name: "OpenAI",
    description: "OpenAI models (GPT-4.1, o3, etc.)",
    envKey: "OPENAI_API_KEY",
    baseUrl: "https://api.openai.com/v1",
    auth: "api_key",
    keyPrefix: "sk-",
    docsUrl: "https://platform.openai.com/api-keys",
    models: {
      haiku:  "gpt-4.1-nano",
      sonnet: "gpt-4.1-mini",
      opus:   "gpt-4.1",
    },
    popularModels: [
      { id: "gpt-4.1",         name: "GPT-4.1",       tier: "opus" },
      { id: "gpt-4.1-mini",    name: "GPT-4.1 Mini",  tier: "sonnet" },
      { id: "gpt-4.1-nano",    name: "GPT-4.1 Nano",  tier: "haiku" },
      { id: "o3",              name: "o3",             tier: "opus" },
      { id: "o3-mini",         name: "o3 Mini",        tier: "sonnet" },
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
      sonnet: "gemini-2.5-pro",
      opus:   "gemini-2.5-pro",
    },
    popularModels: [
      { id: "gemini-2.5-pro",     name: "Gemini 2.5 Pro",    tier: "opus" },
      { id: "gemini-2.5-flash",   name: "Gemini 2.5 Flash",  tier: "sonnet" },
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

module.exports = { PROVIDERS, getProvider, listProviders };
