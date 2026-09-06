# Registro de versões

> Status: fundação web verificada; demais camadas pendentes. Responsável: implementador. Revisão: 2026-09-06.

Consulta oficial em **2026-09-06 17:03:18 UTC**: `node tools/check_web_versions.mjs`. Todas as 19 versões abaixo coincidiram com o valor fixado. O lockfile preserva dependências transitivas compatíveis; não forçamos transitivas fora dos intervalos dos mantenedores.

| Tecnologia | Última estável/fixada | Fonte |
| --- | --- | --- |
| Node.js | 26.8.1 | [Oficial](https://nodejs.org/dist/index.json) |
| pnpm | 12.3.4 | [npm](https://registry.npmjs.org/pnpm/latest) |
| Next.js | 16.3.4 | [npm](https://registry.npmjs.org/next/latest) |
| React | 19.2.8 | [npm](https://registry.npmjs.org/react/latest) |
| React DOM | 19.2.8 | [npm](https://registry.npmjs.org/react-dom/latest) |
| TypeScript | 7.0.2 | [npm](https://registry.npmjs.org/typescript/latest) |
| Tailwind CSS | 4.3.3 | [npm](https://registry.npmjs.org/tailwindcss/latest) |
| Tailwind PostCSS | 4.3.3 | [npm](https://registry.npmjs.org/@tailwindcss%2fpostcss/latest) |
| Supabase JS | 2.115.0 | [npm](https://registry.npmjs.org/@supabase%2fsupabase-js/latest) |
| Supabase SSR | 0.12.6 | [npm](https://registry.npmjs.org/@supabase%2fssr/latest) |
| Biome | 2.5.12 | [npm](https://registry.npmjs.org/@biomejs%2fbiome/latest) |
| Vitest | 5.0.0 | [npm](https://registry.npmjs.org/vitest/latest) |
| Playwright Test | 1.63.0 | [npm](https://registry.npmjs.org/@playwright%2ftest/latest) |
| Tipos Node | 26.4.1 | [npm](https://registry.npmjs.org/@types%2fnode/latest) |
| Tipos React | 19.2.18 | [npm](https://registry.npmjs.org/@types%2freact/latest) |
| Tipos React DOM | 19.2.7 | [npm](https://registry.npmjs.org/@types%2freact-dom/latest) |
| Marked | 18.0.11 | [npm](https://registry.npmjs.org/marked/latest) |
| DOMPurify | 3.4.15 | [npm](https://registry.npmjs.org/dompurify/latest) |
| pg | 8.23.0 | [npm](https://registry.npmjs.org/pg/latest) |

DOMPurify 3.4.15 estava recém-publicado e recebeu exceção exata na quarentena de release do pnpm (`minimumReleaseAgeExclude`). Não desabilitamos as demais políticas de supply chain. npm é apenas o bootstrap embarcado na imagem oficial Node; o gerenciador adotado e fixado é pnpm.

## Compatibilidade e hosting

Tipos, lint, 51 unitários e build passaram no Windows e no contêiner Linux Node 26. O Next instalado documenta suporte ao TypeScript 7 pelo `tsc` local por padrão; não foi necessário ativar experimental nem ignorar erros. ESLint foi substituído por Biome, pois typescript-eslint 8.69.0 declara TypeScript `<6.1.0`. [Parser](https://registry.npmjs.org/@typescript-eslint%2fparser/latest).

A Vercel documenta suporte até Node 24. O proprietário escolheu exigir 26 no destino novo. O contêiner usa `node:26.8.1-trixie-slim`; digest multiarch observado: `sha256:c0753125a3789977aefe869cbebccf70e3cfd7ea84ca48547458f02e4f1d7146`. Deployment externo Node 26 pendente. [Versões Vercel](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions).

## Ainda não certificado

Python, FastAPI, motores/GPU, instalador do companion e Postgres gerenciado permanecem na implementação anterior até sua fase de migração e compatibilidade. A atualização web não certifica todo o legado. Reexecutar a consulta antes da próxima promoção: “mais recente” é uma condição verificada em uma data, não uma propriedade permanente do lockfile.

Política: [stack e atualizações](../03-stack-e-atualizacoes.md).
