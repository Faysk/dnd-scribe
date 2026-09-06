> **Referência histórica — direção substituída em 2026-09-06.** O [reboot TDA](reboot/README.md) define o plano vigente. Este documento preserva decisões/evidências do escopo anterior; versões, fases e declarações de conclusão abaixo não certificam o estado do reboot. Revalidar requisitos antes de reutilizá-los.

# 65 — Plano de migração local-first

Status: proposta executável.

Regra:

```txt
uma etapa pequena
  -> teste com a sessão de 25/07/2026
  -> medida de bytes, tempo e custo
  -> documentação do resultado
  -> próxima etapa
```

## Objetivo de produto

Ao final da migração, o operador consegue:

1. abrir uma central local;
2. importar uma gravação Craig;
3. transcrever na GPU local;
4. revisar e gerar resumo;
5. publicar um pacote pequeno;
6. abrir `dnd.faysk.dev` em qualquer aparelho e ver apenas o material aprovado.

## Fase 0 — Congelar o crescimento cloud-first

Prioridade: imediata.

Entregas:

- não adicionar novos uploads de áudio ou chunks à nuvem;
- não adicionar novo polling ou Realtime;
- manter as proteções de egress já implementadas;
- não apagar banco, R2 ou histórico;
- registrar uma linha de base de requisições e bytes;
- marcar os roadmaps cloud-first como em revisão.

Pronto quando:

```txt
nenhuma nova etapa aumenta storage ou egress antes da arquitetura local
```

## Fase 1 — Consolidar o `craig-to-text`

Prioridade: primeira implementação.

Status: concluída em 26/07/2026.

Resultado: `docs/66-resultado-fase-1-local-first.md`.

Entregas:

- configurar uma pasta raiz fora do código;
- remover caminhos fixos `downs` e `data`;
- adicionar health check e diagnóstico de CUDA;
- introduzir manifesto com hashes;
- criar export estruturado compatível com DnD Scribe;
- preservar o export Markdown atual;
- testar reabertura, interrupção e reprocessamento;
- documentar backup.

Usar como fixture real:

```txt
recording_id=AY2M6WBqKgq9
sessão=25/07/2026
```

Pronto quando:

```txt
ZIP -> faixas -> transcrição -> Markdown + pacote JSON
sem OpenAI de áudio
sem Supabase
sem R2
```

## Fase 2 — Central Local unificada

Prioridade: alta.

Status: em execução.

Fase 2A concluída em 26/07/2026:
`docs/67-resultado-fase-2a-central-local.md`.

Já entregue:

- painel local de máquina, CUDA, disco, pasta e fila;
- catálogo e jobs persistentes em SQLite;
- recuperação e retry de jobs interrompidos;
- título e metadados editáveis;
- revisão e correção em overlay sem alterar a transcrição bruta;
- interface validada em desktop e mobile.

Falta para concluir a Fase 2:

- busca textual;
- player FLAC local com Range;
- editor de resumo e publicação;
- botão seguro para abrir a pasta da sessão.

Entregas:

- incorporar ao app local as telas úteis do DnD Scribe;
- catálogo de sessões;
- fila local;
- progresso sem polling agressivo;
- busca e revisão da transcrição;
- player lendo FLAC local com Range;
- editor de resumo e publicação;
- SQLite para catálogo, jobs e cache;
- botão para abrir a pasta da sessão.

Pronto quando:

```txt
o fluxo pesado inteiro funciona em 127.0.0.1
e nenhuma chave sensível chega ao navegador
```

## Fase 3 — GPT apenas sobre texto

Prioridade: alta, depois da Central Local.

Entregas:

- segmentar transcrição por cenas ou janelas;
- usar saída estruturada;
- gerar títulos, atos, resumo, entidades e pontas abertas;
- exigir timestamps para afirmações importantes;
- cache por hash + prompt + modelo;
- estimativa e teto de custo antes de executar;
- comparação com o resumo manual de 25/07/2026;
- revisão humana antes de qualquer publicação.

Pronto quando:

```txt
um clique gera rascunho útil
reexecução idêntica usa cache
nada vira canon automaticamente
```

## Fase 4 — Publicação mínima na nuvem

Prioridade: alta.

Entregas:

- definir schema `publication_bundle_v1`;
- endpoint autenticado e idempotente;
- salvar somente projeção pequena;
- validar limite de bytes;
- RLS por campanha e papel;
- site ler publicação agregada, não tabelas pesadas;
- medir resposta comprimida;
- permitir revogar ou substituir uma publicação.

Pronto quando:

```txt
publicar a sessão de 25/07/2026 envia somente KiB
e o site exibe o resultado em outro aparelho
```

## Fase 5 — Redução do banco e do egress

Prioridade: antes de reabrir uso contínuo.

Entregas:

- inventário de tabelas por: local, cloud, histórico ou descontinuada;
- inventário de endpoints e bytes por resposta;
- consultas com seleção explícita e paginação;
- índice somente para padrões reais de consulta;
- endpoint agregado para o catálogo;
- cache HTTP com ETag para publicações imutáveis;
- carregamento incremental por `updated_at`;
- remover do site qualquer job polling local;
- fechar RLS com policies específicas;
- teste automatizado de orçamento de payload;
- painel mensal simples de requisições e egress.

Não fazer nesta fase:

- apagar tabelas ou objetos para “resolver” egress;
- ativar RLS em massa sem policies;
- otimizar índices sem plano de consulta;
- mover a transcrição completa para outra nuvem.

Pronto quando:

```txt
home <= 50 KiB gzip
sessão publicada <= 100 KiB gzip
0 áudio cloud
0 polling cloud de job local
```

## Fase 6 — Integração opcional com `dnd.faysk.dev`

Prioridade: conveniência, não fundação.

Entregas:

- indicador de companheiro local;
- conexão somente com consentimento;
- CORS restrito;
- token local;
- tratamento da permissão Local Network Access;
- fallback claro para abrir a Central Local;
- teste Chrome e pelo menos um navegador alternativo.

Pronto quando:

```txt
site conectado melhora a experiência
site desconectado continua plenamente utilizável
```

## Fase 7 — Outros computadores

Prioridade: futura.

Escolher somente quando houver necessidade real:

- instalar o companheiro em outro PC;
- compartilhar a Central Local por Tailscale Serve;
- criar uma entrega privada direta de arquivo;
- manter jogadores apenas no site publicado.

Pronto quando:

```txt
o caso de uso e o responsável pelo processamento estão definidos
```

## Ordem recomendada

```txt
0 congelar expansão cloud
1 consolidar craig-to-text
2 central local
3 GPT sobre texto
4 publicação mínima
5 banco e egress
6 ponte site-local opcional
7 colaboração entre computadores
```

## Próxima fatia técnica

A próxima etapa deve concluir a Fase 2B, limitada a:

1. busca local na transcrição;
2. player FLAC no timestamp;
3. botão para abrir a pasta local;
4. editor de resumo e preparação do bundle;
5. teste automatizado e visual usando `AY2M6WBqKgq9`.

Ela completa o fluxo pesado local antes de introduzir GPT sobre texto.

## Riscos que precisam de decisão humana

- por quanto tempo manter áudio bruto;
- qual parte da transcrição completa os jogadores podem consultar;
- se conteúdo privado do mestre deve existir na nuvem;
- quem pode publicar ou substituir um resumo;
- se outro operador realmente precisará processar no PC principal.

Essas decisões não bloqueiam as Fases 0 a 3.
