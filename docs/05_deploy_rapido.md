# Deploy rápido

## App local real

Nesta fase, o app operacional roda localmente:

```bash
python3 tools/serve_frontend.py --port 8787
```

Abrir:

```txt
http://127.0.0.1:8787
```

Esse modo e o recomendado agora, porque o backend local usa `.env.local` e chama Supabase/R2 sem expor chaves no navegador.

Vercel/Netlify/Pages abaixo servem apenas para a demo estatica antiga ou para um futuro deploy depois de Auth/RLS.

## Vercel

```powershell
cd D:\Projects\dnd
vercel
```

Como é HTML/CSS/JS puro, também pode arrastar a pasta no painel da Vercel.

## Netlify

Arraste a pasta no painel do Netlify ou use:

```powershell
netlify deploy --prod --dir .
```

## GitHub Pages

Suba o conteúdo no repositório e ative Pages usando a branch `main`.

## Cloudflare Pages

Conecte o repositório no Cloudflare Pages.
Build command vazio.
Output directory: `/`.
