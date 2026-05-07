# DeepCode - AI Coding Agent

## Visão Geral

DeepCode é um agente de codificação AI full-stack, profissional e autônomo, projetado para operar via Terminal User Interface (TUI). O agente possui capacidades avançadas de desenvolvimento, integração com Git/GitHub, e suporte a múltiplos providers de LLM.

## Propósito

Criar um agente de codificação que combine:
- **Autonomia**: Capacidade de trabalhar de forma independente
- **Restrições Sensíveis**: Sistema robusto de permissões e aprovações
- **Multi-Provider**: Suporte a OpenRouter, Claude, GPT-4, DeepSeek e OpenCode Zen/Go
- **Interface TUI**: Interface exclusiva via terminal (sem GUI/web)
- **Integração GitHub**: Gerenciamento completo de issues, PRs e branches

## Status do Projeto

- **Fase**: Planejamento Arquitetural
- **Timeline**: 14 semanas
- **Tecnologia Base**: Node.js 20+ + TypeScript 5.5+

## Documentação

### Documentação Principal
- [01 - Visão e Requisitos](./01-vision-and-requirements.md)
- [02 - Arquitetura - 6 Camadas](./02-architecture-overview.md)
- [03 - Stack Tecnológica](./03-technology-stack.md)
- [04 - Fases de Implementação](./04-implementation-phases.md)

### Documentação Técnica Detalhada
- [05 - Design da TUI](./05-tui-design.md)
- [06 - Modelo de Segurança](./06-security-model.md)
- [07 - Abstração de Providers](./07-provider-abstraction.md)
- [08 - Sistema de Ferramentas](./08-tool-system.md)
- [09 - Loop do Agente](./09-agent-loop.md)
- [10 - Integração GitHub](./10-github-integration.md)
- [11 - Estratégia de Busca](./11-search-strategy.md)
- [12 - Gerenciamento de Estado](./12-state-management.md)
- [13 - Estratégia de Testes](./13-testing-strategy.md)

### Registro de Decisões
- [14 - Log de Decisões](./14-decisions-log.md)

## Inspiração

Este projeto é fortemente inspirado no [OpenCode CLI](https://opencode.ai), analisado e adaptado para Node.js/TypeScript com foco em performance e baixa latência.

## Licença

MIT License - Em definição

---

**Nota**: Esta documentação representa o estado atual do planejamento. Alterações podem ocorrer durante a implementação.
