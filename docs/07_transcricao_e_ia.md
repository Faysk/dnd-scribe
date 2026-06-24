# 07 — Transcrição e IA

## Objetivo

Transformar áudio bruto em transcrição organizada, com timestamps, falantes e relação com personagens.

## Estratégia principal

Como Craig gera áudio separado por participante, a estratégia recomendada é:

```txt
transcrever cada faixa separadamente
→ mapear faixa para jogador/personagem
→ juntar por timestamp
→ gerar transcript master
```

Isso é melhor do que diarização em áudio misturado, porque:

- reduz confusão de falante;
- melhora revisão;
- facilita análise por personagem;
- permite detectar conversas sobrepostas;
- evita depender da IA para descobrir quem é quem.

## Modelos OpenAI

Uso recomendado:

```txt
gpt-4o-transcribe
```

Para cada faixa de áudio separada.

Uso opcional:

```txt
gpt-4o-transcribe-diarize
```

Para áudio misturado, OBS ou backup quando Craig falhar.

## Problema de arquivos grandes

Sessões de 6 horas geram arquivos grandes. O worker deve:

```txt
1. converter áudio;
2. normalizar volume;
3. quebrar em chunks;
4. manter overlap de alguns segundos;
5. transcrever;
6. remover duplicatas do overlap;
7. juntar resultado.
```

## ffmpeg

Comandos típicos:

```bash
ffmpeg -i input.flac -ac 1 -ar 16000 output.wav
```

Dividir em chunks de 10 minutos:

```bash
ffmpeg -i output.wav -f segment -segment_time 600 -c copy chunks/out_%03d.wav
```

## Glossário da campanha

A transcrição deve receber contexto com nomes próprios.

Exemplo:

```txt
Campanha de DnD em português.
Termos importantes:
Dandelion, Astel, Arthur, Screaky, Screacky, Euclix, Ivory, Flander,
Thalindra, Leonard, Raphael, Fire Star, Hugin, Raven Queen,
Zhentarim, Nightshade, Dandelionverso, Porta do Kenku,
Rainha de Penas Vermelhas, O Reino Vai Cantar.

Preserve nomes próprios.
Não traduza nomes.
Não corrija Screaky para squeaky.
Não transforme piadas fora de personagem em canon.
```

## Transcript master

Formato recomendado:

```json
{
  "session_id": "2026-06-27_sessao-XX",
  "segments": [
    {
      "start_ms": 123000,
      "end_ms": 129500,
      "speaker": "Renan",
      "character": "Dandelion",
      "source_file": "craig_dandelion.flac",
      "text": "Eu não manipulo pessoas. Eu conduzo emoções. É diferente."
    }
  ]
}
```

## Pós-processamento

Depois da transcrição bruta:

- corrigir nomes próprios com glossário;
- detectar palavras-chave;
- detectar marcadores falados;
- alinhar com Roll20;
- separar trechos longos;
- classificar tipo de fala;
- detectar candidatos de canon.

## Detecção de marcadores falados

A mesa pode falar frases como:

```txt
MARCA CANON
MARCA FALA
MARCA BASTIDOR
MARCA DÚVIDA
MARCA CORTE
```

O worker procura essas frases na transcrição e cria markers.

## Cuidado com alucinação

A IA não deve inventar nomes, eventos ou intenções.

Regras:

- Se não tem fonte, não vira fato.
- Se a fala está ambígua, marcar `needs_review`.
- Se parece piada, marcar como bastidor/fora de jogo.
- Se é especulação, marcar como interpretação ou possível gancho.
- Se é confirmado pelo mestre ou ação em cena, pode virar candidato de canon.
