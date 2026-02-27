/**
 * claude-flow — Use any LLM with Claude Code
 *
 * @example
 * const { buildEnv, mergeEnv } = require('claude-flow');
 *
 * // Get env vars for OpenRouter
 * const env = buildEnv('openrouter', { apiKey: 'sk-or-v1-...' });
 * // { ANTHROPIC_AUTH_TOKEN: '...', ANTHROPIC_API_KEY: '', ANTHROPIC_BASE_URL: '...', ... }
 *
 * // Run Claude Code with provider env
 * const { spawn } = require('child_process');
 * spawn('claude', ['-p', 'Hello!'], { env: mergeEnv('openrouter', { apiKey: '...' }) });
 */

const { buildEnv, toShellExports, mergeEnv } = require("./env");
const { PROVIDERS, getProvider, listProviders } = require("./providers");
const config = require("./config");

module.exports = {
  // Core API
  buildEnv,
  toShellExports,
  mergeEnv,

  // Provider info
  PROVIDERS,
  getProvider,
  listProviders,

  // Config management
  config,
};
