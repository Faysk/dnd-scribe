# 090 - Roll20 macro pack

Date: 2026-06-27

## Goal

Create the first low-risk Roll20 integration layer around table chat commands. This lets the DM and players mark important moments during play without requiring fragile browser automation or direct Roll20 API dependency in production.

Roll20 prefix: `!dnd`

## Recommended macros

### Session marker

Use when the session starts, pauses, resumes, or ends.

```text
!dnd sessao estado:inicio titulo:"Nome da sessao"
!dnd sessao estado:pausa motivo:"intervalo"
!dnd sessao estado:retorno
!dnd sessao estado:fim
```

### Canon note

Use for facts that should enter DM review.

```text
!dnd canon tipo:lore texto:"A informacao importante aqui"
!dnd canon tipo:npc texto:"Nome, detalhe, relacao ou segredo percebido"
!dnd canon tipo:local texto:"Local, contexto e importancia"
!dnd canon tipo:item texto:"Item, dono atual e origem"
```

### Character action

Use for actions worth preserving in the chronicle.

```text
!dnd acao personagem:"Dandelion" texto:"Descricao curta da acao"
!dnd acao personagem:"Astel" texto:"Descricao curta da acao"
```

### DM-only marker

Use for private backstage notes. The app should store this as backstage and visible to DM only unless explicitly promoted.

```text
!dnd dm tipo:bastidor texto:"Nota privada do DM"
!dnd dm tipo:gancho texto:"Gancho futuro ou segredo"
```

### Cost/processing marker

Use when the DM wants the audio pipeline to treat something as important.

```text
!dnd audio prioridade:alta motivo:"Cena importante"
!dnd audio ignorar motivo:"Conversa fora de jogo"
```

## Parsing rules

Initial parser rules should be intentionally simple:

1. Commands must start with `!dnd`.
2. The first word after the prefix is the command name.
3. Arguments use `chave:valor`.
4. Quoted values can contain spaces.
5. Unknown commands are stored as raw table notes, not discarded.
6. DM approval is required before any Roll20 note becomes final canon.

## Permission model

- DM can create, edit, approve, reject, or promote any Roll20-derived note.
- Players can create candidate notes for their own actions and perceived canon.
- Backstage/DM-only notes stay hidden from players.
- The app database remains the source of truth after ingestion.

## Production stance

This macro pack is production-safe because it only depends on chat text that can be copied/exported or later ingested by automation. It does not require the Roll20 password in server-side jobs and does not require storing browser cookies.

The operator account is reserved for validation and setup checks.
