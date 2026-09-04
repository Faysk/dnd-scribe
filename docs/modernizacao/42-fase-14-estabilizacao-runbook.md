# 42 — Fase 14: Runbook de estabilização

Status: **RUNBOOK PRONTO — execução depende do cutover**  
Data: **2026-09-04**

## Objetivo

Deixar a estabilização pós-cutover operacionalmente pronta antes da mudança de domínio.

A Fase 14 só começa depois que produção estiver no Next. Este documento define o que observar e como registrar sem precisar improvisar em incidente.

## Janela

Direção padrão:

```txt
mínimo 7 dias corridos
```

Estender quando houver correção critical/high, mudança relevante em auth/gateway ou uso real insuficiente.

## Primeiras horas

Monitorar prioritariamente:

```txt
5xx
401/403 inesperados
/auth/callback
/api/web/*
legacy fallback /api/*
/edit*
/central-local*
transcript
image optimizer
```

## Diagnóstico por camada

Para cada incidente responder nesta ordem:

```txt
1. falhou no Next local?
2. falhou no BFF?
3. falhou no rewrite/gateway?
4. falhou no upstream legado?
5. falhou no Supabase/Auth?
6. falhou em integração externa?
```

Isso evita hotfix aleatório em camada errada.

## Checklist diário leve

```txt
[ ] 5xx fora do padrão?
[ ] 401/403 inesperados?
[ ] callbacks OAuth com erro?
[ ] /api/web saudável?
[ ] legacy fallback saudável?
[ ] Central Local/Edit acessíveis?
[ ] crons/jobs do legado executando?
[ ] imagens com erro?
[ ] transcrição com timeout/erro?
[ ] feedback novo da mesa?
[ ] issue nova critical/high?
[ ] correção publicada hoje?
```

## Fluxos de uso real obrigatórios

Durante a janela registrar pelo menos:

```txt
login/retorno autenticado
Home
/sessoes
resumo
transcrição
busca
speaker filter
download
mobile
dark/light
```

Idealmente incluir uso próximo de uma sessão real da mesa.

## Incidente — template

```md
### INC-YYYYMMDD-NN

Severidade: critical | high | medium | low
Início:
Fim:
Camada: Next | BFF | gateway | legado | Supabase | integração
Sintoma:
Impacto:
Como reproduzir:
Logs/evidência:
Mitigação:
Correção:
Rollback necessário? sim/não
PR/commit:
Reteste:
Status:
```

Não anexar secrets, cookies ou tokens.

## Registro diário — template

```md
## YYYY-MM-DD

- 5xx: normal | investigar
- auth: normal | investigar
- gateway: normal | investigar
- legado: normal | investigar
- crons/jobs: normal | investigar
- feedback: nenhum | resumo
- issues abertas:
- mudanças publicadas:
- decisão do dia: manter | observar | rollback
```

## Severidade

### Critical

- segredo/dado privado exposto;
- autorização quebrada;
- indisponibilidade geral;
- integração com efeito destrutivo.

### High

- login quebrado para grupo relevante;
- sessão/resumo/transcrição inacessíveis;
- gateway crítico quebrado;
- mobile inutilizável.

### Medium/Low

Podem permanecer somente com aceite explícito e sem ameaçar estabilidade.

## Rollback durante estabilização

Rollback continua disponível enquanto for operacionalmente mais seguro que forward fix.

Critérios fortes:

```txt
auth sistêmica quebrada
autorização incorreta
gateway sistêmico quebrado
integração crítica quebrada
5xx persistente
```

Depois de estabilidade comprovada, defeitos isolados podem preferir forward fix.

## Feature freeze

Durante toda a janela continuam proibidos:

```txt
Pessoas/NPCs
Lore editável
Mundo
Timeline
Grafo
Coleções
Busca global
```

Bug da migração não disputa prioridade com feature nova.

## Critério de saída preparado

```txt
janela/uso suficiente             ⬜
critical = 0                      ⬜
high = 0                          ⬜
auth estável                      ⬜
Home/sessões/resumo estáveis      ⬜
transcrição estável               ⬜
mobile aprovado                   ⬜
dark/light aprovados              ⬜
gateway legado estável            ⬜
crons/jobs sem regressão          ⬜
integrações sem regressão conhecida⬜
performance real aceitável        ⬜
documentação fiel à produção      ⬜
```

Os checks ficam vazios até produção real fornecer evidência.

## Standby

Nada neste runbook exige mudança adicional antes do cutover. A execução cronológica da Fase 14 fica em standby junto da entrada em produção do Next.
