/**
 * Basic tests for claude-flow (no test framework needed).
 */

const { buildEnv, toShellExports, mergeEnv } = require("../lib/env");
const { getProvider, listProviders } = require("../lib/providers");

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  ✅ ${message}`);
  } else {
    failed++;
    console.error(`  ❌ ${message}`);
  }
}

// ── Provider tests ──────────────────────────────────────────────────

console.log("\nProviders:");

assert(getProvider("openrouter") !== null, "getProvider('openrouter') returns config");
assert(getProvider("or") !== null, "alias 'or' resolves to openrouter");
assert(getProvider("deepseek") !== null, "getProvider('deepseek') returns config");
assert(getProvider("nonexistent") === null, "unknown provider returns null");
assert(listProviders().includes("openrouter"), "listProviders includes openrouter");
assert(!listProviders().includes("or"), "listProviders excludes aliases");

// ── buildEnv tests ──────────────────────────────────────────────────

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

// ── toShellExports tests ────────────────────────────────────────────

console.log("\ntoShellExports:");

const shellOutput = toShellExports(orEnv);
assert(shellOutput.includes("export ANTHROPIC_AUTH_TOKEN="), "Shell: includes AUTH_TOKEN export");
assert(shellOutput.includes("export ANTHROPIC_API_KEY=''"), "Shell: API_KEY is empty string in quotes");
assert(shellOutput.includes("export ANTHROPIC_BASE_URL="), "Shell: includes BASE_URL");

// ── The Critical Test ───────────────────────────────────────────────

console.log("\nCritical behavior (the whole reason this package exists):");

const env = buildEnv("openrouter", { apiKey: "sk-or-v1-real-key" });
assert("ANTHROPIC_API_KEY" in env, "API_KEY key EXISTS in env object");
assert(env.ANTHROPIC_API_KEY === "", "API_KEY value is empty string ''");
assert(env.ANTHROPIC_API_KEY !== null, "API_KEY is NOT null");
assert(env.ANTHROPIC_API_KEY !== undefined, "API_KEY is NOT undefined");
assert(typeof env.ANTHROPIC_API_KEY === "string", "API_KEY is a string");
assert(env.ANTHROPIC_API_KEY.length === 0, "API_KEY length is 0");

// ── Summary ─────────────────────────────────────────────────────────

console.log(`\n${"─".repeat(50)}`);
console.log(`Results: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed! ✅\n");
}
