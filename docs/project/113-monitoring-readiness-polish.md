# Etapa 113 - Prontidao operacional no monitoramento

## Objetivo

Transformar a central de monitoramento em uma tela mais util para teste real, separando sinais tecnicos brutos de uma visao clara de prontidao.

## Entregue

- API `/api/monitoring` agora inclui `readiness`.
- A prontidao resume:
  - login e acesso fechado;
  - banco Supabase;
  - R2/audio;
  - Discord da mesa;
  - timeline com dados;
  - workers/fila;
  - custo OpenAI;
  - verificacao profunda.
- Front da aba Monitor ganhou uma faixa "Prontidao operacional".
- Cada item tem status e detalhe curto, mantendo JSON tecnico em detalhes expansíveis.
- Recomendações agora tambem incluem checks em `attention`/`warning`, nao apenas falhas criticas.

## Como usar

1. Abrir a aba Monitor.
2. Clicar em "Verificacao profunda" antes de teste real.
3. Conferir se a faixa de prontidao nao tem bloqueios.
4. Abrir os detalhes tecnicos apenas quando algum item pedir atencao.

## Custo

Esta etapa nao chama OpenAI. Os checks profundos usam apenas APIs operacionais ja configuradas, como Discord e Vercel.
