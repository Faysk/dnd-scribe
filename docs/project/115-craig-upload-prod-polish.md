# Etapa 115 - Polimento do upload Craig em producao

## Objetivo

Deixar o upload real do ZIP Craig mais confiavel e legivel para teste em producao, especialmente com arquivos grandes.

## Entregue

- Front agora mostra fases do upload:
  - criacao da URL assinada;
  - envio direto para R2;
  - confirmacao do upload;
  - criacao do job cloud.
- Upload direto para R2 usa `XMLHttpRequest` para exibir progresso real do PUT.
- Mensagem da tela deixa explicito que o ZIP grande nao passa pela Vercel Function.
- Jobs criados depois do upload agora aparecem como `ready_to_run` quando ja existe worker implementado.
- Polling da lista de jobs acompanha apenas `running`/`retrying`, evitando loop infinito em job manual `queued`.

## Como testar

1. Abrir `Sessoes`.
2. Escolher ou criar uma sessao.
3. Selecionar o ZIP Craig.
4. Clicar em "Enviar ZIP para producao".
5. Observar a barra de progresso ate 100%.
6. Abrir `Operacao`.
7. Executar o job `cloud_ingest_craig`.
8. Depois executar o job `cloud_extract_craig_tracks` em blocos pequenos.

## Custo

Sem OpenAI. O custo envolvido e apenas R2:

- operacao PUT do ZIP;
- armazenamento do ZIP;
- operacoes de leitura/gravacao dos workers cloud.
