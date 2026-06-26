# Etapa 54 - Import do manifest Craig para o banco

## Objetivo

Levar o resultado da ingestao local Craig para o Supabase sem chamar OpenAI.

Isso fecha a ponte:

```text
Craig ZIP -> manifest local -> recording_files/audio_chunks no banco
```

## Implementado

Criado `tools/import_craig_manifest.py`.

Ele le `tmp/sessions/<id>/manifest.json` e faz upsert logico de:

- `sessions`;
- `participants`;
- `recording_files`;
- `audio_chunks`.

Tambem persiste campos fundamentais para economia:

- `sha256`;
- `audio_dbfs`;
- `probably_silent`;
- `silence_dbfs_threshold`;
- `transcription_status` como `skipped_silence` quando aplicavel.

## Uso local

```bash
python3 tools/import_craig_manifest.py tmp/sessions/<id>/manifest.json
```

Com opcoes:

```bash
python3 tools/import_craig_manifest.py tmp/sessions/<id>/manifest.json \
  --campaign yuhara-main \
  --source-session-id craig-xxxxx \
  --title "Sessao X"
```

## Importante

O script nao faz chamadas OpenAI e nao gera custo. Ele so prepara o banco para a fila de transcricao decidir:

```text
probably_silent=true -> skip
sha256 ja existe em transcription_cache -> cache hit
sem cache e dentro do budget -> pode transcrever
```

## Proximo passo

Integrar esse import ao job local de upload Craig para que, ao terminar a ingestao, o backend ja registre manifest, arquivos e chunks no banco automaticamente.
