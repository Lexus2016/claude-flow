#!/usr/bin/env node

/**
 * claude-flow CLI — Use any LLM with Claude Code
 *
 * Usage:
 *   claude-flow setup <provider>     Interactive setup
 *   claude-flow env [provider]       Print shell exports (for eval)
 *   claude-flow run -- <command>     Run a command with provider env
 *   claude-flow providers            List available providers
 *   claude-flow models [provider]    List popular models
 *   claude-flow status               Show current configuration
 *   claude-flow switch <provider>    Switch active provider
 */

const { spawn } = require("child_process");
const { createInterface } = require("readline");
const { buildEnv, toShellExports, mergeEnv } = require("../lib/env");
const { getProvider, listProviders, PROVIDERS } = require("../lib/providers");
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
  console.log(`    ${D("# Option 1: Run directly")}`);
  console.log(`    ${C("claude-flow run -- claude -p 'Hello from " + provider.name + "!'")}\n`);
  console.log(`    ${D("# Option 2: Add to your shell profile")}`);
  console.log(`    ${C('echo \'eval "$(claude-flow env)"\' >> ~/.bashrc')}\n`);
  console.log(`    ${D("# Option 3: One-time eval")}`);
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

function cmdRun(rawArgs) {
  // Find -- separator
  const dashIdx = rawArgs.indexOf("--");
  const providerArgs = dashIdx > 0 ? rawArgs.slice(0, dashIdx) : [];
  const cmdArgs = dashIdx >= 0 ? rawArgs.slice(dashIdx + 1) : rawArgs.slice(1);

  if (cmdArgs.length === 0) {
    console.error(R("No command specified."));
    console.error(`Usage: ${B("claude-flow run -- claude -p 'Hello'")}`);
    process.exit(1);
  }

  const providerName = providerArgs[0] || config.getActiveProvider();
  if (!providerName) {
    console.error(R("No active provider."));
    console.error(`Run: ${B("claude-flow setup <provider>")} first.`);
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

  // Spawn the command with provider env
  const child = spawn(cmdArgs[0], cmdArgs.slice(1), {
    env,
    stdio: "inherit",
    shell: process.platform === "win32",
  });

  child.on("exit", (code) => process.exit(code || 0));
  child.on("error", (err) => {
    console.error(R(`Failed to run: ${cmdArgs[0]}`));
    console.error(err.message);
    process.exit(1);
  });
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
    ${C('claude-flow run -- claude -p "Hi"')}   Run Claude Code with provider
    ${C("eval $(claude-flow env)")}             Export env vars to current shell
    ${C("claude-flow switch openrouter")}       Switch active provider

  ${B("INFO")}
    ${C("claude-flow status")}                  Show current config
    ${C("claude-flow providers")}               List all providers
    ${C("claude-flow models openrouter")}       Browse models

  ${B("JS API")} ${D("(for integration with other tools)")}
    ${D("const { buildEnv, mergeEnv } = require('claude-flow');")}
    ${D("const env = buildEnv('openrouter', { apiKey: '...' });")}
    ${D("spawn('claude', args, { env: mergeEnv('openrouter', { apiKey: '...' }) });")}

  ${B("HOW IT WORKS")}
    Claude Code natively supports env vars for API routing:
      ANTHROPIC_BASE_URL          → API endpoint
      ANTHROPIC_AUTH_TOKEN        → Bearer token (OpenRouter, etc.)
      ANTHROPIC_API_KEY           → Must be "" (empty) for proxy providers
      ANTHROPIC_DEFAULT_*_MODEL   → Model per tier (haiku/sonnet/opus)

    claude-flow configures these correctly for each provider.
    The key gotcha: ANTHROPIC_API_KEY must be ${B('""')} (empty string),
    not absent — otherwise Claude Code errors out.

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
