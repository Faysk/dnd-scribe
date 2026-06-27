# Etapa 080 - Fix table notes directory RPC

Data: 2026-06-27

## Problema encontrado

Durante o smoke autenticado dos RPCs de acesso/notas, `table_notes_directory('yuhara-main', null)` falhou com:

```txt
column reference "source_session_id" is ambiguous
```

O parametro `source_session_id` tinha o mesmo nome da coluna `sessions.source_session_id`, e o filtro da funcao nao qualificava a referencia.

## Correcao

O RPC `public.table_notes_directory(text, text)` foi recriado qualificando explicitamente o parametro como:

```sql
table_notes_directory.source_session_id
```

Arquivo registrado:

- `schemas/20260627_015_fix_table_notes_directory_source_session_parameter.sql`

## Verificacao

Smoke autenticado simulando `auth.uid()` de um membro da campanha:

```txt
access_ok=true
notes_ok=true
```

Smoke anonimo apos hardening:

```txt
POST /rest/v1/rpc/access_directory -> 401 permission denied
```

## Estado

A aba `Notas` pode chamar o RPC sem bater nessa ambiguidade. O acesso continua restrito a usuarios autenticados e roles da campanha.
