# 03 - Stack Tecnológica

## Baseado na Análise do OpenCode CLI

Esta stack foi definida após análise profunda do OpenCode CLI e considerando:
- Performance (latência foi problema em Python)
- Compatibilidade com arquitetura do OpenCode
- Madurez do ecossistema Node.js

## Tecnologias Principais

### Runtime e Linguagem

| Tecnologia | Versão | Propósito |
|------------|--------|-----------|
| **Node.js** | 20+ | Runtime JavaScript/TypeScript |
| **TypeScript** | 5.5+ | Type safety e DX |
| **pnpm** | 9+ | Gerenciador de pacotes (workspaces) |

**Por que Node.js 20+?**
- Performance de I/O superior
- Native fetch API
- Test runner integrado (experimental)
- Top-level await

### Monorepo e Build

| Tecnologia | Propósito |
|------------|-----------|
| **Turborepo** | Orquestração de builds |
| **tsup** | Bundler rápido para TypeScript |
| **pnpm workspaces** | Gerenciamento de pacotes monorepo |

**Estrutura:**
```
deepcode/
├── packages/
│   ├── core/          # SDK Core
│   ├── cli/           # TUI Interface
│   └── shared/        # Types compartilhados
├── apps/
│   └── deepcode/      # Executável
└── turbo.json
```

### State Management e Reatividade

| Tecnologia | Propósito | Baseado no OpenCode |
|------------|-----------|---------------------|
| **Effect** | 4.0.0-beta.57 | Programação funcional, error handling, concorrência | ✅ Igual |
| **Solid.js Signals** | 1.8+ | Reatividade granular | ✅ Padrão similar |

**Por que Effect?**
- Functional programming (como Elm, Haskell)
- Error handling explícito (não try/catch)
- Concurrency control integrado
- Type-safe
- Composição de efeitos

**Exemplo:**
```typescript
import { Effect } from 'effect';

const program = Effect.gen(function*() {
  const config = yield* ConfigService.get();
  const result = yield* Tool.execute(config);
  return result;
});

// Execução
const result = await Effect.runPromise(program);
```

### Interface TUI

| Tecnologia | Propósito |
|------------|-----------|
| **Ink** | 4.4+ | Framework React para terminal |
| **React** | 18+ | Base do Ink |
| **@inkjs/ui** | Componentes Ink |

**Alternativa considerada:** OpenTUI (Solid.js) - usado pelo OpenCode, mas Ink tem:
- Mais documentação
- Maior comunidade
- Mais exemplos
- API mais estável

### Validação e Tipos

| Tecnologia | Propósito | Baseado no OpenCode |
|------------|-----------|---------------------|
| **Zod** | 4.1.8 | Schema validation, type inference | ✅ Igual |

**Exemplo:**
```typescript
import { z } from 'zod';

const ToolSchema = z.object({
  name: z.string(),
  parameters: z.record(z.any()),
});

type Tool = z.infer<typeof ToolSchema>;
```

### Search e Code Intelligence

| Tecnologia | Propósito | Baseado no OpenCode |
|------------|-----------|---------------------|
| **ripgrep (rg)** | Busca texto rápida | ✅ Igual |
| **LSP Client** | Busca simbólica | ✅ Igual |
| **tree-sitter** | Parsing multi-linguagem | ✅ Similar |
| **ts-morph** | Manipulação TypeScript | Adicional |

**Por que sem Vector DB?**
Análise do OpenCode mostrou que:
- ripgrep é mais rápido para texto
- LSP fornece busca semântica
- Sem overhead de embeddings
- Funciona offline
- Menor memória

### Git e GitHub

| Tecnologia | Propósito |
|------------|-----------|
| **simple-git** | Operações Git em Node.js |
| **@octokit/rest** | API GitHub oficial |

### HTTP e APIs

| Tecnologia | Propósito |
|------------|-----------|
| **axios** | HTTP client (intercepters, retry) |
| **eventsource** | Server-Sent Events |

### Testes

| Tecnologia | Propósito |
|------------|-----------|
| **Vitest** | 1.6+ | Test runner rápido |
| **@effect/vitest** | Integração Effect |
| **msw** | Mock de APIs |

**Por que Vitest?**
- Mais rápido que Jest
- Suporte TypeScript nativo
- API similar ao Jest
- Hot reload

### CLI e Utilitários

| Tecnologia | Propósito |
|------------|-----------|
| **commander** | Parsing de argumentos CLI |
| **chalk** | Cores no terminal |
| **ora** | Spinners de loading |
| **inquirer** | Prompts interativos |
| **conf** | Configuração persistida |

### Logging

| Tecnologia | Propósito |
|------------|-----------|
| **pino** | Logging estruturado |
| **pino-pretty** | Formatação para dev |

## Resumo das Dependências

```json
{
  "dependencies": {
    "effect": "^4.0.0-beta.57",
    "zod": "^4.1.8",
    "ink": "^4.4.0",
    "react": "^18.3.0",
    "simple-git": "^3.25.0",
    "@octokit/rest": "^20.1.0",
    "axios": "^1.7.0",
    "commander": "^12.1.0",
    "pino": "^9.2.0",
    "conf": "^13.0.0"
  },
  "devDependencies": {
    "@types/node": "^20.14.0",
    "@types/react": "^18.3.0",
    "typescript": "^5.5.0",
    "tsup": "^8.1.0",
    "vitest": "^1.6.0",
    "turbo": "^2.0.0",
    "eslint": "^9.5.0",
    "prettier": "^3.3.0"
  }
}
```

## Justificativas das Escolhas

### Por que não usar...

**LangChain/LangChain.js?**
- Adiciona camada de abstração desnecessária
- OpenCode não usa
- Queremos controle total
- Implementação direta é mais simples

**Vector DB (Chroma/LanceDB/Pinecone)?**
- OpenCode não usa
- ripgrep + LSP é mais rápido
- Menos dependências
- Sem necessidade de embeddings

**Redux/Zustand?**
- OpenCode usa Effect
- Effect é mais moderno
- Melhor para programação funcional
- Error handling integrado

**Native binary (pkg/nexe)?**
- NPM é mais simples
- Updates automáticos
- Menor tamanho inicial
- Instalação padrão

## Compatibilidade

### Node.js Version Support
- **Minimum**: Node.js 20.0.0
- **Recommended**: Node.js 20 LTS ou 22 LTS
- **Tested**: Node.js 20.x, 22.x

### Plataformas
- ✅ Linux (x64, arm64)
- ✅ macOS (x64, arm64)
- ✅ Windows (x64)

### GitHub Integration
- GitHub.com (OAuth ou PAT)
- GitHub Enterprise (configurável)

---

**Anterior**: [02 - Arquitetura - 6 Camadas](./02-architecture-overview.md)  
**Próximo**: [04 - Fases de Implementação](./04-implementation-phases.md)
