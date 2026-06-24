# 17 — Decisões Técnicas

## Decisão 1 — Banco como fonte principal

O sistema não deve depender de Markdown como fonte principal.

Markdown pode existir como export, mas o banco deve ser a verdade operacional.

Motivo:

- auditoria;
- status;
- permissões;
- relações;
- filtros;
- revisão;
- timestamps;
- fontes múltiplas.

## Decisão 2 — Supabase no MVP

Usar Supabase para:

- auth;
- banco;
- storage;
- queues;
- RLS.

Motivo: reduz complexidade inicial.

## Decisão 3 — Worker fora da Vercel

Processamento pesado deve rodar em Docker.

Motivo:

- áudio longo;
- retries;
- ffmpeg;
- jobs demorados;
- custo/controle;
- não estourar funções serverless.

## Decisão 4 — Craig multitrack como fonte principal

Motivo:

- speaker separado;
- melhor qualidade de transcrição;
- menos diarização;
- revisão mais fácil.

## Decisão 5 — Roll20 Pro via log estruturado no chat

MVP deve gerar eventos `[YUHARA_EVENT]` no chat.

Motivo:

- simples;
- robusto;
- sem bridge externa;
- aproveita Roll20 Pro;
- fácil de parsear.

## Decisão 6 — IA só gera candidatos

A IA não canoniza sozinha.

Motivo:

- campanha longa;
- piadas misturadas;
- retcons possíveis;
- interpretação subjetiva;
- confiança da mesa.

## Decisão 7 — Publicação revisada

Nada vai para público sem status aprovado.

Motivo:

- privacidade;
- qualidade;
- controle narrativo;
- evitar lore falsa.

## Decisão 8 — Começar com sessões novas

Não tentar processar um ano inteiro primeiro.

Motivo:

- validação rápida;
- feedback real;
- menor risco;
- pipeline estabiliza antes do legado.

## Decisão 9 — Export opcional

Gerar Markdown/JSON depois.

Motivo:

- backup;
- GitHub;
- GPT;
- portabilidade.

## Decisão 10 — Permissões desde cedo

Mesmo no MVP, separar privado/público.

Motivo:

- áudio bruto sensível;
- bastidores;
- notas do mestre;
- confiança da mesa.
