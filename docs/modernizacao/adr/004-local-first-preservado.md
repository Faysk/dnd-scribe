# ADR 004 — Local-first permanece

Status: **Accepted**

## Contexto

O DnD Scribe já separa processamento pesado e conteúdo compartilhável. Áudio, FLACs, Whisper, jobs e artefatos regeneráveis permanecem no PC do operador, enquanto a nuvem guarda autenticação e resultados pequenos publicados.

## Decisão

A modernização do app público não altera esse limite. O companion e a Central Local continuam responsáveis pelo trabalho pesado.

## Alternativas consideradas

- mover transcrição e áudio para a nuvem;
- transformar o app Next em motor de processamento;
- unificar Central Local e app público.

## Motivos

- arquitetura já validada;
- custo menor;
- menor egress;
- separação clara entre operação e consumo;
- evitar exposição de caminhos/segredos locais.

## Consequências

Positivas:

- modernização web não ameaça o pipeline de áudio;
- rollback do frontend é independente do processamento local.

Custos:

- continuam existindo dois contextos operacionais diferentes;
- contratos de publicação precisam permanecer claros.
