# Contributing to claude-flow

This is the Lexus2016 provider bridge, not the unrelated npm package named `claude-flow`. Install from GitHub as described in [README.md](README.md). The project uses the [MIT License](LICENSE).

Search [existing issues](https://github.com/Lexus2016/claude-flow/issues) first. Include the project/Node/Claude Code versions, OS and shell, provider, model, command and expected/actual behavior. Supply a minimal redacted error or reproduction.

Do not attach API keys, `~/.claude-flow/config.json`, raw shell exports or private prompts. Say whether the endpoint supports Anthropic's `/v1/messages` protocol; a provider entry alone does not verify compatibility.

Use Node.js 18 or newer. No runtime dependencies or build step are needed:

```bash
npm test
```

Tests cover configuration, sanitization, custom-provider CLI setup and local mock upstreams. They do not verify a live provider or current Claude Code release. Add focused regressions, keep translated commands/defaults consistent and report checks you could not run. Preserve the GitHub-only install warning; do not publish to the occupied npm package name.
