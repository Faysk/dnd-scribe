# 14 — Prompts de IA

## Objetivo

Padronizar prompts para transcrição, classificação, extração e publicação.

Os prompts devem ser versionados, testados e melhorados com sessões reais.

## Regras gerais

- Não inventar eventos.
- Não transformar piada em canon.
- Não publicar bastidor sem aprovação.
- Não misturar interpretação com fato.
- Sempre preservar timestamp e fonte.
- Se houver dúvida, marcar `needs_review`.

## Prompt de glossário para transcrição

Veja arquivo:

```txt
examples/prompts/transcription_context.md
```

## Prompt de classificação de segmentos

Veja:

```txt
examples/prompts/classify_segments.md
```

## Prompt de extração de canon

Veja:

```txt
examples/prompts/extract_canon.md
```

## Prompt de bastidores

Veja:

```txt
examples/prompts/extract_outtakes.md
```

## Prompt de publicação

Veja:

```txt
examples/prompts/build_recap.md
```

## Prompt de entidades

Sugestão:

```txt
Extraia entidades citadas na sessão.

Tipos permitidos:
- pc
- npc
- location
- item
- organization
- faction
- arc
- concept
- song
- quest

Para cada entidade:
- nome canônico sugerido;
- variações de nome;
- tipo;
- contexto;
- primeira menção na sessão;
- relevância;
- se já parece existir no banco;
- se precisa revisão humana.

Não crie entidade se a menção for piada claramente fora de personagem.
```

## Prompt de “previously on”

```txt
Crie um resumo curto para abrir a próxima sessão.

Use apenas fatos aprovados como canon.
Tom: fantasia épica com leve humor de mesa.
Não inclua bastidores.
Não invente.
Máximo: 250 palavras.
Finalizar com 3 pendências importantes.
```

## Prompt de versão Dandelion

```txt
Crie uma versão teatral do recap como se Dandelion estivesse abrindo a sessão.

Regras:
- usar apenas canon aprovado;
- pode ser dramático e engraçado;
- não inventar eventos;
- não exagerar a ponto de mudar o fato;
- tom de bardo performático;
- piada na frente, ferida na sombra.
```

## Prompt de versão Mestre

```txt
Crie uma versão objetiva do recap para o mestre.

Incluir:
- eventos principais;
- consequências;
- NPCs envolvidos;
- ganchos abertos;
- perguntas pendentes;
- riscos imediatos;
- inconsistências ou pontos para decidir.

Não usar floreio.
```

## Boas práticas

- Guardar prompt usado em cada execução.
- Guardar modelo usado.
- Guardar output bruto.
- Guardar output editado.
- Comparar resultados entre sessões.
- Criar avaliação manual: bom, médio, ruim.
