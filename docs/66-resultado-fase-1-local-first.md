# 66 — Resultado da Fase 1 local-first

Data: 26/07/2026.

Status: concluída.

## Objetivo

Consolidar `E:\Project\craig-to-text` como fundação nativa do companheiro local,
sem Docker, Supabase, R2 ou nova transcrição paga.

## Decisões aplicadas

- Windows + Python + CUDA continuam como execução recomendada;
- `CRAIG_TO_TEXT_ROOT` permite separar código e arquivo permanente;
- ausência da variável preserva o layout antigo;
- cada importação gera hashes SHA-256;
- o pacote publicável exclui áudio, palavras, transcrição completa e caminhos;
- `publication_id` é derivado do conteúdo para permitir publicação idempotente;
- o ZIP original continua somente leitura.

## Layout configurável

```txt
E:\DnD-Scribe\
  inbox\
  sessions\
  models\
```

Execução:

```powershell
.\run.ps1 E:\DnD-Scribe
```

## Entregas

No `craig-to-text`:

- `app/config.py`: raiz configurável e compatibilidade legada;
- `app/artifacts.py`: SHA-256, JSON atômico e manifesto;
- `app/health.py`: diagnóstico de disco, CUDA, modelos e sessões;
- `app/publication.py`: contrato `publication_bundle_v1`;
- `app/main.py`: `/api/health` e endpoint de download do pacote;
- `tools/validate_phase1.py`: validação e relatório de proporção;
- interface com download de transcrição e pacote publicável separados;
- README e `run.ps1` atualizados;
- testes de configuração, manifesto, privacidade, idempotência e health.

## Validação automatizada

```txt
pytest=6 passed
compileall=ok
health_http=200
health_status=ok
cuda_available=true
publication_http=200
publication_schema=publication_bundle_v1
```

## Validação com a sessão real

Sessão:

```txt
recording_id=AY2M6WBqKgq9
data=2026-07-25
speakers=4
transcript_segments=3275
duration_seconds=19830.14
```

Medidas:

```txt
pasta_local_bytes=602706345
publication_bundle_file_bytes=894
publication_bundle_compact_bytes=709
proporcao_arquivo_publicavel=0.000148%
```

Artefatos gerados:

```txt
data/sessions/AY2M6WBqKgq9/manifest.json
data/sessions/AY2M6WBqKgq9/publications/publication_bundle_v1.json
```

O manifesto contém hashes do ZIP, das quatro faixas, dos JSONs por participante
e da timeline consolidada. O bundle contém apenas identidade da sessão,
speakers, duração, contagens e hashes.

## O que não foi feito

- nenhum arquivo foi enviado à nuvem;
- nenhum dado do Supabase foi consultado ou alterado;
- nenhum objeto R2 foi criado ou removido;
- nenhum deploy foi realizado;
- o acervo real não foi movido para `E:\DnD-Scribe`;
- a sessão não foi retranscrita;
- título, resumo e canon continuam vazios no bundle até a Fase 3.

## Riscos restantes

- o acervo local ainda precisa de uma política de backup;
- a Central Local ainda usa JSON, não SQLite;
- o progresso do frontend local ainda consulta a sessão a cada 2,5 segundos,
  mas isso ocorre em loopback e não gera egress;
- falta uma tela visível para health, disco e caminho configurado;
- falta definir autenticação para o futuro endpoint de publicação cloud.

## Próximo passo

Fase 2: transformar o `craig-to-text` na Central Local unificada, começando por:

1. mostrar health, CUDA, disco e pasta na interface;
2. criar catálogo/queue local persistente;
3. adicionar título e metadados editáveis;
4. preparar revisão local sem carregar a nuvem;
5. manter o pacote publicável como a única fronteira de sincronização.
