# 05 — Roll20 Pro Logger

## Objetivo

Usar o Roll20 Pro do Arthur/Astel para registrar eventos estruturados da sessão.

O Roll20 continua sendo a mesa virtual. O Logger apenas cria evidências e marcadores para o Yuhara Scribe.

## Estratégia recomendada

No MVP, evitar integração externa em tempo real.

O Mod Script grava eventos estruturados no próprio chat do Roll20, assim:

```txt
[YUHARA_EVENT] {"type":"scene","label":"Praça do Duelo","session":"2026-06-27_sessao-XX"}
```

Depois da sessão:

```txt
exportar chat do Roll20
→ subir no Yuhara Scribe
→ parser extrai eventos
→ salva em roll20_events
```

## Por que não começar com envio externo direto?

Mod Scripts do Roll20 rodam em sandbox. A melhor aposta inicial é gerar logs no chat, porque é simples, robusto e não depende de gambiarras no navegador.

Mais tarde, dá para criar bridge:

```txt
Roll20 aberto no navegador
→ extensão/Tampermonkey/local sidecar
→ API do Yuhara Scribe
```

Mas isso é fase 2 ou 3. MVP não precisa meter um Frankstein logo no berço.

## Comandos sugeridos

```txt
!ys start <session_id>
!ys end
!ys scene <nome da cena>
!ys canon <texto>
!ys quote <personagem>: <fala>
!ys ooc <texto>
!ys cut <texto>
!ys doubt <texto>
!ys npc <nome> <nota>
!ys item <nome> <nota>
!ys hook <texto>
!ys combat start
!ys combat end
!ys break
!ys back
```

## Eventos automáticos possíveis

O script pode escutar:

- mensagens de chat;
- inline rolls;
- templates de rolagem;
- alteração de turno;
- início/fim manual de combate;
- mudança de página/mapa;
- tokens alterados;
- status markers.

## Eventos salvos

### Cena

```json
{
  "source": "roll20",
  "type": "scene",
  "label": "Praça do Duelo",
  "session_id": "2026-06-27_sessao-XX",
  "roll20_who": "Arthur",
  "created_at_roll20": "unknown"
}
```

### Canon manual

```json
{
  "source": "roll20",
  "type": "canon_marker",
  "text": "Ivory aceitou duelo público contra Screaky",
  "session_id": "2026-06-27_sessao-XX",
  "created_by": "DM"
}
```

### Rolagem

```json
{
  "source": "roll20",
  "type": "roll",
  "who": "Astel",
  "formula": "1d20+8",
  "result": 27,
  "context_guess": "Intimidação/Persuasão",
  "raw": {}
}
```

## Sincronização com áudio

O Roll20 não necessariamente tem timestamp absoluto igual ao áudio.

Estratégias:

### Simples

Usar ordem dos eventos e aproximar manualmente na revisão.

### Melhor

No início da sessão, fazer um marcador sincronizado:

```txt
Mestre fala em voz alta: SINCRONIZAR YUHARA AGORA
Roll20: !ys sync
Craig: /note SYNC
```

Isso cria ponto comum entre áudio, Craig e Roll20.

### Ideal

Guardar horário local exato no sistema quando o comando é usado via Discord/site.

## Exemplo de comando de sincronização

```txt
!ys sync sessão começou oficialmente
```

No áudio, alguém fala:

```txt
SYNC YUHARA
```

Depois o worker localiza a frase no transcript e alinha eventos.

## Regras de uso na mesa

- Só o mestre e jogadores autorizados devem marcar canon.
- Qualquer jogador pode marcar fala, bastidor ou dúvida.
- Canon marcado ao vivo ainda é **candidato**, não publicação automática.
- O Roll20 Logger não substitui revisão humana.

## Arquivo de exemplo

Veja:

```txt
examples/roll20/yuhara_logger_script.js
```
