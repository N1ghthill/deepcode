# Contributing to DeepCode

DeepCode should be treated as a product repository, not a scratchpad. That means changes need clear scope, documented intent, and validation proportional to risk.

## Development Workflow

1. Install dependencies with `pnpm install`.
2. Build once with `pnpm build`.
3. Start the local product with `pnpm dev`.
4. Validate your change with the smallest relevant command set before broadening scope.

Recommended validation commands:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

For narrower changes, prefer focused validation such as:

```bash
pnpm --filter @deepcode/cli test -- App.test.tsx
pnpm --filter @deepcode/core test -- agent-tool-loop.test.ts
pnpm --filter deepcode build
```

## Repository Boundaries

- `apps/deepcode` is the publishable CLI product.
- `packages/cli` contains commands and the Ink TUI.
- `packages/core` contains the runtime, providers, tools, GitHub, security, and workflows.
- `packages/shared` contains shared contracts and schemas.
- `docs` contains product and engineering reference material.

Keep those boundaries explicit. Do not add feature logic to `apps/deepcode` that belongs in `packages/cli` or `packages/core`.

## Commit Hygiene

Use focused commits. One commit should answer one question:

- docs and metadata only
- runtime behavior change
- test-only addition
- packaging or release surface adjustment

Avoid mixing refactors, formatting, feature work, and repo hygiene in one commit unless the change is inseparable.

Prefer Conventional Commit prefixes:

- `feat:`
- `fix:`
- `docs:`
- `refactor:`
- `test:`
- `build:`
- `chore:`

Examples:

- `docs: align public repository documentation`
- `build: bundle workspace internals into publishable deepcode package`
- `fix: hide raw tool output from the TUI transcript`

## Documentation Expectations

Update documentation when you change:

- command behavior
- configuration keys
- packaging or installation flow
- security model
- product scope or operator workflow

The repository README is the public entrypoint. `docs/README.md` is the reference index. Internal handoff notes should stay clearly labeled as internal engineering material.

## Security and Secrets

- Never commit real API keys, GitHub tokens, or local `.deepcode` state.
- Treat `.deepcode/`, nested app `.deepcode/`, and ad-hoc implementation notes as local artifacts unless they are explicitly sanitized and intended for the repository.
- Follow [SECURITY.md](SECURITY.md) for disclosure and reporting.

## Pull Requests

Before opening a PR:

1. Rebase or otherwise ensure your branch is coherent.
2. Confirm the description explains the product impact.
3. Include validation results.
4. Call out known tradeoffs or follow-up work explicitly.
