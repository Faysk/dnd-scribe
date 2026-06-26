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

## Etapa 11 — Front real local

Status: concluida.

Objetivo: criar uma app funcional de operacao local, com backend local seguro, consumindo Supabase real sem depender de Vercel.

Escopo:

- criar `web/` como front real separado da demo;
- criar `tools/serve_frontend.py` como backend local;
- listar sessoes reais do Supabase;
- carregar Review Board real por API;
- aplicar decisoes pelo backend local;
- baixar template de revisao do DM;
- adicionar mini-player flutuante com playlist publica do Dandelion;
- visualizar publicacoes e resumo operacional.

Resultado validado:

```txt
local_url=http://127.0.0.1:8787
sessions=1
segments=41
ai_candidates=5
template_segments=1
template_candidates=5
browser_console_errors=0
approved_publications=0
review_only_publications=1
```

Observacao:

- Vercel nao e necessario nesta fase.
- O navegador nao recebe `service_role` nem `DATABASE_URL`.
- A app abriu direto na experiencia operacional, nao em landing page.

Referencia:

- `docs/34_resultado_etapa_11_front_real_local.md`
- `docs/36_resultado_etapa_11_palco_musicas.md`

## Etapa 12 — Auth e RLS

Status: em andamento.

Objetivo: proteger dados por usuario/campanha usando Supabase Auth e Row Level Security.

Resultado parcial validado:

```txt
login_google=ok
auth.users=1
perfil_vinculado=faysk
endpoint=/api/auth/me
api_mode=open_test
```

Escopo inicial sugerido:

- mapear os demais `profiles.id` com `auth.users.id` conforme jogadores testarem;
- definir policies de leitura para sessoes, publicacoes e revisao;
- decidir como fontes brutas/transcricoes completas ficam restritas;
- manter operacoes administrativas via service role/worker;
- validar com perfis DM/player/convidado.

Referencia de planejamento:

- `docs/35_roadmap_proximas_10_etapas.md`
- `docs/39_resultado_etapa_12_login_google_aberto.md`
- `docs/40_resultado_etapa_12_perfil_auth_vinculado.md`

## Etapa 13 — Front real: UX de revisao

Status: em andamento.

Objetivo: transformar o Review Board local em ferramenta confortavel para uso real do DM.

Resultado parcial validado:

```txt
rascunho_local_por_sessao=ok
restaurar_rascunho=ok
aplicar_sem_rascunho=bloqueado
marcador_visual_rascunho=ok
filtros_candidatos=ok
```

Escopo inicial sugerido:

- indicador de item salvo no banco;
- painel lateral de fontes;
- melhorias adicionais de ergonomia para revisoes longas.

Critério de pronto:

```txt
DM revisa itens reais pelo front sem editar JSON manualmente.
```

Referencia:

- `docs/41_resultado_etapa_13_rascunho_review.md`

## Etapa 14 — Player de audio por timestamp

Status: em andamento.

Objetivo: permitir conferir trecho transcrito ouvindo a fonte.

Resultado parcial validado:

```txt
endpoint_audio_url=ok
r2_signed_url=ok
range_check=206
player_segmento=implementado
```

Escopo inicial sugerido:

- escolher fonte alternativa quando existir mais de uma gravacao;
- fallback quando audio nao estiver disponivel;
- indicador mais detalhado de expiracao da URL assinada.

Critério de pronto:

```txt
DM consegue auditar uma fala por audio em ate 2 cliques.
```

Referencia:

- `docs/42_resultado_etapa_14_player_audio_timestamp.md`

## Etapa 15 — Criacao e gerenciamento de sessoes

Status: em andamento.

Objetivo: sair da sessao fixa e permitir iniciar novas sessoes pela interface.

Resultado parcial validado:

```txt
aba_sessoes=implementada
api_create_session=implementada
api_update_session=implementada
source_system_manual=implementado
build=ok
```

Escopo inicial sugerido:

- validar criacao real com a proxima sessao da mesa;
- associacao de participantes esperados;
- status operacional por etapa.

Critério de pronto:

```txt
DM cria uma sessao nova sem tocar no banco manualmente.
```

Referencia:

- `docs/43_resultado_etapa_15_gerenciamento_sessoes.md`

## Etapa 16 — Upload/Ingestao pelo front

Status: em andamento.

Objetivo: importar ZIP Craig ou arquivos de sessao pela interface local.

Resultado parcial validado:

```txt
upload_multipart_local=ok
ingest_script_local=ok
zip_teste_minimo=ok
vercel_resposta_controlada=implementada
```

Escopo inicial sugerido:

- teste com ZIP Craig real da proxima sessao;
- logs de erro amigaveis;
- converter execucao sincrona em job local.

Critério de pronto:

```txt
um novo arquivo Craig entra no pipeline sem comando manual.
```

Referencia:

- `docs/44_resultado_etapa_16_upload_ingestao_front.md`

## Etapa 17 — Worker/queue local

Status: em andamento.

Objetivo: tirar tarefas longas do request da interface.

Resultado parcial validado:

```txt
job_store_tmp_jobs=ok
job_ingest_craig_async=ok
api_jobs=ok
monitor_jobs_front=implementado
```

Escopo inicial sugerido:

- jobs para transcribe, import, sync R2, classify e publish;
- retry simples;
- tela de monitoramento.

Critério de pronto:

```txt
transcricao/classificacao rodam como jobs, nao como acao bloqueante do front.
```

Referencia:

- `docs/45_resultado_etapa_17_worker_queue_local.md`

## Etapa 18 — Roll20 Logger integrado

Status: em andamento.

Objetivo: trazer eventos de mesa para a timeline.

Resultado parcial validado:

```txt
script_dnd_roll20=atualizado
parser_roll20_events=implementado
migration_roll20=aplicada
payload_session_roll20Events=implementado
front_operacao_roll20=implementado
```

Escopo inicial sugerido:

- upload do export Roll20 pelo front;
- job `parse_roll20`;
- alinhamento aproximado por timestamp;
- visualizacao junto da timeline.

Critério de pronto:

```txt
marcadores Roll20 ajudam a revisar uma sessao real.
```

Referencia:

- `docs/46_resultado_etapa_18_roll20_logger_parser.md`

## Etapa 19 — Discord/Craig operacional

Status: em andamento.

Objetivo: reduzir atrito antes, durante e depois da sessao.

Resultado parcial validado:

```txt
api_craig_map_local=ok
editor_mapa_craig_ui=implementado
backup_antes_de_salvar=implementado
vercel_resposta_controlada=implementada
```

Escopo inicial sugerido:

- checklist pre-sessao;
- registro de link/arquivo Craig;
- instrucoes de download do ZIP;
- deteccao de novos convidados.

Critério de pronto:

```txt
captura de uma nova sessao tem menos passos manuais e menos risco de nick errado.
```

Referencia:

- `docs/47_resultado_etapa_19_discord_craig_operacional.md`

## Etapa 20 — Importacao de historico Markdown

Status: em andamento.

Objetivo: trazer o historico antigo da campanha sem misturar com a pipeline de audio.

Resultado parcial validado:

```txt
tabela_historical_documents=aplicada
importador_markdown=implementado
dry_run_markdown=ok
status_inicial=historical_import
```

Escopo inicial sugerido:

- vinculo com entidades/canon quando possivel;
- relatorio de conflitos/duvidas.

Critério de pronto:

```txt
historico antigo fica pesquisavel sem contaminar canon aprovado.
```

Referencia:

- `docs/48_resultado_etapa_20_importacao_historico_markdown.md`

## Etapa 21 — Entidades e canon consolidado

Status: em andamento.

Objetivo: transformar decisoes aprovadas em memoria navegavel da campanha.

Resultado parcial:

```txt
schema_canon_entries=criado
consolidator_canon_entries=implementado
validacao_local=ok
aplicacao_supabase=pendente_por_limite_comandos_externos
```

Escopo inicial sugerido:

- tela de entidades;
- relacao candidato -> entidade;
- timeline por personagem/local/item;
- notas privadas por audiencia.

Critério de pronto:

```txt
uma publicacao aprovada alimenta memoria estruturada da campanha.
```

Referencia:

- `docs/49_resultado_etapa_21_entidades_canon_consolidado.md`
