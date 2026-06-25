# 13 — Roadmap MVP

## Fase 0 — Preparação

Objetivo: deixar o projeto pronto para começar.

Tarefas:

- criar repo GitHub;
- criar projeto Next.js;
- conectar Supabase;
- configurar domínio `dnd.faysk.dev`;
- criar `.env`;
- configurar buckets;
- configurar tabelas iniciais;
- configurar login;
- criar layout base.

Resultado:

```txt
Site acessível com login e dashboard vazio.
```

## Fase 1 — Sessões e upload

Objetivo: criar sessão e subir arquivos.

Tarefas:

- tela criar sessão;
- tabela sessions;
- tabela participants;
- upload para Supabase Storage;
- tabela recording_files;
- associação de arquivo a participante;
- status da sessão.

Resultado:

```txt
Uma sessão pode receber arquivos Craig, OBS e Roll20.
```

## Fase 2 — Worker básico

Objetivo: processar arquivos fora da Vercel.

Tarefas:

- Docker Compose;
- worker Node;
- conexão Supabase;
- fila simples;
- baixar arquivo;
- rodar ffmpeg;
- salvar resultado;
- logs de job.

Resultado:

```txt
Worker processa um arquivo e salva output.
```

## Fase 3 — Transcrição

Objetivo: transcrever faixas Craig.

Tarefas:

- split de áudio;
- chamada OpenAI;
- remontagem;
- tabela transcript_segments;
- transcript viewer.

Resultado:

```txt
É possível ler a transcrição por timestamp e speaker.
```

## Fase 4 — Roll20 parser

Objetivo: importar eventos do Roll20.

Tarefas:

- script Roll20 Logger MVP;
- export chat;
- parser de eventos `[DND_EVENT]`;
- tabela roll20_events;
- exibição na timeline.

Resultado:

```txt
Cenas, canon markers, rolls e combates aparecem na timeline.
```

## Fase 5 — Classificação IA

Objetivo: separar jogo, mecânica, bastidor e canon candidate.

Tarefas:

- prompt de classificação;
- batch por segmentos;
- tabela segment_classifications;
- filtros na UI.

Resultado:

```txt
A transcrição fica filtrável por tipo.
```

## Fase 6 — Candidatos

Objetivo: gerar candidatos revisáveis.

Tarefas:

- canon_candidates;
- quote_candidates;
- outtake_candidates;
- extração por sessão;
- confidence;
- needs_review.

Resultado:

```txt
Sistema lista o que provavelmente importa.
```

## Fase 7 — Review Board

Objetivo: humano aprova/rejeita.

Tarefas:

- tela de revisão;
- botões de status;
- edição de claim;
- player por timestamp;
- review_decisions;
- audit_log.

Resultado:

```txt
A mesa consegue canonizar com fonte.
```

Status atual:

```txt
Review Board exporta JSON de decisoes.
Script local aplica decisoes no Supabase.
Template de revisao do DM e ciclo publicacao/review ja existem.
```

## Fase 8 — Publicação

Objetivo: gerar outputs finais.

Tarefas:

- recap curto;
- recap completo;
- canon changes;
- quotes;
- bastidores aprovados;
- página pública/privada.

Resultado:

```txt
Uma sessão vira publicação limpa e auditável.
```

Status atual:

```txt
Pacote review_only gerado.
Publicacoes finais continuam travadas ate aprovacao humana/DM.
```

## Fase 9 — Polimento

- busca;
- tags;
- entidades;
- dashboard;
- permissões melhores;
- export Markdown/JSON;
- backups.

Próxima frente técnica recomendada:

```txt
Supabase Auth + RLS por campanha/perfil.
```

## Ordem recomendada

```txt
Banco → Upload → Worker → Transcrição → Review → Publicação
```

Não inverter. Se começar pela tela linda, o projeto vira taberna bonita sem cerveja.
