# 08 — Classificação, Auditoria e Canon

## Objetivo

Separar o que foi dito na sessão em categorias úteis e impedir que ruído vire lore oficial.

## Regra de ouro

```txt
Nada vira canon sem fonte.
Nada é publicado sem revisão.
Nada sensível vira bastidor público sem aprovação.
```

## Categorias de segmentos

```ts
type SegmentType =
  | "dm_narration"
  | "in_character"
  | "player_action"
  | "mechanics"
  | "roll_result"
  | "table_planning"
  | "lore_discussion"
  | "ooc_chatter"
  | "joke"
  | "break"
  | "technical"
  | "sensitive_private"
  | "candidate_quote"
  | "candidate_canon"
  | "candidate_outtake";
```

## Status de canon

```txt
raw                 = dado bruto ainda sem análise
candidate           = candidato gerado pela IA ou marcador humano
approved_canon      = aprovado como canon
rejected            = rejeitado
interpretation      = leitura possível, não fato
possible_hook       = gancho futuro
retcon_pending      = precisa ajuste/revisão do mestre
private             = privado
outtake_approved    = bastidor aprovado
published           = publicado
```

## O que pode virar canon?

Pode virar candidato de canon:

- ação realizada por personagem;
- decisão tomada;
- revelação do mestre;
- fala de NPC com peso factual;
- consequência mecânica relevante;
- morte;
- item recebido/perdido;
- mudança de lugar/facção;
- pacto;
- juramento;
- duelo marcado;
- descoberta;
- evento público;
- mudança de reputação.

## O que não deve virar canon?

Não deve virar canon:

- piada fora de personagem;
- plano que não foi executado;
- especulação de jogador;
- conversa pessoal;
- comentário técnico;
- meme;
- discussão de regra sem consequência narrativa;
- interpretação simbólica sem confirmação;
- sugestão de futuro;
- “seria engraçado se...”.

## Exemplo

### Trecho

```txt
Jogador: imagina se o Astel virasse prefeito de Euclix.
```

Classificação:

```json
{
  "type": "joke",
  "canon_relevance": "none",
  "outtake_candidate": true,
  "canon_candidate": false
}
```

### Trecho

```txt
Mestre: Ivory aceita o duelo contra Screaky diante do povo.
```

Classificação:

```json
{
  "type": "dm_narration",
  "canon_relevance": "high",
  "canon_candidate": true,
  "needs_review": true
}
```

## Tela de auditoria

A tela ideal tem quatro áreas:

```txt
Timeline | Transcrição | Candidatos | Fonte/Áudio
```

### Ações rápidas

```txt
Canon
Não canon
Interpretação
Gancho futuro
Retcon pendente
Fala marcante
Bastidor aprovado
Privado
Corrigir speaker
Corrigir texto
Cortar trecho
```

### Atalhos de teclado

```txt
C = canon
I = interpretação
G = gancho
Q = quote
B = bastidor
X = rejeitar
P = privado
S = speaker errado
T = transcrição errada
```

## Fonte obrigatória

Cada item aprovado deve apontar para:

- segmento de transcrição;
- timestamp inicial/final;
- arquivo de áudio;
- evento Roll20, se houver;
- marcador humano, se houver.

Exemplo:

```json
{
  "claim": "Ivory aceitou duelo público contra Screaky.",
  "status": "approved_canon",
  "sources": {
    "segments": ["seg_123"],
    "audio": "craig_dm.flac",
    "start_ms": 4523000,
    "end_ms": 4569000,
    "roll20_events": ["roll20_event_77"]
  }
}
```

## Níveis de confiança

```txt
0.90–1.00 = muito provável
0.70–0.89 = provável, revisar
0.40–0.69 = ambíguo, revisar com cuidado
0.00–0.39 = fraco, provavelmente rejeitar
```

## Regras especiais

### Falas marcantes

Podem ser em personagem ou fora de personagem, mas devem ser revisadas.

Campos:

- personagem;
- jogador;
- texto;
- contexto;
- fonte;
- aprovado para público?

### Bastidores

Bastidor não é canon.

Pode ser:

- engraçado publicável;
- privado;
- técnico;
- sensível;
- cortar.

### Interpretação

Interpretação é permitida, mas deve aparecer como interpretação.

Exemplo:

```txt
Interpretação: Dandelion parece perceber que sua música saiu do controle e virou símbolo do povo.
```

Não publicar como:

```txt
Dandelion percebeu oficialmente que sua música saiu do controle.
```

A diferença é pequena, mas é aí que mora o diabinho do retcon.
