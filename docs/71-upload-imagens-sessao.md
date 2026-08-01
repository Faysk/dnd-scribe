# 71 — Upload de imagens das sessões

## Objetivo

Substituir a digitação manual de URLs no Edit por seleção direta de imagens do
computador, mantendo publicação pública, custo previsível e autorização por
permissão de conteúdo.

## Fluxo

1. O editor escolhe uma imagem JPG, PNG ou WebP.
2. O navegador reduz as dimensões e converte o arquivo para WebP.
3. A API confirma `campaign.content.edit` e gera uma autorização temporária
   para um caminho novo e imutável.
4. O navegador envia o WebP diretamente ao Supabase Storage, sem transportar o
   arquivo pela função da Vercel.
5. Ao salvar, as URLs públicas de capa e destaque continuam no metadata da
   sessão.

## Limites e segurança

- originais de até 25 MB no navegador;
- arquivo final WebP de até 3 MB;
- somente `image/webp` é aceito pelo bucket;
- downloads são públicos porque as imagens aparecem no arquivo público;
- não existe política aberta de upload no bucket;
- a chave secreta permanece somente no backend;
- cada alteração usa um caminho novo para evitar imagem antiga no cache da CDN.

## Custos

As imagens deixam de exigir commits no GitHub, mas passam a consumir Storage e
egress do Supabase. A conversão e o limite reduzido mantêm cada publicação
pequena. O site usa URLs públicas cacheáveis; não faz listagens nem consultas ao
banco para baixar a imagem.

## Verificação

`npm run check:session-images` cria uma autorização assinada, envia um WebP
mínimo, confirma a leitura pública e apaga o objeto de teste.
