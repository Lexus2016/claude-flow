#!/usr/bin/env node

/**
 * claude-flow CLI — Use any LLM with Claude Code
 *
 * Usage:
 *   claude-flow setup <provider>     Interactive setup
 *   claude-flow env [provider]       Print shell exports (for eval)
 *   claude-flow run -- <command>     Run a command with provider env + sanitizing proxy
 *   claude-flow proxy [provider]     Start standalone sanitizing proxy
 *   claude-flow providers            List available providers
 *   claude-flow models [provider]    List popular models
 *   claude-flow status               Show current configuration
 *   claude-flow switch <provider>    Switch active provider
 */

const { spawn } = require("child_process");
const { createInterface } = require("readline");
const { buildEnv, toShellExports, mergeEnv } = require("../lib/env");
const { getProvider, listProviders, PROVIDERS, getAuthConfig } = require("../lib/providers");
const config = require("../lib/config");

// ── Colors (no dependencies) ────────────────────────────────────────
const c = {
  reset: "\x1b[0m",
  bold:  "\x1b[1m",
  dim:   "\x1b[2m",
  green: "\x1b[32m",
  yellow:"\x1b[33m",
  blue:  "\x1b[34m",
  cyan:  "\x1b[36m",
  red:   "\x1b[31m",
  magenta:"\x1b[35m",
};
const B = (s) => `${c.bold}${s}${c.reset}`;
const G = (s) => `${c.green}${s}${c.reset}`;
const Y = (s) => `${c.yellow}${s}${c.reset}`;
const R = (s) => `${c.red}${s}${c.reset}`;
const D = (s) => `${c.dim}${s}${c.reset}`;
const C = (s) => `${c.cyan}${s}${c.reset}`;
const M = (s) => `${c.magenta}${s}${c.reset}`;

// ── CLI argument parsing ────────────────────────────────────────────
const args = process.argv.slice(2);
const command = args[0];

// ── Commands ────────────────────────────────────────────────────────

async function main() {
  switch (command) {
    case "setup":     return cmdSetup(args[1]);
    case "env":       return cmdEnv(args[1]);
    case "run":       return cmdRun(args.slice(1));
    case "proxy":     return cmdProxy(args.slice(1));
    case "providers": return cmdProviders();
    case "models":    return cmdModels(args[1]);
    case "status":    return cmdStatus();
    case "switch":    return cmdSwitch(args[1]);
    case "help":
    case "--help":
    case "-h":
    case undefined:   return cmdHelp();
    case "--version":
    case "-v":        return cmdVersion();
    default:
      console.error(R(`Unknown command: ${command}`));
      console.error(`Run ${B("claude-flow help")} for usage.`);
      process.exit(1);
  }
}

// ── setup ───────────────────────────────────────────────────────────

async function cmdSetup(providerName) {
  if (!providerName) {
    console.log(B("\n  claude-flow setup\n"));
    console.log("  Available providers:\n");
    for (const name of listProviders()) {
      const p = PROVIDERS[name];
      console.log(`    ${B(name.padEnd(14))} ${p.description}`);
    }
    console.log(`\n  Usage: ${B("claude-flow setup <provider>")}\n`);
    console.log(`  Example: ${D("claude-flow setup openrouter")}\n`);
    return;
  }

  const provider = getProvider(providerName);
  if (!provider) {
    console.error(R(`Unknown provider "${providerName}".`));
    console.error(`Run ${B("claude-flow providers")} to see available options.`);
    process.exit(1);
  }

  console.log(`\n  ${B("claude-flow")} — Setup ${B(provider.name)}\n`);

  if (provider.docsUrl) {
    console.log(`  ${D("Get your API key:")} ${C(provider.docsUrl)}\n`);
  }

  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = (q) => new Promise((resolve) => rl.question(q, resolve));

  // API Key
  const existingCfg = config.getProviderConfig(providerName);
  const existingKey = existingCfg?.apiKey;
  const keyHint = existingKey
    ? ` ${D(`(current: ${existingKey.slice(0, 8)}...${existingKey.slice(-4)})`)}`
    : "";
  const apiKey = (await ask(`  API Key${keyHint}: `)).trim() || existingKey || "";

  if (!apiKey) {
    console.error(R("\n  API key is required."));
    rl.close();
    process.exit(1);
  }

  // Validate key prefix
  if (provider.keyPrefix && !apiKey.startsWith(provider.keyPrefix)) {
    console.log(Y(`\n  Warning: Key doesn't start with "${provider.keyPrefix}". Are you sure it's correct?`));
  }

  // Model selection
  console.log(`\n  ${B("Model configuration")} ${D("(press Enter for defaults)")}\n`);
  console.log(`  Claude Code uses 3 model tiers: haiku (fast), sonnet (balanced), opus (powerful)\n`);

  if (provider.popularModels.length > 0) {
    console.log(`  ${D("Popular models for " + provider.name + ":")}`);
    for (const m of provider.popularModels.slice(0, 8)) {
      console.log(`    ${m.id.padEnd(38)} ${D(m.tier)}`);
    }
    console.log();
  }

  const defaultH = existingCfg?.models?.haiku  || provider.models.haiku;
  const defaultS = existingCfg?.models?.sonnet || provider.models.sonnet;
  const defaultO = existingCfg?.models?.opus   || provider.models.opus;

  const haiku  = (await ask(`  Haiku model  ${D(`[${defaultH}]`)}: `)).trim() || defaultH;
  const sonnet = (await ask(`  Sonnet model ${D(`[${defaultS}]`)}: `)).trim() || defaultS;
  const opus   = (await ask(`  Opus model   ${D(`[${defaultO}]`)}: `)).trim() || defaultO;

  rl.close();

  // Save config
  config.setProviderConfig(providerName, {
    apiKey,
    models: { haiku, sonnet, opus },
  });
  config.setActiveProvider(providerName);

  // Build and display env
  const env = buildEnv(providerName, {
    apiKey,
    haiku, sonnet, opus,
  });

  console.log(`\n  ${G("✓")} Configuration saved to ${D(config.getConfigPath())}`);
  console.log(`  ${G("✓")} Active provider: ${B(provider.name)}\n`);

  console.log(`  ${B("Environment variables")} (what Claude Code will use):\n`);
  for (const [key, value] of Object.entries(env)) {
    const display = key.includes("KEY") || key.includes("TOKEN")
      ? (value === "" ? D('""  ← intentionally empty') : D(`${value.slice(0, 12)}...`))
      : value;
    console.log(`    ${key.padEnd(36)} ${display}`);
  }

  console.log(`\n  ${B("Quick start:")}\n`);
  console.log(`    ${D("# Option 1: Run directly (with sanitizing proxy)")}`);
  console.log(`    ${C("claude-flow run -- claude -p 'Hello from " + provider.name + "!'")}\n`);
  console.log(`    ${D("# Option 2: Start proxy separately")}`);
  console.log(`    ${C("claude-flow proxy")}\n`);
  console.log(`    ${D("# Option 3: Env vars only (no proxy, for Anthropic-native providers)")}`);
  console.log(`    ${C("eval $(claude-flow env)")}\n`);
}

// ── env ─────────────────────────────────────────────────────────────

function cmdEnv(providerName) {
  const name = providerName || config.getActiveProvider();
  if (!name) {
    console.error("No active provider. Run: claude-flow setup <provider>");
    process.exit(1);
  }

  const saved = config.getProviderConfig(name);
  if (!saved?.apiKey) {
    console.error(`No API key saved for "${name}". Run: claude-flow setup ${name}`);
    process.exit(1);
  }

  const env = buildEnv(name, {
    apiKey: saved.apiKey,
    haiku:  saved.models?.haiku,
    sonnet: saved.models?.sonnet,
    opus:   saved.models?.opus,
  });

  // Output pure shell exports (for eval)
  console.log(toShellExports(env));
}

// ── run ─────────────────────────────────────────────────────────────

async function cmdRun(rawArgs) {
  // Parse flags before -- separator
  const dashIdx = rawArgs.indexOf("--");
  const flagArgs = dashIdx > 0 ? rawArgs.slice(0, dashIdx) : [];
  const cmdArgs = dashIdx >= 0 ? rawArgs.slice(dashIdx + 1) : rawArgs.slice(1);

  // Extract flags
  const noProxy = flagArgs.includes("--no-proxy");
  const providerFlag = flagArgs.find(a => !a.startsWith("--"));

  if (cmdArgs.length === 0) {
    console.error(R("No command specified."));
    console.error(`Usage: ${B("claude-flow run -- claude -p 'Hello'")}`);
    process.exit(1);
  }

  const providerName = providerFlag || config.getActiveProvider();
  if (!providerName) {
    console.error(R("No active provider."));
    console.error(`Run: ${B("claude-flow setup <provider>")} first.`);
    process.exit(1);
  }

  const provider = getProvider(providerName);
  if (!provider) {
    console.error(R(`Unknown provider "${providerName}".`));
    process.exit(1);
  }

  const saved = config.getProviderConfig(providerName);
  if (!saved?.apiKey) {
    console.error(R(`No API key for "${providerName}".`));
    console.error(`Run: ${B(`claude-flow setup ${providerName}`)} first.`);
    process.exit(1);
  }

  const env = mergeEnv(providerName, {
    apiKey: saved.apiKey,
    haiku:  saved.models?.haiku,
    sonnet: saved.models?.sonnet,
    opus:   saved.models?.opus,
  });

  // Start sanitizing proxy (unless --no-proxy)
  let proxyInstance = null;
  if (!noProxy) {
    try {
      const { createProxy } = require("../lib/proxy");
      const auth = getAuthConfig(providerName, saved.apiKey);

      proxyInstance = await createProxy({
        targetUrl: provider.baseUrl,
        authHeader: auth.authHeader,
        authValue: auth.authValue,
      });

      // Override env to route through proxy
      env.ANTHROPIC_BASE_URL = `http://127.0.0.1:${proxyInstance.port}/api`;

      console.error(`${G("✓")} Proxy: 127.0.0.1:${proxyInstance.port} ${D(`→ ${provider.baseUrl}`)}`);
    } catch (err) {
      console.error(Y(`Warning: Could not start proxy: ${err.message}`));
      console.error(Y("Continuing without proxy (some features may not work with non-Anthropic models)"));
    }
  }

  // Spawn the command with provider env
  const child = spawn(cmdArgs[0], cmdArgs.slice(1), {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  // Cleanup on exit
  const cleanup = async (code) => {
    if (proxyInstance) {
      try { await proxyInstance.close(); } catch {}
    }
    process.exit(code || 0);
  };

  child.on("exit", (code) => cleanup(code));
  child.on("error", (err) => {
    console.error(R(`Failed to run: ${cmdArgs[0]}`));
    console.error(err.message);
    cleanup(1);
  });

  // Handle signals — kill child, then cleanup
  for (const sig of ["SIGINT", "SIGTERM"]) {
    process.on(sig, () => {
      child.kill(sig);
      // child.on("exit") will handle cleanup
    });
  }
}

// ── proxy ───────────────────────────────────────────────────────────

async function cmdProxy(rawArgs) {
  // Parse arguments
  let providerName = null;
  let port = 0;
  let verbose = false;

  for (let i = 0; i < rawArgs.length; i++) {
    const arg = rawArgs[i];
    if (arg === "--verbose" || arg === "-v") {
      verbose = true;
    } else if (arg.startsWith("--port=")) {
      port = parseInt(arg.split("=")[1], 10);
      if (isNaN(port)) {
        console.error(R("Invalid port number."));
        process.exit(1);
      }
    } else if (arg === "--port") {
      // --port 8080 (next arg consumed)
      port = parseInt(rawArgs[++i], 10);
      if (isNaN(port)) {
        console.error(R("Invalid or missing port number after --port."));
        process.exit(1);
      }
    } else if (!arg.startsWith("--") && !providerName) {
      providerName = arg;
    }
  }

  providerName = providerName || config.getActiveProvider();

  if (!providerName) {
    console.error(R("No provider specified."));
    console.error(`Usage: ${B("claude-flow proxy <provider>")} or configure a default with ${B("claude-flow setup")}`);
    process.exit(1);
  }

  const provider = getProvider(providerName);
  if (!provider) {
    console.error(R(`Unknown provider "${providerName}".`));
    process.exit(1);
  }

  // Get API key from saved config or environment
  const saved = config.getProviderConfig(providerName);
  const apiKey = saved?.apiKey || process.env[provider.envKey] || "";

  if (!apiKey) {
    console.error(R(`No API key for ${provider.name}.`));
    console.error(`Run: ${B(`claude-flow setup ${providerName}`)} or set ${B(provider.envKey)} env var.`);
    process.exit(1);
  }

  // Start proxy
  const { createProxy } = require("../lib/proxy");
  const auth = getAuthConfig(providerName, apiKey);

  const proxy = await createProxy({
    targetUrl: provider.baseUrl,
    authHeader: auth.authHeader,
    authValue: auth.authValue,
    port,
    verbose,
  });

  console.error(`\n  ${B("claude-flow proxy")} — Sanitizing proxy for ${B(provider.name)}\n`);
  console.error(`  ${G("●")} Listening: ${B(`http://127.0.0.1:${proxy.port}`)}`);
  console.error(`  ${D("→")} Upstream:  ${provider.baseUrl}`);
  const maskedAuth = auth.authValue.length > 12
    ? auth.authValue.slice(0, 8) + "..." + auth.authValue.slice(-4)
    : "***";
  console.error(`  ${D("→")} Auth:      ${auth.authHeader}: ${maskedAuth}`);

  // Print env vars for Claude Code
  const models = saved?.models || provider.models;
  console.error(`\n  ${B("Set these env vars for Claude Code:")}\n`);
  console.error(`    export ANTHROPIC_BASE_URL='http://127.0.0.1:${proxy.port}/api'`);
  console.error(`    export ANTHROPIC_API_KEY=''`);
  console.error(`    export ANTHROPIC_DEFAULT_HAIKU_MODEL='${models.haiku || provider.models.haiku}'`);
  console.error(`    export ANTHROPIC_DEFAULT_SONNET_MODEL='${models.sonnet || provider.models.sonnet}'`);
  console.error(`    export ANTHROPIC_DEFAULT_OPUS_MODEL='${models.opus || provider.models.opus}'`);

  console.error(`\n  ${D("Or run directly:")} ${C(`claude-flow run -- claude -p 'Hello'`)}`);
  console.error(`\n  ${D("Press Ctrl+C to stop.")}\n`);

  // Wait for signal
  const shutdown = async () => {
    console.error(`\n  ${D("Shutting down proxy...")}`);
    await proxy.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// ── providers ───────────────────────────────────────────────────────

function cmdProviders() {
  console.log(`\n  ${B("Available Providers")}\n`);
  const active = config.getActiveProvider();
  for (const name of listProviders()) {
    const p = PROVIDERS[name];
    const marker = name === active ? G(" ●") : "  ";
    const auth = p.auth === "auth_token" ? "Bearer" : "API key";
    console.log(`  ${marker} ${B(name.padEnd(14))} ${p.description}`);
    console.log(`     ${D(`Auth: ${auth} | Base: ${p.baseUrl || "(custom)"} | Key env: ${p.envKey}`)}`);
  }
  console.log(`\n  ${D("● = active provider")}\n`);
}

// ── models ──────────────────────────────────────────────────────────

function cmdModels(providerName) {
  const name = providerName || config.getActiveProvider() || "openrouter";
  const provider = getProvider(name);
  if (!provider) {
    console.error(R(`Unknown provider "${name}".`));
    process.exit(1);
  }

  console.log(`\n  ${B(provider.name + " Models")}\n`);
  console.log(`  ${B("Default tier mapping:")}`);
  console.log(`    haiku  → ${provider.models.haiku}`);
  console.log(`    sonnet → ${provider.models.sonnet}`);
  console.log(`    opus   → ${provider.models.opus}`);

  if (provider.popularModels.length > 0) {
    console.log(`\n  ${B("Popular models:")}\n`);
    console.log(`    ${"Model ID".padEnd(40)} ${"Name".padEnd(24)} Tier`);
    console.log(`    ${"─".repeat(40)} ${"─".repeat(24)} ${"─".repeat(8)}`);
    for (const m of provider.popularModels) {
      console.log(`    ${m.id.padEnd(40)} ${m.name.padEnd(24)} ${D(m.tier)}`);
    }
  }
  console.log();
}

// ── status ──────────────────────────────────────────────────────────

function cmdStatus() {
  const cfg = config.load();
  const active = cfg.activeProvider;

  console.log(`\n  ${B("claude-flow status")}\n`);
  console.log(`  Config: ${D(config.getConfigPath())}`);
  console.log(`  Active: ${active ? B(active) : Y("none (run: claude-flow setup <provider>)")}\n`);

  if (Object.keys(cfg.providers).length === 0) {
    console.log(`  ${D("No providers configured yet.")}\n`);
    return;
  }

  for (const [name, pcfg] of Object.entries(cfg.providers)) {
    const provider = getProvider(name);
    const marker = name === active ? G("●") : D("○");
    const keyDisplay = pcfg.apiKey
      ? G(`${pcfg.apiKey.slice(0, 8)}...${pcfg.apiKey.slice(-4)}`)
      : R("not set");

    console.log(`  ${marker} ${B((provider?.name || name).padEnd(16))} Key: ${keyDisplay}`);
    if (pcfg.models) {
      console.log(`    ${D(`haiku=${pcfg.models.haiku}  sonnet=${pcfg.models.sonnet}  opus=${pcfg.models.opus}`)}`);
    }
  }
  console.log();
}

// ── switch ──────────────────────────────────────────────────────────

function cmdSwitch(providerName) {
  if (!providerName) {
    console.error(R("Specify a provider to switch to."));
    console.error(`Usage: ${B("claude-flow switch openrouter")}`);
    process.exit(1);
  }

  const saved = config.getProviderConfig(providerName);
  if (!saved?.apiKey) {
    console.error(R(`Provider "${providerName}" not configured.`));
    console.error(`Run: ${B(`claude-flow setup ${providerName}`)} first.`);
    process.exit(1);
  }

  config.setActiveProvider(providerName);
  const provider = getProvider(providerName);
  console.log(`${G("✓")} Switched to ${B(provider?.name || providerName)}`);
  console.log(`${D("  Run:")} eval $(claude-flow env)`);
}

// ── help ────────────────────────────────────────────────────────────

function cmdHelp() {
  console.log(`
  ${B("claude-flow")} — Use any LLM with Claude Code

  ${B("SETUP")}
    ${C("claude-flow setup openrouter")}     Configure OpenRouter as provider
    ${C("claude-flow setup deepseek")}       Configure DeepSeek
    ${C("claude-flow setup openai")}         Configure OpenAI
    ${C("claude-flow setup custom")}         Configure custom endpoint

  ${B("USE")}
    ${C('claude-flow run -- claude -p "Hi"')}   Run with sanitizing proxy (recommended)
    ${C("claude-flow run --no-proxy -- ...")}   Run without proxy (env vars only)
    ${C("claude-flow proxy")}                   Start standalone sanitizing proxy
    ${C("claude-flow proxy --port 8080")}       Proxy on specific port

  ${B("CONFIG")}
    ${C("eval $(claude-flow env)")}             Export env vars to current shell
    ${C("claude-flow switch openrouter")}       Switch active provider
    ${C("claude-flow status")}                  Show current config
    ${C("claude-flow providers")}               List all providers
    ${C("claude-flow models openrouter")}       Browse models

  ${B("PROXY")} ${D("(sanitizes Anthropic-internal types for non-Anthropic models)")}
    The sanitizing proxy sits between Claude Code and your provider,
    cleaning up internal content types (thinking blocks, tool_reference,
    server_tool_use, cache_control, $schema in tools) that would cause
    errors on non-Anthropic models.

    ${D("Automatically started with")} ${C("claude-flow run")}
    ${D("Use")} ${C("--no-proxy")} ${D("to disable (if your provider handles these natively)")}

  ${B("JS API")} ${D("(for integration with other tools)")}
    ${D("const { buildEnv, createProxy, getAuthConfig } = require('claude-flow');")}
    ${D("const proxy = await createProxy({ targetUrl, ...getAuthConfig('openrouter', key) });")}
    ${D("spawn('claude', args, { env: { ANTHROPIC_BASE_URL: proxy.url + '/api', ... } });")}

  ${D("https://github.com/Lexus2016/claude-flow")}
`);
}

// ── version ─────────────────────────────────────────────────────────

function cmdVersion() {
  const pkg = require("../package.json");
  console.log(`claude-flow v${pkg.version}`);
}

// ── Run ─────────────────────────────────────────────────────────────

main().catch((err) => {
  console.error(R(`Error: ${err.message}`));
  process.exit(1);
});
