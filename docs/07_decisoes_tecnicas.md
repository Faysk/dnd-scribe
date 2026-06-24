# Decisões Técnicas

## Frontend real

Recomendado: Next.js + Vercel.

A demo é HTML/CSS/JS puro apenas para validação visual.

## Banco

Supabase Postgres.

Motivos:

- Auth integrado;
- RLS;
- Storage;
- filas/queues;
- boa produtividade para MVP.

## Autenticação

Supabase Auth com Google Provider.

## Storage

MVP: Supabase Storage.

Futuro: Cloudflare R2 para áudio bruto pesado.

## Worker

Docker com:

- Node.js;
- Python;
- ffmpeg;
- SDK OpenAI;
- parsers de Craig/Roll20.

## IA

OpenAI para:

- transcrição;
- classificação;
- extração de canon;
- resumo;
- sugestão de entidades;
- geração de recap.

## Roll20

Arthur possui Roll20 Pro, então o projeto pode usar Roll20 API/Mod Script para registrar eventos estruturados no chat.

MVP seguro: gerar linhas estruturadas no chat e importar/exportar depois.
