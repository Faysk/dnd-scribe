# 01 — Objetivos e Escopo

## Objetivo principal

Criar um sistema capaz de transformar sessões longas de DnD em registros organizados, auditáveis e publicáveis.

O sistema deve ajudar a mesa a responder perguntas como:

- O que realmente aconteceu na última sessão?
- Quem falou isso?
- Em que momento?
- Foi em personagem ou fora de personagem?
- Isso é canon ou só interpretação?
- Isso foi uma piada ou um fato da história?
- Quais NPCs, lugares, itens e ganchos foram alterados?
- Que trechos podem virar bastidores ou cortes engraçados?

## Objetivos funcionais

### Captura

- Registrar áudio separado por participante usando Craig.
- Manter OBS como backup de tela e áudio.
- Salvar logs/eventos do Roll20.
- Salvar marcadores ao vivo via Craig, Discord ou Roll20.

### Processamento

- Converter e normalizar arquivos de áudio.
- Quebrar áudio longo em chunks seguros.
- Transcrever áudio com timestamps.
- Juntar faixas por participante em uma timeline única.
- Associar falantes a jogadores/personagens.

### Classificação

Classificar cada trecho como:

- narração do mestre;
- fala em personagem;
- ação declarada;
- mecânica/regra;
- rolagem;
- planejamento da mesa;
- discussão de lore;
- conversa aleatória;
- piada;
- pausa;
- problema técnico;
- candidato a canon;
- candidato a fala marcante;
- candidato a bastidor;
- privado/sensível.

### Auditoria

- Permitir ouvir trecho original.
- Ver timestamp.
- Ver fonte: Craig, OBS, Roll20, marcador humano.
- Aprovar, rejeitar ou corrigir candidatos.
- Corrigir speaker/personagem.
- Corrigir transcrição.
- Marcar status de canon.

### Publicação

Gerar automaticamente, após aprovação:

- recap curto;
- recap completo;
- mudanças de canon;
- timeline da sessão;
- falas marcantes;
- bastidores aprovados;
- entidades atualizadas;
- ganchos pendentes;
- versão pública;
- versão privada/mestre.

## Fora do escopo inicial

Não fazer no MVP:

- substituir Roll20;
- importar todo o histórico de 1 ano de uma vez;
- criar wiki perfeita logo no início;
- publicar automaticamente sem revisão;
- depender de integração real-time complexa com Roll20;
- fazer bot de Discord gigante;
- criar app mobile;
- criar edição de áudio/vídeo completa.

## Escopo do MVP

O MVP deve permitir o fluxo completo para **uma sessão nova**:

```txt
Criar sessão
→ subir arquivos
→ processar áudio
→ transcrever
→ classificar
→ revisar
→ aprovar
→ publicar
```

## Escopo futuro

Depois do MVP:

- dashboard de campanha;
- wiki viva;
- grafo de relações;
- timeline visual;
- busca semântica;
- bot Discord completo;
- Roll20 bridge em tempo real;
- transcrição local com WhisperX;
- geração de cortes de bastidores;
- player sincronizado com mapa/rolagens;
- export para Markdown/JSON/PDF;
- modo Mestre/Jogador;
- sistema de rumores e “previously on”.

## Métrica de sucesso

O projeto funciona quando, após uma sessão de 6 horas, vocês conseguem revisar só os trechos relevantes em vez de reler/ouvir tudo na unha.

Se o sistema reduzir 6 horas de caos para 30–60 minutos de revisão útil, já ganhou o Oscar do pato.
