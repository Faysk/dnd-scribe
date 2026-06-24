# 04 — Pipeline de Captura

## Objetivo

Garantir que a sessão seja registrada com fontes suficientes para permitir transcrição, revisão e auditoria.

## Fontes da sessão

### Fonte 1 — Craig multitrack

Principal fonte de áudio.

Ideal porque cada jogador fica em uma faixa separada:

```txt
Dandelion.flac
Astel.flac
Screaky.flac
Mestre.flac
Outros.flac
```

Vantagens:

- melhora identificação de speaker;
- reduz necessidade de diarização;
- facilita cortar conversa aleatória;
- permite revisar fala de um jogador específico;
- ajuda a separar fala em personagem e fora de personagem.

### Fonte 2 — OBS backup

Gravação de segurança:

- áudio geral;
- tela do Roll20;
- Discord;
- mapa;
- estado visual da sessão.

Vantagens:

- salva a sessão se Craig falhar;
- permite ver contexto visual;
- ajuda a entender cena, mapa, tokens e combate;
- pode servir para cortes futuros.

### Fonte 3 — Roll20 chat/export

Fonte estruturada de:

- rolagens;
- macros;
- mensagens;
- whispers;
- comandos do Yuhara Logger;
- início/fim de combate;
- cenas;
- marcadores de canon.

### Fonte 4 — Marcadores humanos

Podem vir de:

- Craig `/note`;
- Discord slash commands;
- Roll20 `!ys` commands;
- notas manuais no site.

Marcadores recomendados:

```txt
CANON
FALA
BASTIDOR
CORTAR
DUVIDA
CENA
PAUSA
COMBATE
ITEM
NPC
GANCHO
```

## Fluxo antes da sessão

```txt
1. Criar sessão no Yuhara Scribe.
2. Definir título provisório.
3. Definir arco atual.
4. Definir participantes e personagens.
5. Confirmar consentimento de gravação.
6. Iniciar Craig.
7. Iniciar OBS.
8. Iniciar Roll20 Logger.
9. Testar áudio.
```

## Fluxo durante a sessão

Durante a sessão, a mesa usa marcadores rápidos:

```txt
/note CANON: Ivory aceitou duelo público
/note FALA: discurso forte do Dandelion
/note BASTIDOR: piada do Astel prefeito
!ys scene Praça do Duelo
!ys combat start
!ys canon Screaky revelou as penas vermelhas
```

A regra é: **marcar é barato, revisar depois é que decide**.

## Fluxo depois da sessão

```txt
1. Parar Craig.
2. Baixar arquivos Craig.
3. Salvar OBS.
4. Exportar chat/log do Roll20.
5. Subir tudo no Yuhara Scribe.
6. Conferir metadata.
7. Enfileirar processamento.
```

## Estrutura de pasta por sessão

```txt
sessions/
  2026-06-27_sessao-XX_duelo-ivory/
    00_metadata.yaml
    raw/
      craig_dandelion.flac
      craig_astel.flac
      craig_screaky.flac
      craig_dm.flac
      obs_backup.mkv
      roll20_chat.html
      craig_info.txt
    processed/
      transcript_raw.json
      transcript_merged.json
      transcript_clean.md
      roll20_events.json
      markers.json
    review/
      canon_candidates.json
      quote_candidates.json
      outtake_candidates.json
      review_board.md
    public/
      recap_curto.md
      recap_completo.md
      canon_changes.md
      bastidores_aprovados.md
```

## Boas práticas de áudio

- Todo mundo usar fone.
- Evitar música muito alta no mesmo canal da fala.
- Mestre e jogadores com microfone minimamente regulado.
- Craig sempre principal.
- OBS sempre backup.
- Teste rápido antes de começar.
- Se alguém cair/reentrar no Discord, marcar no log.

## Falhas previstas

### Craig falhou

Usar OBS backup + diarização.

### OBS falhou

Usar Craig + Roll20 logs.

### Roll20 chat não foi exportado

Usar áudio + marcadores Craig/Discord.

### Ninguém marcou nada

IA processa tudo, mas a revisão vai ser mais chata. Aí é aquele famoso: “quem não marca, revisa dobrado”.
