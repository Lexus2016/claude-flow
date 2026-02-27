# claude-flow

**Use any LLM with Claude Code** — OpenRouter, DeepSeek, OpenAI, Gemini, and more.

Claude Code is locked to Anthropic's API by default. **claude-flow** configures it to work with any provider through one command.

```bash
npx claude-flow setup openrouter
```

That's it. Now `claude -p "Hello"` uses your OpenRouter models.

---

## Why does this exist?

Claude Code supports proxy routing via environment variables, but the configuration is tricky:

```bash
# This is what Claude Code needs (and what claude-flow sets for you):
export ANTHROPIC_API_KEY=""              # Must be empty string, NOT absent!
export ANTHROPIC_AUTH_TOKEN="sk-or-..."  # Your OpenRouter key
export ANTHROPIC_BASE_URL="https://openrouter.ai/api"
export ANTHROPIC_DEFAULT_SONNET_MODEL="anthropic/claude-sonnet-4"
export ANTHROPIC_DEFAULT_OPUS_MODEL="anthropic/claude-opus-4"
export ANTHROPIC_DEFAULT_HAIKU_MODEL="anthropic/claude-haiku-4"
```

The gotcha: **`ANTHROPIC_API_KEY` must be `""` (empty string), not absent**. If you `unset` it, Claude Code errors out. If you leave your Anthropic key there, it ignores `AUTH_TOKEN`. This one detail breaks most setups.

**claude-flow** handles all of this correctly for every provider.

---

## Quick Start

### Install

```bash
# Option A: Run directly (no install needed)
npx claude-flow setup openrouter

# Option B: Install globally
npm install -g claude-flow
claude-flow setup openrouter
```

### Use

```bash
# Option 1: Run Claude Code through claude-flow
claude-flow run -- claude -p "Hello from OpenRouter!"

# Option 2: Export to your current shell session
eval $(claude-flow env)
claude -p "Hello from OpenRouter!"

# Option 3: Add to shell profile (permanent)
echo 'eval "$(claude-flow env)"' >> ~/.bashrc  # or ~/.zshrc
```

---

## Supported Providers

| Provider | Models | Auth | Command |
|----------|--------|------|---------|
| **OpenRouter** | 200+ models (Claude, GPT, Gemini, Llama, DeepSeek...) | Bearer token | `claude-flow setup openrouter` |
| **DeepSeek** | DeepSeek V3, R1 | API key | `claude-flow setup deepseek` |
| **OpenAI** | GPT-4.1, o3, o3-mini | API key | `claude-flow setup openai` |
| **Gemini** | Gemini 2.5 Pro/Flash | API key | `claude-flow setup gemini` |
| **Custom** | Any Anthropic-compatible API | Configurable | `claude-flow setup custom` |

### Why OpenRouter?

OpenRouter gives you **one API key for 200+ models**. Use Claude, GPT-4.1, Gemini, DeepSeek, Llama — all through the same endpoint. Switch models without switching providers.

---

## CLI Reference

```bash
claude-flow setup <provider>      # Interactive setup wizard
claude-flow env [provider]        # Print shell exports (for eval)
claude-flow run -- <command>      # Run command with provider env
claude-flow switch <provider>     # Switch active provider
claude-flow status                # Show current configuration
claude-flow providers             # List all providers
claude-flow models [provider]     # Browse available models
```

### Examples

```bash
# Set up OpenRouter with custom models
claude-flow setup openrouter
# → prompts for API key and model selection

# Use GPT-4.1 through OpenRouter
claude-flow setup openrouter
# During setup, set:
#   Sonnet model: openai/gpt-4.1-mini
#   Opus model:   openai/gpt-4.1

# Quick switch between providers
claude-flow switch openrouter
claude-flow switch deepseek

# See what's configured
claude-flow status
```

---

## JavaScript API

Use claude-flow as a library in your Node.js projects (like [Claude Code Studio](https://github.com/Lexus2016/claude-code-studio)):

```javascript
const { buildEnv, mergeEnv, getProvider } = require('claude-flow');

// Get env vars for a provider
const env = buildEnv('openrouter', {
  apiKey: 'sk-or-v1-...',
  sonnet: 'google/gemini-2.5-pro',
  opus:   'openai/gpt-4.1',
});
// Returns:
// {
//   ANTHROPIC_AUTH_TOKEN: 'sk-or-v1-...',
//   ANTHROPIC_API_KEY: '',
//   ANTHROPIC_BASE_URL: 'https://openrouter.ai/api',
//   ANTHROPIC_DEFAULT_HAIKU_MODEL: 'anthropic/claude-haiku-4',
//   ANTHROPIC_DEFAULT_SONNET_MODEL: 'google/gemini-2.5-pro',
//   ANTHROPIC_DEFAULT_OPUS_MODEL: 'openai/gpt-4.1',
// }

// Run Claude Code with provider env
const { spawn } = require('child_process');
const proc = spawn('claude', ['-p', 'Hello!'], {
  env: mergeEnv('openrouter', { apiKey: process.env.OPENROUTER_API_KEY }),
});

// Get provider info
const provider = getProvider('openrouter');
console.log(provider.popularModels);  // List of models with tier suggestions
```

### API Reference

| Function | Description |
|----------|-------------|
| `buildEnv(provider, opts)` | Build env vars object for Claude Code |
| `mergeEnv(provider, opts)` | Merge provider env into `process.env` |
| `toShellExports(env)` | Format env as `export KEY=value` statements |
| `getProvider(name)` | Get provider config by name |
| `listProviders()` | List available provider names |
| `config.load()` | Load saved configuration |
| `config.getActiveProvider()` | Get active provider name |

---

## How It Works

Claude Code CLI reads these environment variables for API routing:

| Variable | Purpose | Example |
|----------|---------|---------|
| `ANTHROPIC_BASE_URL` | API endpoint | `https://openrouter.ai/api` |
| `ANTHROPIC_AUTH_TOKEN` | Bearer token (proxy providers) | `sk-or-v1-...` |
| `ANTHROPIC_API_KEY` | API key (direct providers) or `""` for proxy | `""` |
| `ANTHROPIC_DEFAULT_HAIKU_MODEL` | Fast tier model | `anthropic/claude-haiku-4` |
| `ANTHROPIC_DEFAULT_SONNET_MODEL` | Balanced tier model | `google/gemini-2.5-pro` |
| `ANTHROPIC_DEFAULT_OPUS_MODEL` | Powerful tier model | `openai/gpt-4.1` |

### The Empty Key Trick

The critical detail that makes everything work:

```
ANTHROPIC_API_KEY=""              ← proxy providers (OpenRouter, etc.)
ANTHROPIC_AUTH_TOKEN="real-key"   ← actual authentication
```

- If `ANTHROPIC_API_KEY` is **absent**: Claude Code throws "no API key configured"
- If `ANTHROPIC_API_KEY` is **non-empty**: Claude Code uses it (ignores AUTH_TOKEN)
- If `ANTHROPIC_API_KEY` is **`""`** (empty string): Claude Code uses `ANTHROPIC_AUTH_TOKEN` ✅

---

## Configuration

Config is stored in `~/.claude-flow/config.json` with `0600` permissions (only you can read it).

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
    }
  }
}
```

---

## Integration with Other Tools

### Claude Code Studio

Add to your `claude-code-studio` config or use as a dependency:

```javascript
// In claude-cli.js
const { mergeEnv, config: cfConfig } = require('claude-flow');

const activeProvider = cfConfig.getActiveProvider();
const saved = cfConfig.getProviderConfig(activeProvider);

const proc = spawn(claudeBin, args, {
  env: saved
    ? mergeEnv(activeProvider, { apiKey: saved.apiKey, ...saved.models })
    : process.env,
});
```

### Docker / CI

```dockerfile
ENV OPENROUTER_API_KEY=sk-or-v1-...
RUN npx claude-flow setup openrouter --key $OPENROUTER_API_KEY
```

### Shell Profile

```bash
# ~/.bashrc or ~/.zshrc
eval "$(claude-flow env)"
```

---

## License

MIT — [CDZV](https://github.com/Lexus2016)
