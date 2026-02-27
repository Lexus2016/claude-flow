/**
 * Config file management (~/.claude-flow/config.json).
 *
 * Stores the active provider, API keys, and model preferences.
 * Keys are stored locally — never transmitted anywhere.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");

const CONFIG_DIR = path.join(os.homedir(), ".claude-flow");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");

const DEFAULT_CONFIG = {
  activeProvider: null,
  providers: {},
};

/**
 * Load config from disk.
 * @returns {object}
 */
function load() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG_FILE, "utf8"));
    }
  } catch {
    // Corrupted config — reset
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Save config to disk.
 * @param {object} config
 */
function save(config) {
  fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2), {
    mode: 0o600,  // owner read/write only — contains API keys
  });
}

/**
 * Get saved provider settings.
 * @param {string} provider
 * @returns {object|null}
 */
function getProviderConfig(provider) {
  const cfg = load();
  return cfg.providers[provider] || null;
}

/**
 * Save provider settings.
 * @param {string} provider
 * @param {object} settings - { apiKey, baseUrl, models: { haiku, sonnet, opus } }
 */
function setProviderConfig(provider, settings) {
  const cfg = load();
  cfg.providers[provider] = { ...cfg.providers[provider], ...settings };
  save(cfg);
}

/**
 * Get/set the active provider.
 */
function getActiveProvider() {
  return load().activeProvider;
}

function setActiveProvider(provider) {
  const cfg = load();
  cfg.activeProvider = provider;
  save(cfg);
}

/**
 * Get the config file path (for display purposes).
 */
function getConfigPath() {
  return CONFIG_FILE;
}

module.exports = {
  load, save,
  getProviderConfig, setProviderConfig,
  getActiveProvider, setActiveProvider,
  getConfigPath,
};
