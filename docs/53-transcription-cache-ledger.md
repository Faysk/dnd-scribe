# Etapa 53 - Cache de transcricao e ledger de custo

## Objetivo

Impedir custo duplicado da OpenAI e criar auditoria financeira por sessao/job/modelo antes da primeira transcricao real em volume.

## Aplicado no Supabase

A migration `20260626_008_canon_entries.sql`, que estava pendente, foi aplicada no projeto remoto.

A migration `20260626_009_ai_cost_cache.sql` tambem foi aplicada no projeto remoto e cria:

- colunas de hash e silencio em `recording_files`;
- colunas de hash e silencio em `audio_chunks`;
- tabela `transcription_cache`;
- tabela `ai_usage_ledger`;
- view `ai_usage_session_summary`.

## Como reduz custo

### Cache por hash

```text
audio_sha256 + provider + model + prompt_version -> transcript
```

Se o mesmo chunk aparecer de novo, o app deve reutilizar o transcript e registrar ledger com status `cached`, sem chamar OpenAI.

### Ledger de uso

Cada chamada, estimativa, cache hit ou skip deve registrar:

- sessao;
- job;
- modelo;
- tipo de operacao;
- hash de origem;
- tokens/minutos;
- custo estimado;
- custo real quando existir;
- request/batch id do provedor.

### Silencio

Chunks marcados como `probably_silent` devem gerar status `skipped`, tambem sem chamada OpenAI.

## Regra operacional

A transcricao so pode chamar OpenAI se:

1. existir estimativa previa;
2. o chunk nao for silencio provavel;
3. nao houver cache valido para o `sha256`;
4. o modelo escolhido obedecer `config/ai_cost_policy.json`;
5. custo acima do limite tiver aprovacao explicita do DM/operador.

## Proximo passo

Implementar o import do manifest Craig para preencher `recording_files` e `audio_chunks` com `sha256`, `audio_dbfs` e `probably_silent`.

Depois disso, a fila de transcricao consegue decidir sozinha:

```text
cache hit -> reuse
silent -> skip
missing cache + allowed budget -> call OpenAI
```
