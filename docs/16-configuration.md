# 16 - Configuracao

## Visao Geral

DeepCode carrega configuracao de `.deepcode/config.json` e aplica overrides de ambiente em runtime. O comando `deepcode config` edita somente o arquivo local; valores vindos de ambiente podem ser inspecionados com `--effective`, mas nao sao gravados no disco.

Secrets sao mascarados em `config show`, `config get`, erros impressos pela CLI, output de tarefas do agente e logs de auditoria.

## Ordem de Precedencia

1. Defaults validados pelo schema compartilhado.
2. `.deepcode/config.json` ou o arquivo passado por `--config`.
3. Variaveis de ambiente no runtime:
   - `DEEPCODE_PROVIDER`
   - `DEEPCODE_MODEL`
   - `OPENROUTER_API_KEY`
   - `ANTHROPIC_API_KEY`
   - `OPENAI_API_KEY`
   - `DEEPSEEK_API_KEY`
   - `OPENCODE_API_KEY`
   - `GITHUB_TOKEN`
   - `GITHUB_OAUTH_CLIENT_ID`
   - `GITHUB_OAUTH_SCOPES`
   - `CACHE_ENABLED`
   - `CACHE_TTL_SECONDS`

## Comandos

```bash
deepcode config path
deepcode config show
deepcode config show --effective
deepcode config get defaultModel
deepcode config get providers.openrouter.apiKey
deepcode config set defaultProvider openrouter
deepcode config set defaultModel "openai/gpt-4.1"
deepcode config set providers.openrouter.apiKey "..."
deepcode config set github.oauthClientId "..."
deepcode config set github.oauthScopes '["repo"]'
deepcode config set cache.enabled false
deepcode config set cache.ttlSeconds 600
deepcode config set permissions.allowShell '["pnpm test","pnpm build","git status"]'
deepcode config unset providers.openrouter.apiKey
```

Arrays and objects must be valid JSON. Scalar values are parsed from the existing schema type: booleans for boolean fields, numbers for numeric fields, and strings otherwise. Use `--json` when setting a scalar as JSON intentionally.

## Arquivo Completo

```json
{
  "defaultProvider": "openrouter",
  "defaultModel": "provider/model-id",
  "maxIterations": 20,
  "providerRetries": 2,
  "temperature": 0.2,
  "maxTokens": 4096,
  "cache": {
    "enabled": true,
    "ttlSeconds": 300
  },
  "providers": {
    "openrouter": {
      "apiKey": "..."
    },
    "anthropic": {
      "apiKey": "..."
    },
    "openai": {
      "apiKey": "..."
    },
    "deepseek": {
      "apiKey": "..."
    },
    "opencode": {
      "apiKey": "..."
    }
  },
  "permissions": {
    "read": "allow",
    "write": "ask",
    "gitLocal": "allow",
    "shell": "ask",
    "dangerous": "ask",
    "allowShell": [
      "npm test",
      "npm run test",
      "npm run build",
      "pnpm test",
      "pnpm build",
      "git status"
    ]
  },
  "paths": {
    "whitelist": ["${WORKTREE}/**", "/tmp/deepcode/**"],
    "blacklist": [
      "**/.env",
      "**/.env.*",
      "**/.ssh/**",
      "**/.aws/**",
      "**/node_modules/**",
      "/etc/**",
      "/usr/bin/**",
      "${HOME}/.config/**"
    ]
  },
  "lsp": {
    "servers": [
      {
        "languages": ["typescript", "javascript"],
        "command": "typescript-language-server",
        "args": ["--stdio"],
        "fileExtensions": [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
      }
    ]
  },
  "github": {
    "token": "...",
    "oauthClientId": "github-oauth-app-client-id",
    "oauthScopes": ["repo"],
    "enterpriseUrl": "https://github.company.com"
  }
}
```

`baseUrl` pode ser definido em qualquer provider quando for necessario apontar para um endpoint compativel diferente:

```bash
deepcode config set providers.openai.baseUrl "https://api.openai.com/v1"
```

## Validacao

O schema de configuracao e estrito. Chaves desconhecidas ou valores com tipo invalido falham em `doctor`, `run`, `chat` e nos comandos `config`, evitando typos silenciosos.

## Mascaramento

O mascaramento cobre campos cujo nome indica segredo (`apiKey`, `token`, `authorization`, `secret`, `password`, `credential`, `privateKey`) e valores sensiveis conhecidos vindos da configuracao ou de variaveis de ambiente com esses nomes. Valores com menos de quatro caracteres nao entram na lista global para evitar falsos positivos em textos comuns.

## GitHub OAuth

`deepcode github login` usa o OAuth device flow real do GitHub:

```bash
deepcode github login --client-id "github-oauth-app-client-id" --scope repo
deepcode github whoami
```

O DeepCode nao embute client ID. Crie ou configure um OAuth app no GitHub com Device Flow habilitado, informe o `client_id` por `--client-id`, `GITHUB_OAUTH_CLIENT_ID` ou `github.oauthClientId`, e escolha explicitamente os escopos por `--scope`, `GITHUB_OAUTH_SCOPES` ou `github.oauthScopes`. Ao concluir a autorizacao no navegador, o token recebido e salvo em `github.token`.

`deepcode github whoami` e `deepcode doctor` validam `github.token` com `GET /user` na API real do GitHub. O `doctor` tambem valida provider/modelo via endpoint `/models` quando a API key esta configurada.
