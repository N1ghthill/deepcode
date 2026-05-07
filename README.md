# DeepCode

DeepCode is a terminal-only AI coding agent implemented in TypeScript. It includes:

- Multi-provider LLM support through real API calls
- Controlled autonomy with path rules, permission checks, approvals, and audit logging
- File, search, shell, git, lint, test, and code-analysis tools
- Persistent sessions under `.deepcode/sessions`
- GitHub issue and pull request operations through the GitHub API
- Ink-based TUI and command mode

## Requirements

- Node.js 20+
- pnpm 9+
- `rg` for search tools
- `git` for git and GitHub repository detection

## Setup

```bash
pnpm install
pnpm build
pnpm --filter deepcode exec deepcode init
```

Edit `.deepcode/config.json` or set environment variables:

```bash
export DEEPCODE_PROVIDER=openrouter
export DEEPCODE_MODEL="provider/model-id"
export OPENROUTER_API_KEY="..."
export GITHUB_TOKEN="..."
```

No provider or GitHub behavior is mocked. Missing credentials or missing model configuration produce explicit runtime errors.

## Usage

```bash
deepcode chat
deepcode run "Refactor the auth module and run tests" --yes
deepcode github issues
deepcode github pr --title "Fix auth" --body "Details" --head feature/auth --base main
deepcode github solve 42 --base main --yes
```

`--yes` approves permission requests for that one command. Without it, write/shell/dangerous operations are denied in non-interactive mode unless config allows them.

Inside `deepcode chat`, use `/help`, `/clear`, `/new`, and `/sessions`. When an approval is pending, press `A` to approve or `D` to deny.
