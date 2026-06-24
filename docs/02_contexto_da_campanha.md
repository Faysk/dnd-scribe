# 02 — Contexto da Campanha

## Campanha longa e memória viva

A campanha de DnD de Yuhara tem cerca de um ano de duração, com sessões longas, múltiplos arcos, personagens que entram e saem, consequências acumuladas e um tom que mistura:

- fantasia épica;
- comédia caótica;
- drama emocional;
- música;
- política;
- memória;
- identidade;
- lendas em construção.

O núcleo atual gira em torno de:

- **Dandelion** — fada bardo em forma de pato, performático, teatral, caótico e movido pelo desejo de ser lembrado;
- **Screaky/Screacky** — kenku/arara escarlate, monge, ligada a Euclix, à profecia da Fênix Vermelha e à disputa contra Ivory;
- **Astel** — Shadar-kai paladino da Raven Queen, sombrio, protetor, ligado à família Nightshade, morte, consequência e ao corvo Hugin.

## Por que documentação comum não basta?

A campanha não é só uma sequência de acontecimentos. Ela tem camadas:

- o que aconteceu na ficção;
- o que os personagens entenderam;
- o que os jogadores especularam;
- o que o mestre confirmou;
- o que é rumor;
- o que é mentira de NPC;
- o que é piada;
- o que virou símbolo;
- o que ainda é gancho.

Um arquivo `.md` resolve quando o volume é pequeno. Mas quando a mesa cresce, o problema deixa de ser “onde escrever” e vira “como provar, revisar e manter coerência”.

## Regra de canon do projeto

O sistema deve respeitar esta separação:

```txt
Canon consolidado = verdade oficial da campanha.
Interpretação = leitura possível, não fato obrigatório.
Possível gancho = ideia que pode ser usada depois.
Sugestão = material de apoio.
Bastidor = fora de personagem, não canon.
```

## Tom da campanha

A campanha tem uma regra de ouro:

> **A piada vem na frente, a ferida vem na sombra.**

Então o sistema não deve transformar tudo em texto burocrático. Os recaps podem ter estilo, humor e personalidade, mas sempre com base em fatos aprovados.

## Exemplo de problema real

Durante uma sessão, pode acontecer algo assim:

```txt
Jogador: imagina se Astel virasse prefeito de Euclix.
Todos: risadas.
Mestre: pelo amor dos deuses, não.
Dandelion: eu faria campanha musical.
```

Isso é um ótimo bastidor. Mas **não é canon**.

Agora:

```txt
Mestre: Ivory aceita o duelo público contra Screaky diante do povo.
```

Isso é candidato forte a canon.

O sistema precisa saber separar as duas coisas. Porque se não separar, daqui três meses alguém pergunta: “pera, Astel é prefeito mesmo?” e o banco de dados responde “sim”, aí acabou, nasceu a República Sombria do Repolho.

## Entidades centrais iniciais

### Personagens jogadores

- Dandelion
- Screaky/Screacky
- Astel

### Personagens ausentes mas importantes

- Raphael
- Fire Star / Firestar

### NPCs e entidades relevantes

- Ivory
- Flander
- Leonard
- Thalindra
- Hugin
- Raven Queen
- Zhentarim
- família Nightshade

### Lugares/arcos

- Shaarwood
- Chathold
- Dandelionverso
- Floresta nevada antinatural
- Reino Eladrin
- Porta do Kenku
- Euclix

### Temas

- memória;
- voz roubada;
- arte como resistência;
- identidade pública;
- família;
- morte;
- lenda;
- performance;
- consequência.

## Implicação para o sistema

O sistema deve ter suporte nativo a:

- múltiplas versões de verdade;
- status de canon;
- fonte de evidência;
- timestamp;
- revisão humana;
- visão pública e privada;
- relação entre entidades;
- separação entre narrativa e bastidor;
- tom textual ajustável.
