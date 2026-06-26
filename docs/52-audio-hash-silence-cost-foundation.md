# Etapa 52 - Hash e silencio antes de transcrever

## Objetivo

Criar a base tecnica para reduzir custo antes de qualquer chamada OpenAI paga.

## Implementado

- `tools/ingest_craig_session.py` agora calcula `sha256` para arquivos de audio originais e chunks.
- Chunks WAV gerados pelo ffmpeg recebem metadados simples de volume:
  - `audio_rms`;
  - `audio_peak`;
  - `audio_dbfs`;
  - `probably_silent`;
  - `silence_dbfs_threshold`.
- `tools/estimate_ai_cost.py` agora usa `probably_silent` quando o manifest tem essa informacao.
- A politica em `config/ai_cost_policy.json` documenta o threshold padrao de silencio.

## Por que isso reduz custo

Hash permite cache forte:

```text
mesmo chunk -> mesmo sha256 -> transcript reutilizavel -> zero custo OpenAI
```

Silencio permite pular chamada paga:

```text
chunk provavelmente silencioso -> nao transcrever -> zero custo OpenAI
```

## Limites conhecidos

- O detector de silencio e simples e usa volume medio do WAV, nao VAD neural.
- Ele serve como freio inicial, nao como verdade absoluta.
- Trechos baixos, sussurrados ou com musica podem exigir revisao ou threshold diferente.

## Proximo passo recomendado

Criar cache persistente de transcricoes por `sha256` no banco/local:

```text
audio_sha256 -> model -> transcript -> usage/cost -> created_at
```

A transcricao so deve chamar OpenAI quando esse cache nao tiver resultado valido.
