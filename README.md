# claude-flow

**Bridge any AI model to Claude Code CLI** — route through OpenRouter, DeepSeek, OpenAI, Gemini, or any Anthropic-compatible endpoint.

![Node](https://img.shields.io/badge/node-%3E%3D18.0-green) ![License](https://img.shields.io/badge/license-MIT-blue) ![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success)

Available in: **[English](README.md)** | [Українська](README_UA.md) | [Русский](README_RU.md)

---

## The Problem

Claude Code CLI is hardcoded for Anthropic's API. It sends requests in Anthropic's Messages API format, expects responses in that exact format, and authenticates using Anthropic's method. If you want to use **any other model** — DeepSeek, GPT-4, Gemini, GLM, Llama, Qwen — you hit three walls:

### 1. Response Format Incompatibility

Every AI provider has its own API format. DeepSeek, OpenAI, and Gemini use the OpenAI-compatible format. Chinese models (GLM, Qwen) have their own APIs. Open-source models (Llama, Mistral) each have unique response structures.

Claude Code expects Anthropic's **specific** streaming events (`content_block_delta`), content block types, `tool_use` structures, `stop_reason` values, and token counting fields. Send it a raw DeepSeek or OpenAI response — it crashes.

**The fix:** Providers like **OpenRouter** and **DeepSeek** offer **Anthropic-compatible proxy endpoints** — they accept requests in Anthropic format, route them to any model, and **translate the response back** into Anthropic format. claude-flow knows exactly which endpoints to use for each provider.

### 2. Authentication Trap

Claude Code's auth has an **undocumented quirk**: `ANTHROPIC_API_KEY` must be set to an **empty string** (`""`) for proxy providers — not absent, not unset. Specifically an empty string.

- If `ANTHROPIC_API_KEY` is **absent** → Claude Code errors out on startup
- If `ANTHROPIC_API_KEY` is **non-empty** → Claude Code uses it and silently ignores your proxy token
- If `ANTHROPIC_API_KEY` is **`""`** → Claude Code falls back to `ANTHROPIC_AUTH_TOKEN` ✓

Different providers also use different auth methods — Bearer token (OpenRouter) vs. API key header (DeepSeek, OpenAI). Getting any of this wrong means silent failures.

### 3. Configuration Complexity

6 environment variables, zero official documentation, different combinations for each provider, and non-obvious behaviors. One wrong setting = Claude Code either crashes or silently talks to the wrong endpoint.

**claude-flow solves all three.** One command configures everything correctly for any provider.

---

## Quick Start

```bash
# Install
npm install -g claude-flow

# Setup your provider (interactive)
claude-flow setup openrouter

# Run Claude Code
eval $(claude-flow env)
claude -p "Hello from OpenRouter!"
```

That's it. Now Claude Code uses your provider for every invocation.

---

## Installation

### Option 1: Global NPM (recommended)

```bash
npm install -g claude-flow
```

### Option 2: Run without installing (npx)

```bash
npx claude-flow setup openrouter
npx claude-flow run -- claude -p "Hello!"
```

### Option 3: Clone and use locally

```bash
git clone https://github.com/Lexus2016/claude-flow.git
cd claude-flow
node bin/claude-flow.js setup openrouter
```

### Requirements

- **Node.js** >= 18.0
- **Claude Code CLI** (from Anthropic) — [install here](https://claude.ai/claude-code)
- An API key for your chosen provider (see [Supported Providers](#supported-providers))

---

## Step-by-Step Setup

### 1. Install claude-flow

```bash
npm install -g claude-flow
```

### 2. Run the interactive setup

```bash
claude-flow setup openrouter
```

You'll be prompted for:
- Your API key for the provider (e.g., `sk-or-v1-...`)
- Model preferences for each tier (haiku, sonnet, opus) — or press Enter for defaults

**Example session:**

```
  claude-flow — Setup OpenRouter

  Get your API key: https://openrouter.ai/keys

  API Key: sk-or-v1-abc123def456...

  Model configuration (press Enter for defaults)

  Claude Code uses 3 model tiers: haiku (fast), sonnet (balanced), opus (powerful)

  Popular models for OpenRouter:
    anthropic/claude-sonnet-4             sonnet
    anthropic/claude-opus-4               opus
    anthropic/claude-haiku-4              haiku
    google/gemini-2.5-pro                 opus
    deepseek/deepseek-chat                sonnet

  Haiku model  [anthropic/claude-haiku-4]:
  Sonnet model [anthropic/claude-sonnet-4]:
  Opus model   [anthropic/claude-opus-4]:

  ✓ Configuration saved to /Users/you/.claude-flow/config.json
  ✓ Active provider: OpenRouter

  Environment variables (what Claude Code will use):

    ANTHROPIC_BASE_URL                 https://openrouter.ai/api
    ANTHROPIC_AUTH_TOKEN              sk-or-v1-abc...
    ANTHROPIC_API_KEY                 ""  ← intentionally empty
    ANTHROPIC_DEFAULT_HAIKU_MODEL     anthropic/claude-haiku-4
    ANTHROPIC_DEFAULT_SONNET_MODEL    anthropic/claude-sonnet-4
    ANTHROPIC_DEFAULT_OPUS_MODEL      anthropic/claude-opus-4

  Quick start:

    # Option 1: Run directly
    claude-flow run -- claude -p 'Hello from OpenRouter!'

    # Option 2: Add to your shell profile
    echo 'eval "$(claude-flow env)"' >> ~/.bashrc

    # Option 3: One-time eval
    eval $(claude-flow env)
```

### 3. Use Claude Code with your provider

Choose one of three methods:

#### Method 1: Run directly (recommended for one-off commands)

```bash
claude-flow run -- claude -p "What is the weather?"
```

#### Method 2: Eval to current shell (recommended for interactive work)

```bash
eval $(claude-flow env)
claude -p "Build me a React component"
```

#### Method 3: Add to shell profile (recommended for permanent setup)

```bash
# Add to ~/.bashrc, ~/.zshrc, or ~/.fish/config.fish
echo 'eval "$(claude-flow env)"' >> ~/.bashrc

# Then reload your shell
source ~/.bashrc

# Now Claude Code works everywhere
claude -p "Hello!"
```

---

## Supported Providers

### Quick Comparison

| Provider | Model Selection | Cost | Setup | Popular For |
|----------|-----------------|------|-------|------------|
| **OpenRouter** | 200+ models from all providers | Varies | Easy | One API for everything |
| **DeepSeek** | V3, R1 (reasoning) | Cheapest | Easy | Cost-effective reasoning |
| **OpenAI** | GPT-4.1, o3 | Premium | Easy | Cutting-edge models |
| **Gemini** | Gemini 2.5 Pro/Flash | Competitive | Easy | Fast inference |
| **Custom** | Any Anthropic-compatible endpoint | Varies | Manual | Self-hosted, private clouds |

---

## Provider Details

### OpenRouter

**Access 200+ models from a single API endpoint.**

Perfect if you want flexibility — use Claude, GPT-4, DeepSeek, Gemini, Llama, Qwen, and more with a single key. Pay per use.

**Get API key:** https://openrouter.ai/keys

**Setup:**

```bash
claude-flow setup openrouter
```

**Default models:**
- Haiku: `anthropic/claude-haiku-4`
- Sonnet: `anthropic/claude-sonnet-4`
- Opus: `anthropic/claude-opus-4`

**Popular models to try:**

```bash
claude-flow models openrouter
```

```
  Default tier mapping:
    haiku  → anthropic/claude-haiku-4
    sonnet → anthropic/claude-sonnet-4
    opus   → anthropic/claude-opus-4

  Popular models:

    Model ID                                 Name                     Tier
    ─────────────────────────────────────────────────────────────────────
    anthropic/claude-sonnet-4                Claude Sonnet 4          sonnet
    anthropic/claude-opus-4                  Claude Opus 4            opus
    anthropic/claude-haiku-4                 Claude Haiku 4           haiku
    google/gemini-2.5-pro                    Gemini 2.5 Pro           opus
    google/gemini-2.5-flash                  Gemini 2.5 Flash         sonnet
    openai/gpt-4.1                           GPT-4.1                  opus
    openai/gpt-4.1-mini                      GPT-4.1 Mini             sonnet
    openai/gpt-4.1-nano                      GPT-4.1 Nano             haiku
    deepseek/deepseek-r1                     DeepSeek R1              opus
    deepseek/deepseek-chat                   DeepSeek V3              sonnet
    meta-llama/llama-4-maverick              Llama 4 Maverick         sonnet
    z-ai/glm-5                               GLM-5                    opus
    z-ai/glm-4.5-air                         GLM-4.5 Air              haiku
    mistralai/mistral-large                  Mistral Large            sonnet
    qwen/qwen3-235b-a22b                     Qwen3 235B               opus
```

**Use different model per tier:**

```bash
claude-flow setup openrouter

# When prompted:
# Haiku model: google/gemini-2.5-flash
# Sonnet model: deepseek/deepseek-chat
# Opus model: openai/gpt-4.1
```

---

### DeepSeek

**Ultra-fast and cheap. Great for reasoning tasks.**

DeepSeek V3 (fast) and R1 (reasoning) through their native API. Single digit cent costs.

**Get API key:** https://platform.deepseek.com/api_keys

**Setup:**

```bash
claude-flow setup deepseek
```

**Default models:**
- Haiku: `deepseek-chat`
- Sonnet: `deepseek-chat`
- Opus: `deepseek-reasoner`

**Why use DeepSeek?**
- Cheapest LLM pricing available
- DeepSeek R1 reasoning model beats GPT-4 on many benchmarks
- Native API (no proxy markup)

**Use R1 for reasoning:**

```bash
claude-flow setup deepseek
# When prompted for Sonnet and Opus, use: deepseek-reasoner
```

---

### OpenAI

**Latest GPT models, including o3.**

GPT-4.1 and o3 (reasoning) through OpenAI's official API.

**Get API key:** https://platform.openai.com/api-keys

**Setup:**

```bash
claude-flow setup openai
```

**Default models:**
- Haiku: `gpt-4.1-nano`
- Sonnet: `gpt-4.1-mini`
- Opus: `gpt-4.1`

**Popular models:**

```bash
claude-flow models openai
```

```
  Default tier mapping:
    haiku  → gpt-4.1-nano
    sonnet → gpt-4.1-mini
    opus   → gpt-4.1

  Popular models:

    Model ID                                 Name                     Tier
    ─────────────────────────────────────────────────────────────────────
    gpt-4.1                                  GPT-4.1                  opus
    gpt-4.1-mini                             GPT-4.1 Mini             sonnet
    gpt-4.1-nano                             GPT-4.1 Nano             haiku
    o3                                       o3                       opus
    o3-mini                                  o3 Mini                  sonnet
```

---

### Gemini

**Google's latest models. Fast and capable.**

Gemini 2.5 Pro and Flash through Google's API.

**Get API key:** https://aistudio.google.com/apikey

**Setup:**

```bash
claude-flow setup gemini
```

**Default models:**
- Haiku: `gemini-2.5-flash`
- Sonnet: `gemini-2.5-pro`
- Opus: `gemini-2.5-pro`

---

### Custom Provider

**Any Anthropic-compatible endpoint (self-hosted, private clouds, etc.).**

If you have your own Claude-compatible endpoint, or want to use a provider not listed above:

```bash
claude-flow setup custom
```

You'll be prompted for:
- API base URL (e.g., `https://your-proxy.local/v1`)
- Model IDs
- API key

---

## CLI Reference

### Help

```bash
claude-flow help
```

Shows all commands and examples.

---

### Setup

```bash
claude-flow setup <provider>
```

Interactive setup wizard. Guides you through getting an API key and choosing models.

**Providers:** `openrouter`, `deepseek`, `openai`, `gemini`, `custom`

**Examples:**

```bash
claude-flow setup openrouter
claude-flow setup deepseek
claude-flow setup openai
```

---

### Env

Print shell export statements. Used for eval or adding to your shell profile.

```bash
# Print to stdout (copy-paste friendly)
claude-flow env

# Or use in a command
eval $(claude-flow env)

# Or for a specific provider
claude-flow env deepseek
eval $(claude-flow env deepseek)
```

**Output example:**

```bash
export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
export ANTHROPIC_API_KEY=''
export ANTHROPIC_DEFAULT_HAIKU_MODEL='anthropic/claude-haiku-4'
export ANTHROPIC_DEFAULT_SONNET_MODEL='anthropic/claude-sonnet-4'
export ANTHROPIC_DEFAULT_OPUS_MODEL='anthropic/claude-opus-4'
```

---

### Run

Run a command with provider environment variables set.

```bash
claude-flow run -- <command> [args...]
```

The `--` separator is important — everything after it is your command.

**Examples:**

```bash
# Run Claude Code once with OpenRouter
claude-flow run -- claude -p "Hello from OpenRouter!"

# Run with a different provider
claude-flow run deepseek -- claude -p "Use DeepSeek for this"

# Run any command (not just Claude)
claude-flow run -- node my-script.js
claude-flow run -- python my-app.py

# Chain with other commands
claude-flow run -- bash -c 'echo $ANTHROPIC_BASE_URL && claude -p "Test"'
```

---

### Status

Show current configuration and active provider.

```bash
claude-flow status
```

**Output example:**

```
  claude-flow status

  Config: /Users/you/.claude-flow/config.json
  Active: openrouter

  ● OpenRouter         Key: sk-or-v1-abc...def
    haiku=anthropic/claude-haiku-4  sonnet=anthropic/claude-sonnet-4  opus=anthropic/claude-opus-4
  ○ DeepSeek           Key: sk-...xyz
    haiku=deepseek-chat  sonnet=deepseek-chat  opus=deepseek-reasoner
```

---

### Switch

Switch to a different provider (must be configured first).

```bash
claude-flow switch <provider>
```

**Examples:**

```bash
claude-flow switch deepseek
# Now eval $(claude-flow env) will use DeepSeek
```

---

### Providers

List all available providers with details.

```bash
claude-flow providers
```

**Output:**

```
  Available Providers

  ● openrouter       200+ models from every major provider through one API
     Auth: Bearer | Base: https://openrouter.ai/api | Key env: OPENROUTER_API_KEY
  ○ deepseek         DeepSeek models via native Anthropic-compatible API
     Auth: API key | Base: https://api.deepseek.com/anthropic | Key env: DEEPSEEK_API_KEY
  ○ openai           OpenAI models (GPT-4.1, o3, etc.)
     Auth: API key | Base: https://api.openai.com/v1 | Key env: OPENAI_API_KEY
  ○ gemini           Gemini models via OpenAI-compatible endpoint
     Auth: API key | Base: https://generativelanguage.googleapis.com/v1beta | Key env: GEMINI_API_KEY
  ○ custom           Any Anthropic-compatible API endpoint
     Auth: Bearer | Base: (custom) | Key env: CUSTOM_API_KEY

  ● = active provider
```

---

### Models

Browse available models for a provider.

```bash
claude-flow models [provider]
```

If provider is omitted, shows models for the active provider.

**Example:**

```bash
claude-flow models openrouter
claude-flow models deepseek
```

---

### Version

Show installed version.

```bash
claude-flow --version
# or
claude-flow -v
```

---

## How It Works

### Architecture

```
Without claude-flow:
  Claude Code CLI → Anthropic API → Claude models only
                                     (no other models possible)

With claude-flow:
  ┌─────────────┐    Anthropic    ┌──────────────────────┐    Native    ┌──────────────┐
  │ Claude Code │ ── Messages ──→ │ Provider's           │ ── API ───→ │ Any Model    │
  │ CLI         │    API format   │ Anthropic-compatible │    call      │              │
  │             │ ←─ Anthropic ── │ endpoint             │ ←─ Native ─ │ GPT, GLM,    │
  │             │    format       │                      │    format    │ Llama, Qwen, │
  └─────────────┘                 │ TRANSLATES responses │              │ DeepSeek,    │
                                  │ between formats      │              │ Gemini, ...  │
                                  └──────────────────────┘              └──────────────┘
                                            ▲
                                   claude-flow configures
                                   this connection correctly
```

**The key insight:** Claude Code doesn't need to talk to models directly. It talks to an **Anthropic-compatible proxy endpoint** that handles the format translation. OpenRouter translates 200+ models into Anthropic format. DeepSeek's `/anthropic` endpoint does the same. claude-flow knows which endpoint to use for each provider and configures Claude Code to connect there.

### What Providers Do Behind the Scenes

When you use `z-ai/glm-5` through OpenRouter:

1. Claude Code sends an Anthropic Messages API request to `https://openrouter.ai/api/v1/messages`
2. OpenRouter receives the request, translates it to GLM-5's native format
3. GLM-5 processes and returns a response in its own format
4. OpenRouter **translates the response back** into Anthropic Messages API format
5. Claude Code receives a response it understands — streaming events, content blocks, tool_use, everything

Without this translation, Claude Code gets a response in the wrong format and crashes.

### The Environment Variables

Claude Code reads these env vars to determine which API to use:

| Env Var | Purpose | Example |
|---------|---------|---------|
| `ANTHROPIC_BASE_URL` | API endpoint (where requests go) | `https://openrouter.ai/api` |
| `ANTHROPIC_AUTH_TOKEN` | Bearer token (proxy providers) | `sk-or-v1-...` |
| `ANTHROPIC_API_KEY` | API key (direct providers) or `""` | `sk-...` or `""` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Fast tier model | `anthropic/claude-haiku-4` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Balanced tier model | `anthropic/claude-sonnet-4` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Powerful tier model | `anthropic/claude-opus-4` |

### The Empty Key Trick

**`ANTHROPIC_API_KEY` must be set to an empty string (`""`) for proxy providers, not absent or unset.**

This is the most common failure point when configuring Claude Code with alternative providers.

#### Why?

- If `ANTHROPIC_API_KEY` is **absent/unset**: Claude Code errors trying to read it
- If `ANTHROPIC_API_KEY` is **non-empty**: Claude Code uses it and ignores `ANTHROPIC_AUTH_TOKEN`
- If `ANTHROPIC_API_KEY` is **empty string (`""`)**: Claude Code falls back to `ANTHROPIC_AUTH_TOKEN`

#### Example: OpenRouter (uses auth_token)

```bash
# ✓ CORRECT — Claude Code uses AUTH_TOKEN for OpenRouter
export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
export ANTHROPIC_API_KEY=''  # Empty string, not absent!
export ANTHROPIC_DEFAULT_SONNET_MODEL='anthropic/claude-sonnet-4'

# ✗ WRONG — Missing API_KEY, Claude Code errors
export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
# (no ANTHROPIC_API_KEY set at all)

# ✗ WRONG — Non-empty API_KEY, Claude Code ignores AUTH_TOKEN
export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
export ANTHROPIC_API_KEY='some-random-value'
```

#### Example: DeepSeek (uses api_key directly)

```bash
# ✓ CORRECT — Claude Code uses API_KEY for DeepSeek
export ANTHROPIC_BASE_URL='https://api.deepseek.com/anthropic'
export ANTHROPIC_API_KEY='sk-...'  # The actual key
export ANTHROPIC_DEFAULT_SONNET_MODEL='deepseek-chat'
```

### How claude-flow Gets It Right

The `buildEnv()` function in `lib/env.js`:

1. **Selects the correct endpoint** that handles format translation for each provider
2. **For proxy providers** (OpenRouter): Sets `ANTHROPIC_API_KEY = ""` and `ANTHROPIC_AUTH_TOKEN = apiKey`
3. **For direct providers** (DeepSeek, OpenAI): Sets `ANTHROPIC_API_KEY = apiKey` (their endpoints accept Anthropic format natively)
4. **Maps models to tiers** — sets `ANTHROPIC_DEFAULT_HAIKU/SONNET/OPUS_MODEL`
5. **Returns a complete env object** ready to pass to Claude Code — no guesswork, no gotchas

---

## Configuration

Configuration is stored in **`~/.claude-flow/config.json`** (600 permissions — owner read/write only).

### File Format

```json
{
  "activeProvider": "openrouter",
  "providers": {
    "openrouter": {
      "apiKey": "sk-or-v1-...",
      "models": {
        "haiku": "anthropic/claude-haiku-4",
        "sonnet": "anthropic/claude-sonnet-4",
        "opus": "anthropic/claude-opus-4"
      }
    },
    "deepseek": {
      "apiKey": "sk-...",
      "models": {
        "haiku": "deepseek-chat",
        "sonnet": "deepseek-chat",
        "opus": "deepseek-reasoner"
      }
    }
  }
}
```

### Manual Editing

You can edit this file directly. Just remember:
- Keep it secure (contains API keys)
- Use valid JSON
- Restart your shell for changes to take effect

### Environment Variable Override

You can also set API keys via environment variables without using the config file:

```bash
export OPENROUTER_API_KEY='sk-or-v1-...'
export DEEPSEEK_API_KEY='sk-...'

# Then use claude-flow with those keys
claude-flow run -- claude -p "Hello"
```

---

## JavaScript API

Use claude-flow as a library in your Node.js projects (e.g., Claude Code Studio, build tools, CI/CD).

### Installation

```bash
npm install claude-flow
```

### API Overview

```javascript
const {
  buildEnv,
  toShellExports,
  mergeEnv,
  getProvider,
  listProviders,
  PROVIDERS,
  config,
} = require('claude-flow');
```

### `buildEnv(provider, opts)`

Build environment variables for Claude Code.

**Arguments:**
- `provider` (string): Provider name (`openrouter`, `deepseek`, `openai`, `gemini`, `custom`)
- `opts` (object):
  - `apiKey` (string, required): Provider API key
  - `haiku` (string): Model for haiku tier (overrides default)
  - `sonnet` (string): Model for sonnet tier (overrides default)
  - `opus` (string): Model for opus tier (overrides default)
  - `model` (string): Use same model for all tiers (shorthand)
  - `baseUrl` (string): Override API base URL (custom providers only)

**Returns:** Object with env vars

**Example:**

```javascript
const { buildEnv } = require('claude-flow');

// Use default models
const env = buildEnv('openrouter', {
  apiKey: 'sk-or-v1-abc123...'
});

console.log(env);
// {
//   ANTHROPIC_BASE_URL: 'https://openrouter.ai/api',
//   ANTHROPIC_AUTH_TOKEN: 'sk-or-v1-abc123...',
//   ANTHROPIC_API_KEY: '',
//   ANTHROPIC_DEFAULT_HAIKU_MODEL: 'anthropic/claude-haiku-4',
//   ANTHROPIC_DEFAULT_SONNET_MODEL: 'anthropic/claude-sonnet-4',
//   ANTHROPIC_DEFAULT_OPUS_MODEL: 'anthropic/claude-opus-4'
// }
```

**Custom models:**

```javascript
const env = buildEnv('openrouter', {
  apiKey: 'sk-or-v1-...',
  haiku: 'google/gemini-2.5-flash',
  sonnet: 'deepseek/deepseek-chat',
  opus: 'openai/gpt-4.1'
});
```

**Single model for all tiers:**

```javascript
const env = buildEnv('openrouter', {
  apiKey: 'sk-or-v1-...',
  model: 'deepseek/deepseek-chat'  // All tiers use this
});
```

**Custom endpoint:**

```javascript
const env = buildEnv('custom', {
  apiKey: 'sk-custom-key',
  baseUrl: 'https://your-proxy.local/v1',
  haiku: 'your-model-haiku',
  sonnet: 'your-model-sonnet',
  opus: 'your-model-opus'
});
```

---

### `mergeEnv(provider, opts)`

Build provider env vars and merge them into `process.env`. Returns a new object (doesn't mutate `process.env`).

Useful for `spawn()` with custom env.

**Example:**

```javascript
const { spawn } = require('child_process');
const { mergeEnv } = require('claude-flow');

const env = mergeEnv('openrouter', {
  apiKey: 'sk-or-v1-...'
});

// Run Claude Code with OpenRouter
const child = spawn('claude', ['-p', 'Hello!'], {
  env,  // Use the merged env
  stdio: 'inherit'
});
```

---

### `toShellExports(env)`

Format env vars as shell export statements.

**Arguments:**
- `env` (object): Env object from `buildEnv()`

**Returns:** String with shell exports (one per line)

**Example:**

```javascript
const { buildEnv, toShellExports } = require('claude-flow');

const env = buildEnv('openrouter', { apiKey: 'sk-or-v1-...' });
const shellScript = toShellExports(env);

console.log(shellScript);
// export ANTHROPIC_BASE_URL='https://openrouter.ai/api'
// export ANTHROPIC_AUTH_TOKEN='sk-or-v1-...'
// export ANTHROPIC_API_KEY=''
// export ANTHROPIC_DEFAULT_HAIKU_MODEL='anthropic/claude-haiku-4'
// export ANTHROPIC_DEFAULT_SONNET_MODEL='anthropic/claude-sonnet-4'
// export ANTHROPIC_DEFAULT_OPUS_MODEL='anthropic/claude-opus-4'
```

---

### `getProvider(name)`

Get provider configuration by name.

**Arguments:**
- `name` (string): Provider name or alias (`openrouter`, `or`, `deepseek`, `ds`, `openai`, `gpt`, `gemini`, `custom`)

**Returns:** Provider config object, or `null` if unknown

**Example:**

```javascript
const { getProvider } = require('claude-flow');

const provider = getProvider('openrouter');
console.log(provider);
// {
//   name: 'OpenRouter',
//   description: '200+ models from every major provider...',
//   envKey: 'OPENROUTER_API_KEY',
//   baseUrl: 'https://openrouter.ai/api',
//   auth: 'auth_token',
//   models: { haiku: '...', sonnet: '...', opus: '...' },
//   docsUrl: 'https://openrouter.ai/keys',
//   popularModels: [...]
// }
```

---

### `listProviders()`

List all provider names (excludes aliases).

**Returns:** Array of provider names

**Example:**

```javascript
const { listProviders } = require('claude-flow');

console.log(listProviders());
// ['openrouter', 'deepseek', 'openai', 'gemini', 'custom']
```

---

### `PROVIDERS`

Direct access to the provider configurations object.

**Example:**

```javascript
const { PROVIDERS } = require('claude-flow');

console.log(PROVIDERS.openrouter.docsUrl);
// 'https://openrouter.ai/keys'

console.log(PROVIDERS.openrouter.popularModels);
// [{ id: 'anthropic/claude-sonnet-4', name: '...', tier: 'sonnet' }, ...]
```

---

### `config`

Config file management (for integration with other tools).

**Methods:**

- `config.load()` — Load entire config from disk
- `config.save(cfg)` — Save config to disk
- `config.getActiveProvider()` — Get active provider name
- `config.setActiveProvider(name)` — Set active provider
- `config.getProviderConfig(name)` — Get settings for a provider
- `config.setProviderConfig(name, settings)` — Save settings for a provider
- `config.getConfigPath()` — Get config file path

**Example:**

```javascript
const { config } = require('claude-flow');

const activeProvider = config.getActiveProvider();
const settings = config.getProviderConfig(activeProvider);

console.log(settings.apiKey);    // The saved API key
console.log(settings.models);    // { haiku: '...', sonnet: '...', opus: '...' }
```

---

## Integration Examples

### Claude Code Studio

[Claude Code Studio](https://github.com/Lexus2016/claude-code-studio) uses claude-flow to let you choose LLM providers in the UI.

```javascript
const { buildEnv, PROVIDERS } = require('claude-flow');

// In your app, let user pick a provider
const selectedProvider = 'openrouter';
const apiKey = user.apiKeys[selectedProvider];

// Build env vars
const env = buildEnv(selectedProvider, { apiKey });

// Pass to Claude Code subprocess
spawn('claude', args, { env: mergeEnv(selectedProvider, { apiKey }) });
```

### Docker / CI-CD

Use claude-flow in your Docker container to route to any LLM:

```dockerfile
FROM node:18-slim

RUN npm install -g claude-flow

WORKDIR /app
COPY . .

# Run Claude Code with provider from env
CMD ["sh", "-c", "eval $(claude-flow env) && claude -p 'Your prompt'"]
```

**Build and run:**

```bash
docker build -t my-app .

docker run --env OPENROUTER_API_KEY='sk-or-v1-...' my-app
```

Or use `docker-compose.yml`:

```yaml
version: '3'
services:
  app:
    build: .
    environment:
      OPENROUTER_API_KEY: ${OPENROUTER_API_KEY}
      ANTHROPIC_DEFAULT_SONNET_MODEL: deepseek/deepseek-chat
```

### Shell Profile (Permanent)

Add to your `~/.bashrc`, `~/.zshrc`, or `~/.fish/config.fish`:

```bash
# Activate Claude Code provider
eval "$(claude-flow env)"
```

Now Claude Code will use your configured provider for every invocation in new shells.

**Reload your shell:**

```bash
source ~/.bashrc  # or ~/.zshrc, etc.
```

---

## Troubleshooting

### "Unknown command"

Make sure claude-flow is installed and in your PATH:

```bash
which claude-flow
# If empty, install:
npm install -g claude-flow
```

### "No active provider"

You haven't run setup yet:

```bash
claude-flow setup openrouter
# or another provider
```

### "No API key for provider"

The provider is configured but the API key wasn't saved. Run setup again:

```bash
claude-flow setup openrouter
```

Or manually add the key to `~/.claude-flow/config.json`.

### Claude Code still uses Anthropic's API

Make sure you've:
1. Run `claude-flow setup <provider>`
2. Either:
   - Run `eval $(claude-flow env)` in your current shell
   - Or use `claude-flow run -- claude ...` to run Claude Code once
   - Or add `eval "$(claude-flow env)"` to your shell profile and restart

Check your active provider:

```bash
claude-flow status
```

### "Key doesn't start with expected prefix"

This is a warning, not an error. It means your API key doesn't match the expected format for that provider. Double-check it's the right key:

- OpenRouter keys start with `sk-or-`
- DeepSeek keys start with `sk-`
- OpenAI keys start with `sk-`
- Gemini keys start with `AI`

If you're sure it's correct, you can ignore the warning.

### Custom provider not working

For custom endpoints, make sure:
1. The base URL includes `/v1` or the full path to the API (e.g., `https://your-proxy.local/v1`)
2. The model IDs are valid for your endpoint
3. Your API key is correct

Run:

```bash
claude-flow status
```

And verify all settings.

### "ANTHROPIC_API_KEY" related errors

If Claude Code errors with "invalid API key" or similar, it might be using the wrong auth method. Check what you configured:

```bash
claude-flow env
```

Look at the output:
- If you see `ANTHROPIC_AUTH_TOKEN` = (not empty) and `ANTHROPIC_API_KEY` = `''` (empty quotes) → You're using a proxy provider correctly ✓
- If you see `ANTHROPIC_API_KEY` = (your key) and no `ANTHROPIC_AUTH_TOKEN` → You're using a direct provider ✓
- If you see both with values → There's a conflict, reconfigure

---

## Testing

Run the test suite:

```bash
npm test
```

Tests cover:
- Provider configuration loading
- Environment variable building for each provider
- The critical "empty string" behavior for proxy providers
- Shell export formatting
- Custom model overrides
- Error handling

All tests pass with zero external dependencies.

---

## How to Contribute

1. **Fork** the repo
2. **Create a branch** for your feature
3. **Write tests** for new functionality
4. **Submit a pull request**

### Adding a new provider

1. Add to `PROVIDERS` in `lib/providers.js`
2. Include `name`, `description`, `envKey`, `baseUrl`, `auth` type, default `models`, and `docsUrl`
3. Add test cases in `test/test.js`
4. Update this README with the provider section

---

## License

MIT — See LICENSE file

---

## Related Projects

- **[Claude Code CLI](https://claude.ai/claude-code)** — The CLI we're configuring
- **[Claude Code Studio](https://github.com/Lexus2016/claude-code-studio)** — IDE that uses claude-flow
- **[OpenRouter](https://openrouter.ai)** — Access 200+ models
- **[DeepSeek Platform](https://platform.deepseek.com)** — Ultra-cheap reasoning models

---

## Support

- **GitHub Issues:** Report bugs or request features at https://github.com/Lexus2016/claude-flow/issues
- **Discussions:** https://github.com/Lexus2016/claude-flow/discussions
- **Author:** CDZV — Code Zero Digital Visual Trading

---

Made with love for developers who want to use any LLM with Claude Code.
