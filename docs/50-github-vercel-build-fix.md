# Etapa 50 - Correção do build GitHub na Vercel

## Problema observado

O deploy iniciado pela integração GitHub da Vercel falhou com:

```text
Synced /vercel/path0/web -> /vercel/path0/public
Error: The Output Directory "public" is empty.
```

Isso indica que o build chegou a executar `scripts/sync-public.js`, mas o diretório `public/`
terminou sem os arquivos estáticos esperados. A causa confirmada foi a `.vercelignore` remota
ignorar `index.html`, `app.js` e `styles.css` sem prefixo de pasta, removendo também os arquivos
correspondentes dentro de `web/`.

## Correção aplicada

- Ajustada a `.vercelignore` para remover segredos, estado local e arquivos pesados, mas preservar
  explicitamente `web/**`, `api/**`, `scripts/**`, `package.json`, `package-lock.json` e `vercel.json`.
- Reforçado `scripts/sync-public.js` com validações explícitas:
  - exige `web/index.html`;
  - limpa e recria `public/`;
  - copia o conteúdo de `web/` recursivamente;
  - exige `public/index.html`;
  - falha cedo se o output continuar vazio.
- Mantido `vercel.json` apontando `outputDirectory` para `public`.

## Resultado esperado

No próximo deploy via GitHub, o log deve mostrar algo como:

```text
Synced /vercel/path0/web -> /vercel/path0/public (N files)
```

Se o `web/` ainda não estiver presente no commit enviado ao GitHub, o erro passa a ser mais claro:

```text
sync-public: required frontend entry not found: /vercel/path0/web/index.html
```

## Próximas verificações

1. Confirmar que o novo deploy do GitHub saiu de `ERROR` para `READY`.
2. Abrir a URL de produção e validar que `index.html`, `app.js` e `styles.css` carregam.
3. Validar `/api/health` e o fluxo de login Google.
4. Se falhar, usar o novo erro explícito do `sync-public` para separar pacote, caminho de build ou configuração da Vercel.
