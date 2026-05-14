# DeepCode

[![CI](https://github.com/N1ghthill/deepcode/actions/workflows/ci.yml/badge.svg)](https://github.com/N1ghthill/deepcode/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/deepcode-ai)](https://www.npmjs.com/package/deepcode-ai)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Terminal-first AI coding agent for local software development. Combines a multi-provider LLM runtime, a permission-aware tool execution model, and an Ink-based TUI so you can inspect, change, validate, and ship code from the command line.

## Features

- **Interactive TUI** — Ink-based terminal UI with real-time streaming, diff previews, approval flows, and Vim keybindings
- **Non-interactive mode** — headless `deepcode run` for scripting and CI pipelines
- **Multi-provider LLM** — Anthropic, OpenAI, DeepSeek, Groq, Ollama, OpenRouter, OpenCode — with automatic failover and per-mode routing
- **Tool system** — filesystem read/write, shell, ripgrep search, git, lint, test runners, LSP symbols
- **MCP support** — connect any [Model Context Protocol](https://modelcontextprotocol.io) server; tools appear automatically in the agent
- **GitHub integration** — authenticate, browse issues, manage pull requests, and run AI code review on any PR
- **Context window management** — auto-summarizes conversation history when approaching the model's context limit
- **Token budget** — configurable input/output/cost limits with warnings and hard stops
- **Safety model** — path allowlist/blacklist, per-operation permission levels, approval gateway, audit logging, secret redaction

## Supported Providers

| Provider | ID | Notes |
|---|---|---|
| Anthropic | `anthropic` | Claude 3.x / 4.x family |
| OpenAI | `openai` | GPT-4o, o3, o4-mini |
| DeepSeek | `deepseek` | deepseek-chat, deepseek-reasoner |
| Groq | `groq` | Fast inference, Llama / Mixtral |
| Ollama | `ollama` | Local models, no API key required |
| OpenRouter | `openrouter` | Unified access to 200+ models |
| OpenCode | `opencode` | opencode-go/ model prefix |

## Installation

```bash
npm install -g deepcode-ai
```

Or with pnpm:

```bash
pnpm add -g deepcode-ai
```

## Quick Start

```bash
deepcode init
deepcode config set defaultProvider deepseek
deepcode config set defaultModels.deepseek "deepseek-chat"
deepcode config set providers.deepseek.apiKey "sk-..."
deepcode doctor
deepcode
```

Or via environment variables:

```bash
export DEEPCODE_PROVIDER=anthropic
export DEEPCODE_MODEL=claude-sonnet-4-5
export ANTHROPIC_API_KEY="sk-ant-..."
deepcode
```

## Core Commands

```bash
# Interactive TUI
deepcode
deepcode chat

# Non-interactive task execution
deepcode run "fix the failing tests" --yes
deepcode run "refactor the auth module" --mode plan

# Configuration
deepcode config show --effective
deepcode config set defaultProvider openai
deepcode doctor

# GitHub
deepcode github login
deepcode github prs
deepcode github review 42
deepcode github merge 42

# Parallel subagents
deepcode subagents run \
  --task "audit the auth module" \
  --task "audit the billing module" \
  --concurrency 2 --yes
```

## MCP Servers

Add any MCP-compatible server to `~/.deepcode/config.json`:

```json
{
  "mcpServers": [
    { "name": "filesystem", "command": "npx", "args": ["-y", "@modelcontextprotocol/server-filesystem", "/tmp"] },
    { "name": "github",     "command": "npx", "args": ["-y", "@modelcontextprotocol/server-github"] }
  ]
}
```

Tools from connected servers appear automatically in the agent prefixed as `server__tool`.

## Safety Model

DeepCode acts on a real local repository, so safety is a first-class runtime concern:

- Path allowlist and blacklist enforcement
- Permission levels: `read`, `write`, `gitLocal`, `shell`, `dangerous`
- Approval gateway for sensitive operations with diff previews
- Audit logging of all tool calls
- Redaction of known secrets in logs and agent output

Full details: [docs/06-security-model.md](docs/06-security-model.md)

## Configuration

DeepCode stores config in `~/.deepcode/config.json`. Key fields:

```json
{
  "defaultProvider": "anthropic",
  "defaultModel": "claude-sonnet-4-5",
  "defaultModels": { "plan": "claude-opus-4-5" },
  "providerRetries": 2,
  "contextWindowThreshold": 0.8,
  "tokenBudget": { "maxCostUsd": 1.0, "warnAtFraction": 0.8 },
  "permissions": { "read": "allow", "write": "ask", "shell": "ask" },
  "mcpServers": []
}
```

Full reference: [docs/16-configuration.md](docs/16-configuration.md)

## Development

```bash
git clone https://github.com/N1ghthill/deepcode.git
cd deepcode
pnpm install
pnpm build
pnpm dev
```

Validation:

```bash
pnpm lint
pnpm typecheck
pnpm test
```

Repository layout:

- `apps/deepcode` — publishable CLI package and entrypoint
- `packages/cli` — commands and Ink TUI
- `packages/core` — agent runtime, providers, tools, GitHub, cache
- `packages/shared` — schemas, types, config contracts
- `docs` — product and engineering reference

## Documentation

- [Architecture Overview](docs/02-architecture-overview.md)
- [Configuration Reference](docs/16-configuration.md)
- [Tool System](docs/08-tool-system.md)
- [Security Model](docs/06-security-model.md)
- [Agent Loop](docs/09-agent-loop.md)
- [GitHub Integration](docs/10-github-integration.md)
- [Full docs index](docs/README.md)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Run `pnpm lint && pnpm typecheck && pnpm test` before opening a PR.

## License

[MIT](LICENSE)
