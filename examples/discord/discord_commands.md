# Discord Commands — Ideia inicial

## Comandos MVP

```txt
/sessao iniciar titulo: arco:
/sessao encerrar
/cena nome:
/momento tipo: texto:
/canon texto:
/fala personagem: texto:
/bastidor texto:
/cortar texto:
/duvida texto:
/pausa
/voltei
```

## Tipos de momento

```txt
canon
fala
bastidor
cortar
duvida
npc
item
gancho
combate
cena
```

## Payload sugerido

```json
{
  "source": "discord",
  "session_id": "2026-06-27_sessao-XX",
  "marker_type": "canon",
  "text": "Ivory aceitou o duelo público",
  "discord_user_id": "123",
  "channel_id": "456",
  "created_at": "2026-06-27T22:10:00Z"
}
```
