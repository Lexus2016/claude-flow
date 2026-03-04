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
 *
 * @example
 * // Start sanitizing proxy for non-Anthropic providers
 * const { createProxy, getAuthConfig } = require('claude-flow');
 * const { authHeader, authValue } = getAuthConfig('openrouter', 'sk-or-v1-...');
 * const proxy = await createProxy({
 *   targetUrl: 'https://openrouter.ai/api',
 *   authHeader, authValue,
 * });
 * // ANTHROPIC_BASE_URL = `http://127.0.0.1:${proxy.port}/api`
 */

const { buildEnv, toShellExports, mergeEnv } = require("./env");
const { PROVIDERS, getProvider, listProviders, getAuthConfig } = require("./providers");
const config = require("./config");
const { SanitizingProxy, createProxy } = require("./proxy");
const { sanitizeRequestBody } = require("./sanitize");

module.exports = {
  // Core API
  buildEnv,
  toShellExports,
  mergeEnv,

  // Provider info
  PROVIDERS,
  getProvider,
  listProviders,
  getAuthConfig,

  // Sanitizing proxy
  SanitizingProxy,
  createProxy,
  sanitizeRequestBody,

  // Config management
  config,
};
