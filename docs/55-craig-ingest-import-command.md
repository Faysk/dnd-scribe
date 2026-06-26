# Etapa 55 - Comando unico de ingestao + import Craig

## Objetivo

Reduzir trabalho manual e preparar o caminho para o backend local fazer tudo em uma etapa.

## Implementado

Criado `tools/ingest_and_import_craig.py`.

Ele executa:

```text
Craig ZIP -> ingest_craig_session.py -> manifest.json -> import_craig_manifest.py -> Supabase
```

## Uso

```bash
python3 tools/ingest_and_import_craig.py audio/craig-session.flac.zip \
  --source-session-id craig-session-id \
  --title "Sessao X"
```

Padroes importantes:

- chunk padrao: 300 segundos, melhor para cache e retry pontual;
- campanha padrao: `yuhara-main`;
- env padrao: `.env.local`;
- sem chamada OpenAI.

## Por que isso reduz custo

A transcricao futura passa a ter o banco preenchido com:

- chunks;
- hashes;
- silencio provavel;
- status inicial `pending` ou `skipped_silence`.

Assim a fila paga consegue decidir antes de gastar:

```text
skip silence -> cache hit -> estimate -> transcribe only missing chunks
```

## Proximo passo

Plugar esse comando no endpoint local `/api/ingest/craig`, substituindo a sequencia manual por um job unico no app.
