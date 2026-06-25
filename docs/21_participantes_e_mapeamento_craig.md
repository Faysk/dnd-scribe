# 21 — Participantes e Mapeamento Craig

Este arquivo registra o mapeamento inicial entre nicks do Craig/Discord, pessoas reais e personagens padrão.

## Mapeamento atual

```txt
sunnrq        -> Fernanda -> Screacky
renanyuhara   -> Yuhara   -> DM
faysk         -> Renan    -> Dandelion
arutorux      -> Arthur   -> Astel
thomaz_17590  -> Random   -> convidado/indefinido
```

## Regras importantes

- Um jogador pode interpretar mais de um personagem.
- Pessoas aleatórias podem entrar na sessão.
- Novos players podem aparecer futuramente.
- O mapeamento de faixa define a pessoa/falante base, não uma verdade fixa de personagem para todos os trechos.
- Personagem por trecho deve poder ser corrigido na revisão.
- Faixa desconhecida entra como `guest_or_unknown` e precisa de revisão humana.

## Configuração

Arquivo usado pelos scripts:

```txt
config/craig_user_map.json
```

## Implicação para o banco

O modelo precisa separar:

```txt
profiles / pessoas
participants / presença em uma sessão
participant_characters / personagens possíveis naquela sessão
transcript_segments.character_name / personagem inferido ou corrigido por trecho
```

Isso evita travar uma faixa inteira em um único personagem quando alguém interpreta NPC, personagem secundário ou convidado.
