# 162 - Paid Transcription Confirmation Guard

## Objetivo

Adicionar uma trava explicita de backend para qualquer transcricao paga disparada pela central operacional.

## Contexto

A UI ja mostrava confirmacao e teto de custo antes de disparar transcricao, mas o endpoint aceitava `execute=true` desde que o custo estimado estivesse dentro da aprovacao. Para producao, a regra deve ser mais forte: chamada paga precisa carregar uma intencao explicita, igual ao fluxo de review IA e cleanup R2.

## Mudanca

- `api/[...path].js` agora exige `confirm="RUN_TRANSCRIPTION_AI"` quando `dispatch_transcription` vem com `execute=true`.
- `web/jobs.js` passa a enviar essa confirmacao somente para a acao real paga.
- Simulacao de transcricao continua liberada sem confirmacao textual.
- A trava de teto `approveCostUsd` permanece obrigatoria e continua bloqueando custo estimado acima da aprovacao.

## Resultado operacional

Mesmo que alguem chame o endpoint manualmente, uma transcricao paga nao inicia sem duas protecoes: confirmacao explicita de intencao e teto financeiro aprovado.
