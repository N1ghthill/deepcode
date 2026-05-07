# 15 - Handoff e Proximos Passos

## Estado Atual

Ultima rodada validada: `main` commitado e pushado, validado em 2026-05-07.

Repositorio remoto:

```bash
https://github.com/N1ghthill/deepcode
```

Branch principal:

```bash
main
```

O projeto esta em formato monorepo TypeScript com:

- `packages/shared`: schemas e tipos compartilhados.
- `packages/core`: providers, agente, ferramentas, seguranca, GitHub, LSP, cache, workflows e subagents.
- `packages/cli`: comandos CLI e TUI Ink.
- `apps/deepcode`: pacote executavel `deepcode`.

## Validacao Atual

Os comandos abaixo passaram na ultima rodada:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Cobertura de testes atual:

- Core: 31 testes (5 novos: web-tool).
- App CLI E2E: 7 testes.

## Funcionalidades Ja Implementadas

- CLI: `init`, `chat`, `run`, `doctor`, `cache clear`.
- Config CLI: `config path`, `config show`, `config get`, `config set`, `config unset`.
- GitHub CLI: `github login`, `github whoami`, `github issues`, `github pr`, `github solve`.
- Subagents CLI: `subagents run --task ...`.
- Providers reais: OpenRouter, Anthropic, OpenAI, DeepSeek, OpenCode.
- Tool calling:
  - OpenAI-compatible com agregacao de argumentos em streaming.
  - Anthropic com acumulacao de `input_json_delta`.
- Ferramentas reais:
  - `read_file`, `write_file`, `edit_file`, `list_dir`.
  - `search_text`, `search_files`, `search_symbols` via LSP real.
  - `bash`, `git`, `analyze_code`, `lint`, `test`.
  - `fetch_web` para consulta de documentacao e conteudo web.
- Seguranca:
  - path whitelist/blacklist.
  - permission gateway.
  - audit log.
  - classificacao de shell em `shell`, `dangerous`, `blocked`.
  - mascaramento centralizado de secrets (redaction).
- Cache persistente para read/search em `.deepcode/cache`.
- Configuracao editavel por CLI com validacao estrita.
- OAuth GitHub via device flow real, sem client ID embutido.
- Validacao real de token GitHub via `GET /user` em `github whoami` e `doctor`.
- Validacao real de provider/modelo via endpoint `/models` no `doctor`.
- TUI com:
  - seletor navegavel de sessoes.
  - editor interativo de configuracao (navegar, editar, salvar).
  - tela de ajuda organizada.
  - painel de aprovacao detalhado com fila.
  - redaction de streaming/erros.
  - icones de atividade por tipo (read, write, bash, git, search, test, lint).
  - tracking de tool calls no painel lateral.
  - cores de status (amarelo=executando, vermelho=erro, verde=idle).
- Workflows core:
  - `ChainWorkflow`.
  - `ParallelWorkflow`.
  - `EvaluatorOptimizerWorkflow`.
- SubagentManager com sessoes filhas reais.
- Testes E2E locais do CLI.
- Fixture E2E de projeto TypeScript em repositorio Git temporario.
- E2E local dos comandos `github whoami`, `github issues`, `github pr` e validacao GitHub do `doctor` via `github.enterpriseUrl`.
- Teste de contrato do GitHubClient com servidor HTTP local mockado.

## O Que Ainda Falta

### Prioridade 1 - Validacao Real com Credenciais

1. Configurar provider real:

```bash
export DEEPCODE_PROVIDER=openrouter
export DEEPCODE_MODEL="provider/model-id"
export OPENROUTER_API_KEY="..."
```

2. Rodar:

```bash
deepcode doctor
deepcode run "Liste a estrutura do projeto e explique os principais pacotes" --yes
deepcode chat
```

3. Validar tool calling real:

```bash
deepcode run "Leia o README.md e depois busque por SubagentManager no projeto" --yes
```

### Prioridade 2 - GitHub Real

1. Configurar token:

```bash
export GITHUB_TOKEN="..."
```

2. Validar:

```bash
deepcode github issues
```

3. Criar uma issue pequena de teste no GitHub e rodar:

```bash
deepcode github solve <numero-da-issue> --base main --yes
```

Critico: usar uma issue de baixo risco primeiro, porque o fluxo faz branch, commit, push, PR e comentario.

### Prioridade 3 - TUI Final

A TUI esta funcional com editor de config interativo, mas ainda precisa de acabamento:

- Temas customizaveis.
- Keybindings Vim completos (modo normal/insert).
- Refinamento visual adicional de layout e tipografia.

### Prioridade 4 - Configuracao e Seguranca

Ainda falta:

- Revisao adicional de mascaramento em novas superficies que forem adicionadas.

### Prioridade 5 - E2E Mais Forte

Adicionar fixtures para:

- Projeto TypeScript simples com testes. Concluido para cobertura CLI basica; ainda falta executar tarefas reais do agente nessa fixture quando houver provider configurado.
- Projeto Python simples.
- Repositorio Git temporario.
- GitHub mockado por servidor local somente para testes de contrato, sem substituir o fluxo real em producao. Concluido para `GitHubClient`.

## Comandos Uteis Para Retomar

Instalar e validar:

```bash
pnpm install
pnpm typecheck
pnpm lint
pnpm test
pnpm build
```

Rodar CLI local pelo build:

```bash
node apps/deepcode/dist/index.js --help
node apps/deepcode/dist/index.js doctor
node apps/deepcode/dist/index.js config show
node apps/deepcode/dist/index.js github login --client-id "..." --scope repo
node apps/deepcode/dist/index.js chat
```

Rodar via workspace:

```bash
pnpm --filter deepcode dev -- --help
```

Publicacao NPM futura:

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm --filter deepcode publish --access public
```

## Checklist Antes de Dizer "Producao"

- [ ] `doctor` passa em ambiente real com provider, modelo, GitHub token e LSP.
- [ ] `run` executa pelo menos uma tarefa real com tool calls.
- [ ] `chat` consegue aprovar/negar uma operacao sensivel pela TUI.
- [ ] `github solve` validado em issue real de teste.
- [ ] TUI revisada para UX final (temas, Vim bindings).
- [x] OAuth GitHub implementado.
- [x] Testes E2E cobrindo projeto fixture TypeScript.
- [x] Documentacao de config completa.
- [x] Editor interativo de config na TUI.
- [x] Tool fetch_web para documentacao.
- [ ] Pacote publicado em NPM.

## Riscos Conhecidos

- Tool calling real varia por provider/modelo; validar com o modelo escolhido antes de usar em projeto importante.
- `github solve` e `--yes` aprovam operacoes sensiveis; usar primeiro em branch/repo de teste.
- `search_symbols` depende de language servers instalados no PATH.
- Cache de buscas em diretorio usa TTL; se precisar maxima atualidade, rode `deepcode cache clear`.
- TUI ainda e funcional, nao final.
