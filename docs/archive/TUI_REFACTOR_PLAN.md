# TUI Refactor Plan — DeepCode

> Baseado em análise completa de `packages/cli/src/tui/` em 2026-05-12.
> Tudo referenciado ao código real. Nenhum mock.

---

## Fase 1 — Análise Crítica da TUI Atual

### Os 5 Maiores Problemas

#### Problema 1: God Component com Explosão de Estado (`App.tsx:91-1293`)

`App.tsx` tem **1293 linhas** e **30+ chamadas `useState`** no mesmo componente:

```ts
// App.tsx: 96-128 — 28 estados em sequência
const [runtime, setRuntime] = useState(...)
const [session, setSession] = useState(...)
const [input, setInput] = useState(...)
const [messages, setMessages] = useState(...)
const [activities, setActivities] = useState(...)
const [streaming, setStreaming] = useState(...)
const [assistantDraft, setAssistantDraft] = useState(...)
// ... 21 mais
```

**Impacto real**: quando `onChunk` dispara (10–20×/s durante streaming), ele chama
`setAssistantDraft(current => current + text)`, que re-renderiza **todo o App**, incluindo
`Sidebar`, `Header`, `StatusBar`, modais e a lista completa de mensagens. O Ink reconcilia
cada componente filho a cada chunk. Com 50+ mensagens no histórico, cada chunk gera
centenas de nós React reconciliados desnecessariamente.

#### Problema 2: Execução Paralela é Invisível para o Usuário

`PlanProgressBar` (`AppPanels.tsx:451-482`) mostra exatamente 1 task em execução:

```ts
// AppPanels.tsx:457 — sempre exibe APENAS a primeira task "running"
const currentTask = plan.tasks.find((task) => task.status === "running");
```

Com as melhorias implementadas (`executePlan` agora usa `Promise.all` para tasks paralelas),
o agente pode estar executando 4 tasks simultaneamente enquanto a UI mostra apenas 1.
O usuário não tem visibilidade de paralelismo.

#### Problema 3: Sem Streaming por Task — Outputs Paralelos Colidem

`executeTaskWithLLM` em `agent.ts:296-302` passa `options.onChunk` diretamente para todas
as tasks paralelas. Quando 3 tasks rodando em paralelo chamam `onChunk`, os chunks vão
para o mesmo `assistantDraft` em `App.tsx:762-765`:

```ts
onChunk: (text) => {
  setAssistantDraft(current => current + text);  // App.tsx:762
}
```

O texto de 3 tasks paralelas se intercala em uma única string. O usuário não consegue
distinguir qual texto veio de qual task.

#### Problema 4: Histórico de Atividades Descartado (`App.tsx:213`)

```ts
const offActivity = created.events.on("activity", (activity) => {
  setActivities((current) => [...current.slice(-10), activity]);  // App.tsx:213
```

Apenas as últimas **10 atividades** são mantidas em memória de UI. Durante execução paralela
com múltiplas sessões filhas emitindo eventos, dezenas de atividades relevantes são
descartadas por overflow do buffer. A sidebar (`Sidebar.tsx:327-336`) só exibe as
últimas 8 de qualquer forma.

#### Problema 5: `useInput` Monolítico — 326 Linhas de Branching (`App.tsx:377-703`)

O handler de input tem 326 linhas de `if/else` aninhados que cobrem todos os modos:
`viewMode === "sessions"`, `viewMode === "config"`, `editingConfig`, `activeModal`,
`showInputPreview`, `approvals.length > 0`, etc. Não há separação de concerns por
modo de view. Adicionar um novo modo requer tocar o mesmo bloco gigante.

---

### Comparação Conceitual com OpenCode (Go/Bubbletea)

OpenCode resolve os mesmos problemas com uma arquitetura fundamentalmente diferente:

| Aspecto | DeepCode (Ink/React) | OpenCode (Bubbletea) |
|---|---|---|
| Modelo de estado | 30+ useState em 1 componente | Struct `Model` imutável + `Update(msg)` puro |
| Re-render | Qualquer setState re-renderiza a árvore | `Update` só re-renderiza o que mudou em `View` |
| Paralelismo visual | 1 task por vez | N task "lanes" com canais Go independentes |
| Streaming | 1 `assistantDraft` global | Buffer por `tea.Cmd` assíncrono por task |
| Input | key-by-key em `useInput` | `textinput.Model` com cursor real |
| Scroll | Sem scroll | `viewport.Model` com scroll nativo |
| Layout | `flexDirection` do Ink | `lipgloss.Place` com dimensões exatas |

**Conceitos aproveitáveis** (arquitetura, não código):
1. **Reducer central** (`Update(msg) → (Model, Cmd)`) → mapeia para `useReducer` em React
2. **Viewport com scroll** (`viewport.Model`) → componente Ink customizado com `sliceWindow`
3. **Task lanes independentes** → cada task paralela tem seu próprio componente de estado
4. **Mensagens tipadas** (`tea.Msg`) → union types TypeScript para `AgentAction`

---

## Fase 2 — Design da Nova TUI

### Princípios Arquiteturais

1. **Um store central** (Zustand) em vez de 30 useState — elimina re-renders desnecessários
2. **Streaming por task** — cada task paralela escreve em seu próprio buffer
3. **Componentes puros** — recebem props, não leem store diretamente
4. **Todas as integrações via callbacks reais** — `onChunk`, `onTaskUpdate`, `onTaskComplete`, `EventBus`

### Layout Proposto

```
┌─ Header: DeepCode [provider/model] [PLAN|BUILD] [status] ─────────────┐
│                                                                         │
├─ Main Area (flexGrow) ────────────────────────────────┬─ Sidebar ─────┤
│                                                        │               │
│  [Chat Mode]                                           │ [1] Sessions  │
│  ┌────────────────────────────────────────────────┐   │ [2] Activities│
│  │ Virtual scroll: messages                       │   │ [3] Plan      │
│  │ (only visible rows rendered)                   │   │ [4] Telemetry │
│  │                                                │   │ [5] Approvals │
│  └────────────────────────────────────────────────┘   │               │
│                                                        │               │
│  [Parallel Tasks Panel — só aparece durante execução] │               │
│  ┌──────────────┬──────────────┬──────────────────┐   │               │
│  │ Task 1       │ Task 2       │ Task 3           │   │               │
│  │ [research] ▶ │ [code] ▶     │ [test] ⟳         │   │               │
│  │ ─────────── │ ─────────── │ ─────────────────│   │               │
│  │ Reading...   │ Writing...   │ Running tests... │   │               │
│  └──────────────┴──────────────┴──────────────────┘   │               │
│                                                        │               │
│  [Input Area]                                          │               │
│  ┌────────────────────────────────────────────────┐   │               │
│  │ > _                                            │   │               │
│  └────────────────────────────────────────────────┘   │               │
│                                                        │               │
├─ StatusBar: [tokens] [cost] [elapsed] [phase] [notice] ────────────────┤
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Fase 3 — Plano de Implementação

### Estrutura de Pastas Proposta

```
packages/cli/src/tui/
├── store/
│   ├── agent-store.ts          # Zustand store central
│   ├── actions.ts              # AgentAction union types
│   └── selectors.ts            # Memoized selectors
│
├── components/
│   ├── layout/                 # (existente — manter)
│   │   ├── Header.tsx
│   │   ├── Layout.tsx
│   │   ├── Sidebar.tsx         # REFATORAR: ler do store
│   │   └── StatusBar.tsx       # REFATORAR: ler do store
│   │
│   ├── chat/                   # NOVO
│   │   ├── MessageList.tsx     # Virtual scroll de mensagens
│   │   ├── MessageRow.tsx      # Uma mensagem renderizada
│   │   └── InputField.tsx      # Input com cursor real (ink-text-input)
│   │
│   ├── tasks/                  # NOVO
│   │   ├── ParallelTasksPanel.tsx  # Container de tasks paralelas
│   │   ├── TaskLane.tsx            # 1 coluna por task paralela
│   │   ├── TaskStreamLog.tsx       # Log de streaming da task
│   │   └── ProgressMatrix.tsx      # Grid de status de todas as tasks
│   │
│   ├── modals/                 # (existente — manter com ajustes menores)
│   │   ├── ModelSelector.tsx
│   │   ├── ProviderModal.tsx
│   │   └── TelemetryPanel.tsx
│   │
│   └── shared/                 # (existente — manter)
│       ├── ErrorBoundary.tsx
│       ├── Spinner.tsx
│       └── VirtualScroll.tsx   # NOVO: componente base de scroll
│
├── hooks/                      # (existente — manter e adicionar)
│   ├── useAgentBridge.ts       # NOVO: conecta callbacks do agente ao store
│   ├── useVirtualScroll.ts     # NOVO: cálculo de janela visível
│   ├── useApprovalFlow.ts      # (existente)
│   ├── useConfigEditor.ts      # (existente)
│   ├── useGithubOAuth.ts       # (existente)
│   ├── useLiveMetrics.ts       # (existente)
│   ├── useModels.ts            # (existente)
│   ├── useProviderStatus.ts    # (existente)
│   ├── useSessionManager.ts    # (existente)
│   └── useTelemetry.ts        # (existente)
│
├── App.tsx                     # REFATORAR: reducer + store, sem useState em massa
└── [demais arquivos existentes intocados]
```

---

### Pacotes NPM a Adicionar

| Pacote | Versão | Motivo |
|---|---|---|
| `zustand` | `^5.x` | Store central sem re-renders desnecessários |
| `ink-text-input` | `^6.x` | Input com cursor real, sem key-by-key manual |
| `ink-select-input` | `^6.x` | Substituir listas de seleção manuais (sessions, commands) |

**NÃO adicionar**: `blessed`, `@types/blessed` (API incompatível com Ink), `react-reconciler`
customizado (fora do escopo), `xterm.js` (não funciona em Node puro).

Verificar compatibilidade antes de instalar:
```bash
pnpm add zustand ink-text-input ink-select-input
```

---

### Componentes Principais — Especificação

#### `store/agent-store.ts` — Zustand Store Central

```ts
// Substitui todos os useState de App.tsx
// Cada slice é atualizado cirurgicamente — sem re-render global

interface TaskStreamBuffer {
  taskId: string;
  description: string;
  type: "research" | "code" | "test" | "verify";
  status: "pending" | "running" | "completed" | "failed";
  chunks: string[];          // chunks do onChunk por task
  error?: string;
  startedAt?: number;
  completedAt?: number;
  attempt: number;           // para mostrar retry
}

interface AgentState {
  // Runtime
  runtime: DeepCodeRuntime | null;
  session: Session | null;

  // Chat
  messages: Message[];
  assistantDraft: string;       // só para a resposta final (fora de plan)
  streaming: boolean;

  // Tasks paralelas
  taskBuffers: Map<string, TaskStreamBuffer>;  // taskId → buffer
  currentPlan: TaskPlan | undefined;

  // UI
  phase: string;
  iteration: { current: number; max: number };
  activities: Activity[];       // AUMENTAR para 100 entradas
  toolCalls: ToolCallEntry[];

  // Actions
  dispatch: (action: AgentAction) => void;
}

// Actions cirúrgicas — cada uma causa re-render mínimo
type AgentAction =
  | { type: "CHUNK"; taskId: string | null; text: string }
  | { type: "TASK_START"; taskId: string; description: string; taskType: string; attempt: number }
  | { type: "TASK_COMPLETE"; taskId: string; result: string }
  | { type: "TASK_FAIL"; taskId: string; error: string; willRetry: boolean }
  | { type: "PLAN_UPDATE"; plan: TaskPlan }
  | { type: "ACTIVITY"; activity: Activity }
  | { type: "STREAM_START" }
  | { type: "STREAM_END" };
```

A integração com o agente é feita em `useAgentBridge.ts`, que mapeia os callbacks
`onChunk`, `onTaskUpdate`, `onTaskComplete` (implementado na sessão anterior) e eventos
do `EventBus` para `dispatch(action)`.

---

#### `components/tasks/ParallelTasksPanel.tsx`

Renderizado APENAS quando `taskBuffers.size > 0 && streaming`:

```ts
// Recebe do store: taskBuffers, currentPlan
// Lógica: divide largura do terminal entre tasks ativas
// Máximo de 4 lanes visíveis; scroll horizontal com ] e [

interface ParallelTasksPanelProps {
  taskBuffers: Map<string, TaskStreamBuffer>;
  terminalWidth: number;     // stdout.columns
  theme: ThemeColors;
}
```

Layout:
- 1 task: coluna de largura total
- 2 tasks: 50%/50%
- 3 tasks: 33%/33%/34%
- 4+ tasks: 4 colunas + indicador "mais N tasks"
- Cada lane: header com nome, tipo e status + últimas N linhas de streaming

---

#### `components/tasks/TaskLane.tsx`

```ts
interface TaskLaneProps {
  buffer: TaskStreamBuffer;
  width: number;             // largura calculada pelo painel pai
  theme: ThemeColors;
}

// Renderiza:
// ┌─ [code] task-id: description ──────── ▶ running (3s) ─┐
// │ chunk1chunk2chunk3chunk4...                             │
// │ (últimas 8 linhas do buffer, sem scroll interno)        │
// └────────────────────────────────────────────────────────┘
//
// Para task em retry:
// ┌─ [code] task-id ───────────────── ⟳ retry 1/2 ───────┐
// │ Previous error: failed to edit file                    │
// │ ─────────────────────────────────────────────────────  │
// │ Trying different approach...                           │
// └────────────────────────────────────────────────────────┘
```

Os `chunks[]` do buffer são acumulados por `dispatch({ type: "CHUNK", taskId, text })`.
O componente lê apenas `buffer.chunks.slice(-8).join("")` — sem estado local.

---

#### `components/tasks/ProgressMatrix.tsx`

Substitui `PlanProgressBar` quando há tasks paralelas:

```ts
// Renderiza uma grade visual mostrando TODOS os tasks do plano
// Não apenas o progresso linear, mas o estado de cada task

// Exemplo com 8 tasks (4 rodando em paralelo):
// Plan: "Add parallel execution to agent"
// ═══════════════════════════════════════════
// [research-1] ✓  [research-2] ✓  [code-1] ▶  [code-2] ▶
// [test-1]     ▶  [test-2]     ○  [verify] ○  [verify2] ○
// ═══════════════════════════════════════════
// 2/8 done · 4 running · 2 pending · 0:42 elapsed
```

Fonte de dados: `currentPlan.tasks` (vem do `onTaskUpdate` callback existente em `agent.ts`).

---

#### `components/chat/MessageList.tsx` — Virtual Scroll

O problema atual: `visibleMessages.map()` renderiza todas as mensagens no DOM do Ink.
Com 100 mensagens de 5 linhas cada, são 500 `<Text>` nodes reconciliados a cada chunk.

Solução — `useVirtualScroll`:

```ts
// hooks/useVirtualScroll.ts
export function useVirtualScroll(
  items: Message[],
  viewportHeight: number,    // stdout.rows menos header/statusbar
  rowHeight: (item: Message) => number,  // estimativa de linhas por mensagem
) {
  // Retorna: { visibleItems, scrollOffset, canScrollUp, canScrollDown }
  // Renderiza apenas os items que cabem no viewport
  // Scroll: Page Up / Page Down via useInput
}
```

Sem dependência externa — usa apenas aritmética de offsets.

---

#### `hooks/useAgentBridge.ts`

Este hook é o coração da integração. Substitui o inline `agent.run(...)` em `App.tsx:756-791`:

```ts
export function useAgentBridge(runtime: DeepCodeRuntime | null) {
  const dispatch = useAgentStore((s) => s.dispatch);

  async function runAgent(
    session: Session,
    input: string,
    mode: AgentMode,
    signal: AbortSignal,
  ): Promise<void> {
    dispatch({ type: "STREAM_START" });

    await runtime!.agent.run({
      session,
      input,
      mode,
      signal,

      // Chunk do texto final (fora de plano)
      onChunk: (text) => dispatch({ type: "CHUNK", taskId: null, text }),

      // Atualização do plano — inclui tasks paralelas
      onTaskUpdate: (task, plan) => {
        dispatch({ type: "PLAN_UPDATE", plan: cloneTaskPlan(plan) });

        if (task.status === "running") {
          dispatch({
            type: "TASK_START",
            taskId: task.id,
            description: task.description,
            taskType: task.type,
            attempt: 0,  // Será incrementado se houver retry
          });
        } else if (task.status === "completed") {
          dispatch({ type: "TASK_COMPLETE", taskId: task.id, result: task.result ?? "" });
        } else if (task.status === "failed") {
          dispatch({
            type: "TASK_FAIL",
            taskId: task.id,
            error: task.error ?? "unknown",
            willRetry: false,  // TODO: threading retry info
          });
        }
      },

      // Novo callback do SubagentManager
      // (requer propagação de onChunk por taskId — ver Integração abaixo)
      onIteration: (current, max) => {
        dispatch({ type: "CHUNK", taskId: null, text: "" }); // Tick para atualizar metrics
      },
      onUsage: (inputTokens, outputTokens) => {
        // liveMetrics via ref existente
      },
    });

    dispatch({ type: "STREAM_END" });
  }

  return { runAgent };
}
```

---

### Integração com EventBus Existente

O `EventBus` (`packages/core/src/events/event-bus.ts`) já emite:
- `"activity"` → `dispatch({ type: "ACTIVITY", activity })`
- `"approval:request"` → lógica de approval (existente, manter)
- `"app:error"` → `setNotice` (manter)

**Novo**: para capturar chunks por task das sessões filhas (criadas em `executePlan`),
precisamos de um mecanismo adicional. Proposta: adicionar evento ao EventBus:

```ts
// Em executePlan (agent.ts), ao criar child session:
this.eventBus.emit("task:chunk", { taskId: task.id, text });
```

Ou, alternativa mais limpa: passar `onChunk` no contexto da task, que captura `taskId`:

```ts
// No executeTaskWithLLM — adicionar parâmetro opcional onChunk por task
onChunkForTask?: (taskId: string, text: string) => void;
```

E no `useAgentBridge`:
```ts
onChunkForTask: (taskId, text) =>
  dispatch({ type: "CHUNK", taskId, text }),
```

Este é o único lugar onde o `agent.ts` precisa de uma mudança adicional.

---

### Migração Passo a Passo

#### Etapa 1 — Instalar dependências e criar store (sem quebrar nada)
- `pnpm add zustand ink-text-input`
- Criar `store/agent-store.ts` com o estado atual mapeado
- Criar `store/actions.ts`
- **Zero mudanças em App.tsx**
- Testes: `pnpm build`

**Esforço: ~3h**

---

#### Etapa 2 — Migrar estado de App.tsx para o store
- Substituir os 30 `useState` por `useAgentStore()`
- Criar `hooks/useAgentBridge.ts`
- Mover `submitInput` para o hook
- App.tsx deve diminuir de 1293 para ~400 linhas
- Manter todos os comportamentos existentes
- Testes: `pnpm test && pnpm build` + smoke test manual

**Esforço: ~5h** (maior risco de regressão — testar cuidadosamente)

---

#### Etapa 3 — Virtual scroll de mensagens
- Criar `hooks/useVirtualScroll.ts`
- Criar `components/chat/MessageList.tsx`
- Substituir o `visibleMessages.map()` em App.tsx
- Testar com 50+ mensagens sintéticas no fixture de e2e

**Esforço: ~4h**

---

#### Etapa 4 — Input field com cursor real
- Substituir o input character-by-character por `ink-text-input`
- Manter atalhos de history (↑/↓), slash commands, Vim mode
- O `ink-text-input` tem API compatível com `onChange` / `onSubmit`

**Esforço: ~3h**

---

#### Etapa 5 — ParallelTasksPanel + TaskLane
- Criar `components/tasks/ParallelTasksPanel.tsx`
- Criar `components/tasks/TaskLane.tsx`
- Integrar com `useAgentBridge.ts` via `dispatch({ type: "TASK_START" | "CHUNK" })`
- Adicionar parâmetro `onChunkForTask` em `executeTaskWithLLM` (agent.ts: 1 linha)
- Testar com plano de 4 tasks paralelas usando `ToolAwareProvider` existente nos testes

**Esforço: ~6h**

---

#### Etapa 6 — ProgressMatrix e retry UX
- Criar `components/tasks/ProgressMatrix.tsx`
- Mostrar estado de retry na `TaskLane` (exibir `attempt` e erro anterior)
- Melhorar `onTaskUpdate` para propagar info de retry

**Esforço: ~3h**

---

#### Etapa 7 — useInput por modo (substituir bloco de 326 linhas)
- Criar handlers separados: `useChatInput`, `useConfigInput`, `useSessionInput`
- Cada um ativo via `isActive` prop do `useInput` do Ink
- Eliminar o mega-if/else em App.tsx:377-703

**Esforço: ~4h**

---

#### Etapa 8 — Polimento e testes
- Aumentar buffer de activities para 100
- Ajustar temas com cores mais diferenciadas
- Testes de snapshot nos novos componentes
- e2e com plano de 8 tasks

**Esforço: ~4h**

---

### Resumo de Esforço

| Etapa | Descrição | Horas | Risco |
|---|---|---|---|
| 1 | Instalar e criar store | 3h | Baixo |
| 2 | Migrar estado para store | 5h | Alto |
| 3 | Virtual scroll | 4h | Médio |
| 4 | Input com cursor | 3h | Baixo |
| 5 | ParallelTasksPanel + TaskLane | 6h | Médio |
| 6 | ProgressMatrix + retry UX | 3h | Baixo |
| 7 | useInput por modo | 4h | Médio |
| 8 | Polimento + testes | 4h | Baixo |
| **Total** | | **32h** | |

---

### Restrições Técnicas Importantes

1. **Ink não suporta hex colors**: `theme.bg = "black"` funciona; `"#1e1e2e"` não. Os temas
   precisam usar cores ANSI nomeadas. Não há como mudar isso sem trocar de renderer.

2. **Ink não tem scroll nativo**: todo scroll é implementado com slice de array. O
   `VirtualScroll` que propomos usa `stdout.rows` (via `useStdout`) para calcular a janela.

3. **`stdout.columns` pode ser `undefined`**: sempre usar `stdout.columns ?? 80` como fallback.
   O `ParallelTasksPanel` depende disso para calcular largura das lanes.

4. **`useInput` e `isActive`**: múltiplos `useInput` podem coexistir no Ink, mas apenas
   os com `isActive: true` processam teclas. Usar isso para os handlers por modo.

5. **Zustand e Ink**: Zustand usa `useSyncExternalStore` internamente, que é compatível com
   React 18 e o renderer do Ink. Verificado em projetos da comunidade.

6. **ink-text-input e modo Vim**: o `ink-text-input` não tem modo Vim nativo. A solução é
   usar um wrapper que desabilita o componente quando `vimMode === "normal"` e captura
   o input manualmente nesse estado.

---

### O Que NÃO Fazer

- Não migrar para Bubbletea/Go — reescrita total sem benefício incremental
- Não adicionar `blessed` — incompatível com Ink, depreciado
- Não usar `setInterval` para atualizar o UI — Ink já re-renderiza via state changes
- Não criar mocks de dados para testar componentes — usar os fixtures e2e existentes
  em `packages/cli/test/integration/`
- Não remover o `EventBus` existente — é a cola entre core e TUI; apenas adicionar eventos
- Não hardcodar larguras de colunas — sempre calcular de `stdout.columns`
