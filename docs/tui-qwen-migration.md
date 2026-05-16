# Migração da TUI — DeepCode → TUI do Qwen Code

> Documento de trabalho para retomar a migração em sessões futuras.
> Última atualização: 2026-05-15.

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

## 4. Estado atual

`packages/cli/src/tui/` tem ~127 arquivos. `pnpm --filter @deepcode/cli typecheck` está **verde**.

### Pronto

- **Setup:** backup, upgrade Ink 7/React 19, build do monorepo verde.
- **Foundation:** themes, colors, `text-buffer`, hooks de teclado, contexts
  (Keypress, Vim, Streaming, Overflow, CompactMode, App, Config, RenderMode,
  Settings, AgentView*, BackgroundTaskView*), `keyBindings`.
- **Contratos enxutos** (escritos para o DeepCode, não portados):
  `UIStateContext`, `UIActionsContext`, `ui/commands/types.ts`,
  `config/settings.ts`.
- **Input:** `InputPrompt` + os 7 hooks de autocomplete/histórico,
  `BaseTextInput`, `SuggestionsDisplay`, shim de busca de arquivos (`@path`).
- **Composer:** `Composer` + `Footer` + `LoadingIndicator` e subgrafos.
- **Render de mensagens:** `MarkdownDisplay` + subgrafo (CodeColorizer,
  InlineMarkdownRenderer, TableRenderer), `ConversationMessages`, `ToolMessage`,
  `ToolGroupMessage`, `CompactToolGroupDisplay`, `ToolConfirmationMessage`,
  `AskUserQuestionDialog`, `DiffRenderer`.

### Falta (sequência recomendada)

1. `HistoryItemDisplay` — o dispatch por tipo de item. Stubar os renderers
   raros (AboutBox, Help, StatsDisplay, `views/*`, ArenaCards, BtwMessage);
   os essenciais já estão prontos.
2. `MainContent`, `DefaultAppLayout`, `App` — a estrutura visual.
3. `AppContainer` — o **conector DeepCode**. Escrito do zero (não portado):
   monta `UIState`/`UIActions`, o adapter de `Config`, e os providers de
   contexto.
4. **Bridge de runtime:** substituir `useGeminiStream` por um hook que chama
   `createRuntime()` + `runtime.agent.run({ onChunk, onChunkForTask, onUsage,
   onIteration, onTaskUpdate })`, mapeando para `HistoryItem` + `StreamingState`.
   Eventos do `EventBus` (`activity`, `approval:request`, `app:error`).
5. Religar `tui/App.tsx` (entry DeepCode) → `AppContainer`.
6. **Fase 3 — adaptadores:** mapeamento de tool calls (formato Qwen → DeepCode),
   `PermissionGateway` ↔ `ToolConfirmation`, display de provider/modelo,
   comandos GitHub, barra de token budget.
7. **Fase 4 — validação:** `pnpm build`, `typecheck`, `lint`, teste manual.

## 5. Stubs e TBDs a revisitar

Itens portados como stub inerte ou simplificados — revisitar quando a feature
correspondente for necessária:

- `MermaidDiagram` — mostra o source ao invés de renderizar o diagrama.
- `useStatusLine` — sem status line customizável.
- `useConfigInitMessage` — sem progresso de init de MCP no footer.
- `BackgroundTasksPill`, `MCPHealthPill`, `FeedbackDialog`, `ShellInputPrompt`,
  `AgentViewContext`, `BackgroundTaskViewContext`, `useFollowupSuggestions` —
  features Qwen-only, stubadas.
- `fetchGitDiff` (no shim) — stub; o comando `/diff` será religado ao runtime
  no milestone de comandos.
- `i18n` — `t()` identidade (as keys do Qwen já são strings em inglês); locale
  completo pode voltar depois.
- Campos do `Config`/`UIState`/`UIActions` cresceram sob demanda; o
  `AppContainer` precisa fornecer valores reais para todos eles.

## 6. Interface do runtime do DeepCode (para o bridge)

- `createRuntime({ cwd, configPath, interactive })` → `DeepCodeRuntime`
  `{ config, events, sessions, cache, providers, agent, subagents, permissions, mcp }`.
- `runtime.agent.run({ session, input, mode, signal, onChunk, onChunkForTask,
  onUsage, onIteration, onTaskUpdate })`.
- `runtime.events` (`EventBus`): eventos `activity`, `approval:request`,
  `approval:decision`, `app:error`.
- `runtime.permissions` (`PermissionGateway`): aprovações read/write/shell/dangerous.
