# 06 — Discord, Craig e OBS

## Objetivo

Definir como capturar comunicação, áudio e backup visual da sessão.

## Discord

Usado para:

- voz da sessão;
- comandos rápidos;
- avisos;
- logs;
- notificações do sistema;
- canal de revisão/recap;
- bot futuro.

## Craig

Craig é a fonte principal de áudio.

### Fluxo básico

```txt
1. Entrar no canal de voz.
2. Usar /join para iniciar gravação.
3. Usar /note para marcar momentos.
4. Usar /stop no fim.
5. Baixar arquivos por participante.
6. Subir no DnD Scribe.
```

### Marcadores Craig recomendados

```txt
/note CANON: texto
/note FALA: texto
/note BASTIDOR: texto
/note CORTAR: texto
/note DUVIDA: texto
/note CENA: texto
/note COMBATE: início/fim
/note ITEM: texto
/note NPC: texto
/note GANCHO: texto
```

## OBS

OBS é backup e contexto visual.

### O que gravar

- tela do Roll20;
- áudio do Discord;
- microfone próprio;
- opcionalmente música/ambiente em faixa separada;
- opcionalmente webcam, se a mesa usar.

### Configuração recomendada

- formato: `.mkv` para segurança;
- depois remux para `.mp4` se necessário;
- múltiplas faixas de áudio;
- uma faixa com mix geral;
- uma faixa com microfone local;
- uma faixa com Discord, se possível.

## Discord Bot futuro

Comandos úteis:

```txt
/sessao iniciar
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

## Canais recomendados no Discord

```txt
#dnd-sessao
#dnd-marcadores
#dnd-recaps
#dnd-bastidores
#dnd-canon-review
#dnd-bot-logs
```

## Mensagem fixa de consentimento

```md
As sessões podem ser gravadas para registro da campanha, transcrição, recap e memória da mesa.

Áudio bruto e transcrição completa são privados.
Trechos de bastidores só serão publicados após aprovação.
Conversas pessoais, técnicas ou sensíveis serão removidas/ocultadas.
Qualquer pessoa pode pedir remoção de trecho fora de personagem.
```

## Melhor prática

Craig é o “áudio cirúrgico”.
OBS é o “plano B grandão”.
Roll20 é a “prova mecânica”.
Discord é o “controle remoto da bagunça”.
