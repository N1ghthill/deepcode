# DeepCode

DeepCode is a terminal-first AI coding agent for local software development. It combines a multi-provider agent runtime, a permission-aware execution model, and an Ink-based TUI so you can inspect, change, validate, and ship code from the command line.

## Product Scope

- Terminal UI and non-interactive task execution
- Local filesystem, search, shell, git, lint, test, and code-analysis tools
- Multi-provider LLM support with provider/model routing for `PLAN` and `BUILD`
- Permission gating, audit logging, path policy, and redaction of known secrets
- Persistent sessions, local cache, and telemetry
- GitHub issue, authentication, and pull request workflows

## Repository Layout

- `apps/deepcode`: publishable CLI package and executable entrypoint
- `packages/cli`: command surface and Ink TUI
- `packages/core`: agent runtime, providers, tools, security, GitHub, cache, and workflows
- `packages/shared`: schemas, types, and config contracts shared across packages
- `docs`: product, operator, and engineering reference material

## Requirements

- Node.js 20+
- pnpm 9+
- `git`
- `rg`
- provider credentials for real agent usage

## Quick Start

```bash
pnpm install
pnpm build
pnpm --filter deepcode exec deepcode init
cp .env.example .env
pnpm dev
```

DeepCode stores local state in `.deepcode/`. Start by configuring one provider and one model:

```bash
deepcode config set defaultProvider deepseek
deepcode config set defaultModels.deepseek "deepseek-v4-flash"
deepcode config set providers.deepseek.apiKey "..."
deepcode doctor
```

You can also use environment variables:

```bash
export DEEPCODE_PROVIDER=deepseek
export DEEPCODE_MODEL=deepseek-v4-flash
export DEEPSEEK_API_KEY="..."
```

## Core Commands

```bash
deepcode
deepcode chat
deepcode run "inspect the repo and summarize the package boundaries" --mode plan
deepcode run "fix the failing test and run the relevant suite" --yes
deepcode doctor
deepcode config show --effective
deepcode github login --client-id "<oauth-client-id>" --scope repo
deepcode subagents run --task "inspect auth" --task "inspect billing" --concurrency 2 --yes
```

## Safety Model

DeepCode is built to act on a real local repository, so product safety is part of the core runtime:

- path allowlist and blacklist enforcement
- permission levels for read, write, git, shell, and dangerous actions
- approval flow for sensitive operations
- audit logging
- redaction of known secrets in logs, errors, and agent output

Read the full model in [docs/06-security-model.md](docs/06-security-model.md).

## Documentation

- [Documentation Index](docs/README.md)
- [Configuration Reference](docs/16-configuration.md)
- [Architecture Overview](docs/02-architecture-overview.md)
- [Tool System](docs/08-tool-system.md)
- [Testing Strategy](docs/13-testing-strategy.md)

## Repository Standards

- [CONTRIBUTING.md](CONTRIBUTING.md) defines contribution flow, validation expectations, and commit hygiene.
- [SECURITY.md](SECURITY.md) defines vulnerability reporting and secret-handling expectations.
- [CHANGELOG.md](CHANGELOG.md) tracks product-facing repository changes.

## Status

DeepCode is actively being hardened as a real developer product. The repository is public, but the project should still be treated as a fast-moving codebase: validate provider credentials, GitHub auth, and environment tooling with `deepcode doctor` before depending on it for critical work.
