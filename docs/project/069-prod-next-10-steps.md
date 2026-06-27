# Etapa 069 - Proximas 10 etapas para producao completa

Data: 2026-06-27

## Principio

Cada etapa deve entregar valor em producao sem abrir custo grande automaticamente.

Regra de custo:

```txt
Se uma etapa puder gerar custo recorrente ou custo por sessao, estimar antes de executar.
Se a estimativa parecer alta, comparar alternativa mais barata antes de implementar.
```

## Etapa 1 - Confirmar upload R2 no site

Objetivo: validar o fluxo `craig-url -> PUT R2 -> craig-complete` com um ZIP pequeno ou real.

Entregas:

- upload direto funcionando no dominio de producao;
- CORS R2 ajustado se necessario;
- `recording_files` e `processing_jobs` atualizados.

Custo esperado: R2 storage/operacoes, muito baixo.

## Etapa 2 - Worker cloud manifest-only

Objetivo: processar `cloud_ingest_craig` sem transcricao paga.

Entregas:

- executor cloud busca ZIP no R2;
- extrai `info.txt` e nomes das tracks;
- cria ou atualiza participantes;
- registra arquivos brutos no Supabase.

Custo esperado: compute do worker. Se exigir plano pago, estimar antes.

## Etapa 3 - Artefatos processados em R2

Objetivo: parar de depender de `tmp/sessions` local para chunks/slices.

Entregas:

- chunks/slices gravados em R2;
- `audio_chunks.storage_bucket/path` deixa de ser `local`;
- `audio_speech_slices.storage_bucket/path` aponta para R2.

Custo esperado: R2 storage maior, ainda baixo no volume da mesa.

## Etapa 4 - Queue real e retry

Objetivo: transformar jobs em fila robusta.

Entregas:

- claim atomico de jobs;
- retry com limite;
- erros claros em `processing_jobs.error`;
- painel mostra progresso real.

Custo esperado: depende da fila escolhida. Preferir opcao barata antes de Workers pagos se o volume for pequeno.

## Etapa 5 - Estimativa cloud antes de IA

Objetivo: gerar plano de transcricao em producao sem chamar OpenAI.

Entregas:

- endpoint para estimar minutos pendentes;
- dashboard mostra custo por sessao;
- botao de aprovar execucao exige teto de custo.

Custo esperado: US$ 0 de IA.

## Etapa 6 - Transcricao cloud limitada

Objetivo: rodar somente uma amostra pequena em producao.

Entregas:

- executor processa `N` work units;
- usa cache por hash;
- escreve `transcription_cache`, `transcript_segments` e `ai_usage_ledger`;
- bloqueia se passar do teto aprovado.

Custo esperado: centavos por amostra.

## Etapa 7 - Transcricao completa por sessao

Objetivo: liberar sessao inteira com controle de custo.

Entregas:

- aprovacao por sessao;
- limite maximo de custo;
- pausa/resume;
- relatorio final de custo.

Custo esperado atual: cerca de US$ 0.16 por sessao otimizada com `gpt-4o-mini-transcribe`.

## Etapa 8 - Classificacao e candidatos em producao

Objetivo: rodar a segunda camada de IA depois da transcricao.

Entregas:

- classificacao barata;
- candidatos de canon/falas/bastidores;
- ledger de custo por run;
- botao para regenerar com novo prompt.

Custo esperado: baixo, mas depende do modelo escolhido.

## Etapa 9 - Mapa Craig editavel em producao

Objetivo: tirar o mapa do arquivo estatico.

Entregas:

- tabela ou JSON versionado no Supabase;
- historico de alteracoes;
- validacao de roles/status;
- UI de edicao habilitada para DM.

Custo esperado: nenhum custo novo relevante.

## Etapa 10 - Fechar seguranca antes de jogadores

Objetivo: sair do modo aberto de teste.

Entregas:

- RLS habilitada com policies reais;
- DM com acesso completo;
- jogadores com acesso limitado;
- service role apenas no backend/worker;
- teste de DM, player e convidado.

Custo esperado: nenhum custo novo relevante, mas exige cuidado para nao bloquear o app.

