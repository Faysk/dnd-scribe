# 70 — Importação nativa do ZIP do Craig

## Objetivo

Eliminar a preparação manual da pasta de entrada. No Edit, o operador escolhe
o ZIP FLAC Multi-track pelo seletor nativo do Windows e acompanha o início do
processamento na mesma tela.

## Decisão

- o navegador de produção chama apenas o companheiro em
  `http://127.0.0.1:8765`;
- o companheiro abre o seletor de arquivos no computador do operador;
- o ZIP é validado antes da importação;
- o arquivo escolhido nunca é movido nem alterado;
- uma cópia temporária é criada na raiz local, conferida por SHA-256 e
  promovida atomicamente para `inbox`;
- o ID do Craig impede a criação de sessões duplicadas;
- com CUDA disponível, uma amostra de 5 minutos é enfileirada
  automaticamente;
- a importação manual pela pasta continua disponível como recuperação.

## Limites de segurança

O ZIP, as faixas e o modelo permanecem no computador. A Vercel não recebe o
arquivo nem participa do processamento. Só o fluxo explícito de publicação
envia texto revisável ao banco.

Se faltar espaço, o ZIP for inválido, a cópia não passar na verificação ou a
GPU não estiver disponível, o companheiro interrompe a etapa correspondente e
mostra o motivo sem apagar o original.

## Validação esperada

- seleção cancelada não cria arquivos nem sessões;
- fonte original continua byte a byte igual;
- cópia gerenciada tem o mesmo SHA-256;
- arquivo temporário não sobra após a operação;
- sessão é importada uma única vez;
- job de amostra usa `sample_minutes=5`;
- JavaScript das interfaces local e publicada passa na verificação sintática.
