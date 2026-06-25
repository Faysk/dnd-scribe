# 28 — Resultado da Etapa 5: Storage

## Objetivo

Salvar em storage duravel os arquivos importantes da primeira sessao real e atualizar o Supabase para apontar para esses objetos.

## Decisao

Usar Cloudflare R2 no MVP para:

- ZIP original do Craig;
- faixas FLAC extraidas;
- `info.txt`;
- artefatos processados;
- respostas raw de transcricao da OpenAI;
- transcript master em JSON e Markdown.

O Supabase continua sendo a fonte de metadados, relacionamentos e estados de processamento.

Chunks WAV nao foram enviados por padrao. Eles ocupam muito espaco e podem ser regenerados a partir do ZIP/FLAC.

## Layout

Prefixo da sessao:

```txt
campaigns/yuhara-main/sessions/craig-AdabEqbzngmT-stage1-full
```

Estrutura:

```txt
raw/source/
raw/craig/
raw/tracks/
processed/
processed/transcripts/
processed/transcripts/raw/{track_key}/
```

## Ferramentas criadas

```txt
tools/sync_session_to_r2.py
tools/create_r2_presigned_url.py
```

## Comandos usados

Plano seco:

```bash
python3 tools/sync_session_to_r2.py \
  tmp/sessions/craig-AdabEqbzngmT-stage1-full \
  --dry-run \
  --manifest-out tmp/storage/r2_plan.json
```

Sync real + atualizacao do banco:

```bash
python3 tools/sync_session_to_r2.py \
  tmp/sessions/craig-AdabEqbzngmT-stage1-full \
  --update-db \
  --manifest-out tmp/sessions/craig-AdabEqbzngmT-stage1-full/storage/r2_manifest.json
```

Teste de URL assinada:

```bash
python3 tools/create_r2_presigned_url.py \
  --manifest tmp/sessions/craig-AdabEqbzngmT-stage1-full/storage/r2_manifest.json \
  --role transcript_master_md \
  --expires 300 \
  --check \
  --quiet
```

## Resultado validado

Primeiro sync:

```txt
objects=65
uploaded=65
bytes=277150498
chunks_included=0
```

Segundo sync:

```txt
objects=65
skipped=65
bytes=277150498
chunks_included=0
```

Distribuicao:

```txt
raw_objects=7
raw_bytes=276797439
processed_objects=58
processed_bytes=353059
```

Supabase:

```txt
recording_files com storage_bucket=dnd-scribe-audio: 15
recording_files bytes: 277106125
processing_job r2_storage_sync: succeeded
attempts: 2
```

URL assinada:

```txt
check_status=206
```

O status `206` e esperado porque o teste usa `Range: bytes=0-0`, validando acesso parcial sem baixar o arquivo inteiro.

## Observacoes

- O manifesto local do sync fica em `tmp/sessions/.../storage/r2_manifest.json`, fora do Git.
- Os 50 JSONs raw das transcricoes foram enviados ao R2, mas nao viraram linhas individuais em `recording_files`; eles ficam rastreados pelo manifesto de storage.
- Se for necessario subir chunks WAV no futuro, rodar o sync com `--include-chunks`.

## Proximo passo recomendado

Etapa 6: Review Board MVP.

O foco agora deve ser uma tela simples para navegar por segmentos, filtrar por speaker/personagem e corrigir dados antes de qualquer classificacao de canon.
