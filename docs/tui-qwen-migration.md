# Migração da TUI — DeepCode → TUI do Qwen Code

> Documento de trabalho para retomar a migração em sessões futuras.
> Última atualização: 2026-05-16.

## 1. Objetivo

Substituir a TUI do DeepCode (que era instável e quebrava com frequência) pela
TUI do [Qwen Code](https://github.com/QwenLM/qwen-code), que é madura e usa a
mesma stack (Ink/React). A TUI antiga foi preservada — **não deletar**.

## 2. Decisões de arquitetura

- **Stack:** upgrade de Ink 4 → 7 e React 18 → 19 (`packages/cli` e
  `apps/deepcode`). Sem isso os componentes do Qwen exigiriam adaptação manual.
- **Backup:** TUI antiga em `packages/cli/src/tui-old/`, testes antigos em
  `packages/cli/test-old/`. Ambos excluídos de tsconfig/eslint/build. Não rodam,
  não são compilados — são só backup recuperável.
- **Layout espelhado:** a nova `packages/cli/src/tui/` espelha exatamente o
  layout `packages/cli/src/` do Qwen — `tui/ui/` = `ui/` do Qwen, mais
  `tui/config/`, `tui/utils/`, `tui/services/`, `tui/i18n/`. Isso mantém todos
  os imports relativos entre arquivos copiados válidos sem edição.
- **Shim do core:** o Qwen importa de `@qwen-code/qwen-code-core` e
  `@google/genai`. Esses pacotes não existem no DeepCode. São substituídos por
  `tui/qwen-core/index.ts` e `tui/qwen-core/genai.ts`, com aliases em
  `packages/cli/tsconfig.json` (`paths`): `@deepcode/tui-shim` e
  `@deepcode/tui-genai`. Cada arquivo copiado recebe um `sed` único trocando o
  import do pacote pelo alias. O shim cresce conforme a migração avança.
- **tsconfig:** `packages/cli` define `noUncheckedIndexedAccess: false` (o
  código do Qwen assume essa flag desligada). eslint: `no-undef` off para TS,
  `reportUnusedDisableDirectives` off.
- **Runtime intocado:** `packages/core` e `packages/shared` NÃO são modificados.
  Só a TUI e seus conectores.
- **Abordagem híbrida:** a shell do Qwen é um grafo conectado — não há estado
  intermediário que compile. Um port literal puro seria um big-bang de semanas
  sem validação. Por isso: portam-se os *componentes de UX* do Qwen (input,
  autocomplete, layout, render de mensagens, streaming) sobre um `UIState`/
  `AppContainer` **DeepCode-nativo e enxuto**. Descartam-se features Qwen-only
  (integração IDE, gerenciador de extensões, arena, diálogos MCP, rewind,
  welcome-back) — viram stubs inertes. Visual/UX continua 100% Qwen.

## 3. Procedimento de port (por arquivo)

1. Re-clonar o fonte do Qwen se necessário (fica em `/tmp`, volátil):
   `git clone --depth 1 https://github.com/QwenLM/qwen-code /tmp/qwen-code`
2. Copiar o arquivo de `/tmp/qwen-code/packages/cli/src/...` para o caminho
   espelhado em `tui/`.
3. `sed -i "s#'@qwen-code/qwen-code-core'#'@deepcode/tui-shim'#g; s#'@google/genai'#'@deepcode/tui-genai'#g"` no arquivo copiado.
4. `pnpm --filter @deepcode/cli typecheck`.
5. Para cada símbolo faltante: adicionar ao shim (`tui/qwen-core/index.ts`),
   aos contextos enxutos, ou stubar a feature Qwen-only.
6. Portar **bottom-up** (na ordem de dependências) — cada passo mantém o
   typecheck verde.

## 4. Estado atual (checkpoint 2026-05-16)

`packages/cli/src/tui/` tem ~127 arquivos com a base Qwen portada e bridge
DeepCode funcional.

### Já pronto

- `App.tsx` ligado ao novo `AppContainer`.
- `HistoryItemDisplay` + `MainContent` integrados ao fluxo real.
- Bridge de runtime ativa com `createRuntime()` e execução via
  `runtime.agent.run(...)` com stream (`onChunk`) e uso (`onUsage`).
- Aprovação interativa (`approval:request` / `approval:decision`) conectada.
- Slash commands funcionais:
  `/help`, `/clear`, `/diff`, `/provider`, `/model`, `/mode`,
  `/settings`, `/theme`, `/permissions`, `/auth` (alias `/login`).
- `/help` abre dialog dinâmico (sem lista hardcoded).
- `/diff` agora implementado no shim com parsing real de git diff
  (`shortstat/numstat/name-status`, untracked, binary, truncation).
- Dialogs básicos renderizados em modal textual (`CommandDialog`) e fechamento
  via `Esc`/`Enter`.
- `result.type === "tool"` agora executa tool client-side via `ToolRegistry`
  com output renderizado em `tool_group`.
- `result.type === "confirm_action"` agora abre confirmação modal com
  teclado (`y/n/Enter/Esc`) e re-execução do comando com
  `overwriteConfirmed=true`.

### Pendências prioritárias (próxima sessão)

1. Tornar dialogs interativos (não só informativos):
   `/theme`, `/permissions`, `/auth`.
2. Completar bridge de runtime para callbacks adicionais:
   `onChunkForTask`, `onIteration`, `onTaskUpdate`.
3. Evoluir mapeamento de mensagens/ferramentas para maior paridade visual
   com Qwen em cenários longos e multi-tool.

## 5. Stubs e TBDs a revisitar

Itens portados como stub inerte ou simplificados. Só implementar quando a
feature realmente entrar no escopo:

- `MermaidDiagram` (mostra source, sem render gráfico).
- `useStatusLine` (sem status line customizável).
- `useConfigInitMessage` (sem progresso de init de MCP no footer).
- `BackgroundTasksPill`, `MCPHealthPill`, `FeedbackDialog`, `ShellInputPrompt`,
  `AgentViewContext`, `BackgroundTaskViewContext`, `useFollowupSuggestions`.
- `i18n`: `t()` identidade (keys em inglês); locale completo fica para depois.

## 6. Validação atual

Comandos executados no checkpoint:

- `pnpm --filter @deepcode/cli typecheck` ✅
- `pnpm --filter @deepcode/cli build` ✅
- `pnpm --filter @deepcode/cli test` ✅ (`passWithNoTests`)
- `pnpm --filter @deepcode/cli lint` ❌ (erros preexistentes no port)

Erros de lint atuais:

- `src/tui/ui/components/InputPrompt.tsx`: regra
  `react-hooks/exhaustive-deps` não encontrada.
- `src/tui/ui/components/messages/ToolMessage.tsx`:
  `ToolInfo` redeclarado.
- `src/tui/ui/utils/commandUtils.ts`: `CodePage` redeclarado.

## 7. Checklist de retomada rápida

1. Reabrir contexto principal:
   - `packages/cli/src/tui/AppContainer.tsx`
   - `packages/cli/src/tui/ui/commands/types.ts`
   - `packages/cli/src/tui/ui/commands/*`
2. Escolher 1 pendência prioritária da seção 4 e fechar ponta a ponta
   (implementação + typecheck/build/test).
3. Rodar:
   - `pnpm --filter @deepcode/cli typecheck`
   - `pnpm --filter @deepcode/cli build`
   - `pnpm --filter @deepcode/cli test`
4. Só depois atacar `lint`, porque os 3 erros listados acima não bloqueiam
   a bridge funcional.

## 8. Interface do runtime do DeepCode (referência da bridge)

- `createRuntime({ cwd, configPath, interactive })` → `DeepCodeRuntime`
  `{ config, events, sessions, cache, providers, agent, subagents, permissions, mcp }`.
- `runtime.agent.run({ session, input, mode, signal, onChunk, onChunkForTask,
  onUsage, onIteration, onTaskUpdate })`.
- `runtime.events` (`EventBus`): `activity`, `approval:request`,
  `approval:decision`, `app:error`.
- `runtime.permissions` (`PermissionGateway`): aprovações read/write/shell/dangerous.
