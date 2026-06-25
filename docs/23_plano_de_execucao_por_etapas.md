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

Status: proxima etapa.

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

## Etapa 3 — Merge de timeline

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

## Etapa 4 — Persistencia Supabase

Objetivo: criar schema MVP e salvar sessoes, participantes, arquivos e segmentos.

Escopo:

- aplicar schema inicial;
- criar tabelas de sessao/participantes/transcript;
- inserir manifest e segmentos;
- validar RLS basica.

## Etapa 5 — Storage

Objetivo: decidir e implementar armazenamento de arquivos.

Ordem recomendada:

1. Supabase Storage para MVP;
2. R2 para bruto pesado/arquivo frio.

## Etapa 6 — Review Board MVP

Objetivo: revisar segmentos com filtros e acoes simples.

Escopo:

- tela de segmentos;
- filtro por speaker/personagem;
- status canon/bastidor/privado;
- correcao manual de speaker/personagem/texto.

## Etapa 7 — IA de classificacao e candidatos

Objetivo: classificar segmentos e gerar candidatos revisaveis.

Escopo:

- classificar segmentos;
- extrair canon candidates;
- extrair falas marcantes;
- extrair bastidores;
- salvar prompt/model/output.

## Etapa 8 — Publicacao

Objetivo: gerar recap e material final apenas a partir de itens aprovados.

Escopo:

- recap curto;
- recap completo;
- canon changes;
- falas aprovadas;
- bastidores marcados como bastidor.
