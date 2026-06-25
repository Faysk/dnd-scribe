# 23 — Plano de Execução por Etapas

Este plano organiza o desenvolvimento do DnD Scribe em etapas focadas.

Regra de trabalho:

```txt
uma etapa por vez
validar com dado real
documentar resultado
só então avançar
```

## Etapa 0 — Fundacao e acessos

Status: concluida.

Objetivo: deixar o ambiente seguro e testado.

Entregas:

- `.env.local` organizado e ignorado pelo Git;
- OpenAI testado;
- Supabase REST/service key testado;
- Supabase Pooler testado com `psql`;
- Cloudflare R2 API e S3 testados;
- ZIP real do Craig inspecionado;
- mapeamento inicial de nicks/personagens criado.

Referencias:

- `docs/19_decisoes_alinhadas_mvp.md`
- `docs/20_pipeline_audio_craig_real.md`
- `docs/21_participantes_e_mapeamento_craig.md`
- `docs/22_env_e_servicos.md`

## Etapa 1 — Ingestao local Craig

Status: concluida.

Objetivo: transformar um ZIP do Craig em uma pasta de sessao processavel.

Entrada:

```txt
audio/*.flac.zip
config/craig_user_map.json
```

Saida esperada:

```txt
tmp/sessions/{session_id}/
  raw/
  chunks/
  manifest.json
  participants.json
```

Escopo:

- extrair ZIP;
- ler `info.txt`;
- mapear faixas para pessoa/personagem;
- marcar convidados/desconhecidos;
- medir duracao das faixas;
- gerar chunks WAV mono 16 kHz;
- gerar manifest auditavel.

Fora desta etapa:

- transcrever a sessao inteira;
- salvar no Supabase;
- subir arquivo no R2;
- classificar canon;
- mexer na UI real.

Critério de pronto:

```txt
um comando gera manifest + chunks para o ZIP real do Craig
```

Resultado validado:

```txt
session_dir=tmp/sessions/craig-AdabEqbzngmT-stage1-full
tracks=5
participants=5
chunks=50
chunk_seconds=600
```

## Etapa 2 — Transcricao real por faixa

Status: concluida.

Objetivo: transcrever chunks de audio com OpenAI e salvar JSON estruturado.

Saida esperada:

```txt
transcripts/
  {track_key}/
    chunk_000.json
    chunk_001.json
  transcript_track_merged.json
```

Escopo:

- transcrever chunks;
- guardar uso/custo retornado pela API;
- preservar source file, track, pessoa, personagem padrao, start/end;
- suportar retomada se um chunk falhar.

Resultado validado:

```txt
session_dir=tmp/sessions/craig-AdabEqbzngmT-stage1-full
chunks=50
succeeded=50
failed=0
raw_json_files=50
```

## Etapa 3 — Merge de timeline

Status: concluida.

Objetivo: juntar transcricoes por faixa em uma timeline unica.

Saida esperada:

```txt
transcript_master.json
```

Escopo:

- ordenar por timestamp;
- marcar falas por speaker;
- preservar fonte;
- permitir personagem inferido/corrigido por trecho;
- manter convidados como `guest_or_unknown`.

Resultado validado:

```txt
segments_total=50
segments_exported=41
segments_empty=9
duration=01:32:00
```

## Etapa 4 — Persistencia Supabase

Status: concluida.

Objetivo: criar schema MVP e salvar sessoes, participantes, arquivos e segmentos.

Escopo:

- aplicar schema inicial;
- complementar tabelas com IDs de origem para importacao idempotente;
- inserir manifest e segmentos;
- validar contagens no banco.

Resultado validado:

```txt
campaigns=1
profiles=5
campaign_members=4
sessions=1
participants=5
recording_files=15
audio_chunks=50
transcript_segments=41
processing_jobs=1
```

Observacao:

- RLS basica fica para a etapa de autenticacao/review, porque agora a prioridade foi persistir dado real com rastreabilidade.
- `thomaz_17590` entrou como participante convidado/desconhecido, mas nao como membro conhecido da campanha.

Referencia:

- `docs/27_resultado_etapa_4_persistencia_supabase.md`

## Etapa 5 — Storage

Status: concluida.

Objetivo: decidir e implementar armazenamento de arquivos.

Decisao aplicada:

- R2 como storage duravel ja no MVP;
- Supabase fica como banco de metadados e controle;
- bucket privado com acesso por URL assinada temporaria;
- chunks WAV nao sobem por padrao porque sao regeneraveis.

Resultado validado:

```txt
bucket=dnd-scribe-audio
objects=65
bytes=277150498
recording_files_atualizados=15
chunks_uploaded=0
signed_url_check=206
```

Referencia:

- `docs/28_resultado_etapa_5_storage.md`

## Etapa 6 — Review Board MVP

Status: concluida.

Objetivo: revisar segmentos com filtros e acoes simples.

Escopo:

- tela de segmentos;
- filtro por speaker/personagem;
- status canon/bastidor/privado;
- correcao manual de speaker/personagem/texto.

Resultado validado:

```txt
fonte_real=Supabase exportado para data/review_session.generated.js
segmentos=41
participantes=5
recording_files=15
decisoes_locais=localStorage
desktop_smoke=ok
mobile_sem_overflow=ok
console_errors=0
```

Observacao:

- O arquivo `data/review_session.generated.js` contem transcricao real e fica ignorado pelo Git.
- As decisoes do Review Board ainda sao locais no navegador; persistir decisoes no Supabase fica para a proxima iteracao de produto.

Referencia:

- `docs/29_resultado_etapa_6_review_board.md`

## Etapa 7 — IA de classificacao e candidatos

Status: concluida.

Objetivo: classificar segmentos e gerar candidatos revisaveis.

Escopo:

- classificar segmentos;
- extrair canon candidates;
- extrair falas marcantes;
- extrair bastidores;
- salvar prompt/model/output.

Resultado validado:

```txt
run_recomendado=classify_candidates_v2_gpt-4o
segment_classifications=41
canon_candidates=2
quote_candidates=2
outtake_candidates=1
review_board_ai_cards=5
review_board_ai_badges=41
console_errors=0
mobile_sem_overflow=ok
```

Observacao:

- A IA gera sugestoes revisaveis, nao canon aprovado.
- O run v1 funcionou tecnicamente, mas ficou amplo demais; v2 restringiu candidatos atomicos em pt-BR.

Referencia:

- `docs/30_resultado_etapa_7_ia_classificacao.md`

## Etapa 8 — Publicacao

Status: concluida.

Objetivo: gerar recap e material final apenas a partir de itens aprovados.

Escopo:

- recap curto;
- recap completo;
- canon changes;
- falas aprovadas;
- bastidores marcados como bastidor.

Resultado validado:

```txt
publications=1
review_only=1
approved_publications=0
public_campaign=0
public_web=0
ui_publication_cards=1
console_errors=0
mobile_sem_overflow=ok
```

Observacao:

- Como ainda nao existem itens aprovados por humano/DM, nenhuma publicacao final foi criada.
- Foi criado apenas um pacote interno de revisao IA (`master_notes`, `review_only`, `draft`).

Referencia:

- `docs/31_resultado_etapa_8_publicacao.md`

## Etapa 9 — Decisoes humanas persistidas

Status: concluida.

Objetivo: tirar as decisoes do `localStorage` e aplicar no Supabase de forma auditavel, idempotente e sem expor chave sensivel no frontend.

Escopo:

- exportar JSON de decisoes do Review Board;
- registrar decisoes em `review_decisions`;
- atualizar `transcript_segments.review_status`;
- atualizar status de `canon_candidates`, `quote_candidates` e `outtake_candidates`;
- manter publicacao final travada ate existirem itens aprovados;
- validar idempotencia repetindo o mesmo payload.

Resultado validado:

```txt
review_decisions_count=2
segment_0041.review_status=needs_review
canon_001.status=candidate
approved_publications=0
apply_review_decisions.job_attempts=2
ui_download_json=ok
console_errors=0
```

Observacao:

- O navegador nunca recebe `service_role`.
- Fala aprovada nao vira publica automaticamente.
- Bastidor so alimenta publicacao final quando estiver `approved_by_all`.

Referencia:

- `docs/32_resultado_etapa_9_decisoes_humanas.md`

## Etapa 10 — Ciclo revisao/publicacao operavel

Status: concluida.

Objetivo: deixar pronto o comando operacional que recebe decisoes reais do DM, aplica no banco, regenera publicacoes e atualiza o Review Board.

Escopo:

- gerar template de decisoes para o DM;
- validar template contra IDs reais;
- aplicar decisoes por JSON;
- regenerar publicacoes;
- exportar dados atuais do Review Board;
- imprimir resumo de statuses e publicacoes.

Resultado validado:

```txt
template_segment_decisions=1
template_candidate_decisions=5
template_missing_segments=0
template_missing_candidates=0
cycle_approved_publications=0
cycle_review_only_publications=1
cycle_review_decisions=2
```

Observacao:

- Esta etapa nao aprova canon narrativo automaticamente.
- O ciclo esta pronto para gerar publicacoes finais quando o DM aprovar itens reais.

Referencia:

- `docs/33_resultado_etapa_10_ciclo_revisao_publicacao.md`

## Etapa 11 — Auth e RLS

Status: proxima.

Objetivo: proteger dados por usuario/campanha usando Supabase Auth e Row Level Security.

Escopo inicial sugerido:

- mapear `profiles.id` com `auth.users.id`;
- criar funcoes auxiliares de membership/DM;
- definir policies de leitura para sessoes, publicacoes e revisao;
- decidir como fontes brutas/transcricoes completas ficam restritas;
- manter operacoes administrativas via service role/worker;
- validar com perfis DM/player/convidado.
