# 20 — Pipeline de Áudio Craig Real

Este arquivo registra o primeiro teste local com um ZIP real gerado pelo Craig.

## Arquivo testado

```txt
audio/craig-AdabEqbzngmT-lbYiTJMUk5ScJGyv2x-5bSv0W566uc.flac.zip
```

A pasta `audio/` fica ignorada pelo Git.

## Conteúdo do ZIP

```txt
1-sunnrq.flac          30.262.550 bytes
2-renanyuhara.flac     34.877.185 bytes
3-faysk.flac            7.221.654 bytes
4-arutorux.flac        48.936.565 bytes
5-thomaz_17590.flac     1.541.823 bytes
info.txt                     371 bytes
raw.dat                48.230.241 bytes
```

## Info do Craig

```txt
Recording AdabEqbzngmT
Guild: Gaming Den
Channel: Copa
Requester: arutorux#0
Start time: 2026-06-24T20:22:37.612Z

Tracks:
  sunnrq#0
  renanyuhara#0
  faysk#0
  arutorux#0
  thomaz_17590#0
```

## Metadados das faixas

Todas as faixas são FLAC, 48 kHz, estéreo.

```txt
1-sunnrq.flac        92.00 min   28.9 MiB
2-renanyuhara.flac   91.98 min   33.3 MiB
3-faysk.flac         91.94 min    6.9 MiB
4-arutorux.flac      91.91 min   46.7 MiB
5-thomaz_17590.flac  92.00 min    1.5 MiB
```

## Scripts criados

```bash
python3 tools/inspect_craig_zip.py audio/craig-AdabEqbzngmT-lbYiTJMUk5ScJGyv2x-5bSv0W566uc.flac.zip --extract-dir tmp/craig-tool-inspect --probe
```

```bash
python3 tools/prepare_craig_chunks.py audio/craig-AdabEqbzngmT-lbYiTJMUk5ScJGyv2x-5bSv0W566uc.flac.zip --work-dir tmp/craig-chunk-test --track 1-sunnrq.flac --sample-seconds 60 --chunk-seconds 30
```

## Teste de conversão

O teste gerou chunks WAV mono 16 kHz:

```txt
1-sunnrq_000.wav  30.04 sec  pcm_s16le  16000 Hz  1 ch
1-sunnrq_001.wav  29.96 sec  pcm_s16le  16000 Hz  1 ch
```

## Próxima decisão técnica

Para o worker real, decidir se a transcrição vai receber:

- FLAC original em chunks, preservando compressão; ou
- WAV mono 16 kHz em chunks, mais previsível e simples, mas maior em disco.

Para o MVP local, WAV mono 16 kHz é bom para previsibilidade. Depois podemos otimizar armazenamento/custo.

## Teste OpenAI

Após organizar `.env.local`, foi testada transcrição real em dois chunks curtos.

Comando reutilizável:

```bash
python3 tools/transcribe_openai_chunk.py tmp/openai-dm-sample.wav --out tmp/openai-script-test.json --print-summary
```

Resultado do teste:

```txt
http_status=200
resposta com text + usage
```

O script não imprime a transcrição completa por padrão, apenas resumo de tamanho/uso quando `--print-summary` é usado.

## Env atual

`.env.local` foi normalizado e o conteúdo bruto original foi preservado em `.env.local.raw`.

Variáveis detectadas:

```txt
OPENAI_API_KEY
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_PUBLISHABLE_KEY
SUPABASE_PROJECT_REF
SUPABASE_DB_PASSWORD
DATABASE_URL
```

Pendente para worker/admin:

```txt
SUPABASE_SERVICE_ROLE_KEY
```

