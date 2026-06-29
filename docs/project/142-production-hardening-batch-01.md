# 142 - Production hardening batch 01

Data: 2026-06-29

## Escopo

Primeiro lote depois da base de producao.

Foco:

- monitoramento tecnico;
- operacao do pipeline;
- controle de storage/custo;
- preparacao para teste real do Roll20 bridge.

## Documentos criados

- `139-production-readiness-roadmap.md`
- `140-production-monitoring-console.md`
- `141-pipeline-operations-console.md`

## Decisoes

1. Monitoramento e pipeline vem antes de grandes melhorias narrativas.
2. Timeline V2 continua sendo prioridade alta, mas depois de termos operacao confiavel.
3. Roll20 automatico segue pendente de teste real da extensao Chrome.
4. Toda nova acao operacional deve ter auditoria e estado reversivel quando possivel.

## Criterio para o proximo lote

O proximo lote deve entregar codigo, nao apenas especificacao:

- expandir payload de monitoramento;
- adicionar Roll20 bridge ao monitoramento;
- exibir storage/custos por sessao;
- melhorar controle visual de jobs falhos/recuperaveis;
- documentar cada endpoint/acao nova.

