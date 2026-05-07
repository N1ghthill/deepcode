# 15 - Handoff e Proximos Passos

## Estado Atual

Ultima rodada validada antes deste handoff: trabalho local nao commitado em `main`, validado em 2026-05-07.

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

O worktree contem mudancas locais amplas ainda nao commitadas, incluindo configuracao editavel, OAuth GitHub, redaction de secrets, melhorias de TUI e cobertura E2E adicional. Antes de retomar, rode `git status --short --branch` e revise o diff relevante.

## Validacao Atual

Na ultima rodada, os comandos abaixo passaram:

```bash
PATH="$PWD/.tools/bin:$PATH" pnpm typecheck
PATH="$PWD/.tools/bin:$PATH" pnpm lint
PATH="$PWD/.tools/bin:$PATH" pnpm test
PATH="$PWD/.tools/bin:$PATH" pnpm build
PATH="$PWD/.tools/bin:$PATH" pnpm exec prettier --check apps/deepcode/test/cli.e2e.test.ts docs/15-handoff-next-steps.md packages/core/test/github-client.test.ts
git diff --check
```

Cobertura de testes atual:

- Core: 26 testes.
- App CLI E2E: 7 testes.

Observacao: no ambiente local foi usado Node.js 20.20.2 portatil em `.tools/`, ignorado pelo Git. Em uma maquina preparada, use Node.js 20+ instalado normalmente.

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
- Seguranca:
  - path whitelist/blacklist.
  - permission gateway.
  - audit log.
  - classificacao de shell em `shell`, `dangerous`, `blocked`.
- Cache persistente para read/search em `.deepcode/cache`.
- Configuracao editavel por CLI com validacao estrita.
- Mascaramento centralizado de secrets em `config`, erros da CLI, output de agente/subagents/GitHub solve e audit log.
- OAuth GitHub via device flow real, sem client ID embutido.
- Validacao real de token GitHub via `GET /user` em `github whoami` e `doctor`.
- Validacao real de provider/modelo via endpoint `/models` no `doctor`.
- TUI com seletor navegavel de sessoes, tela de configuracao efetiva, ajuda, painel de aprovacao detalhado e redaction de streaming/erros.
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

A TUI funciona, mas ainda precisa de acabamento para ficar no nivel da documentacao:

- Refinamento visual do modal de aprovacao.
- Refinamento visual do session switcher.
- Edicao interativa na tela de configuracao.
- Temas.
- Keybindings Vim completos.
- Melhor visual para atividades, tool calls, erros e progresso.

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
- [ ] TUI revisada para UX final.
- [x] OAuth GitHub implementado.
- [x] Testes E2E cobrindo projeto fixture TypeScript.
- [x] Documentacao de config completa.
- [ ] Pacote publicado em NPM.

## Riscos Conhecidos

- Tool calling real varia por provider/modelo; validar com o modelo escolhido antes de usar em projeto importante.
- `github solve` e `--yes` aprovam operacoes sensiveis; usar primeiro em branch/repo de teste.
- `search_symbols` depende de language servers instalados no PATH.
- Cache de buscas em diretorio usa TTL; se precisar maxima atualidade, rode `deepcode cache clear`.
- TUI ainda e funcional, nao final.
