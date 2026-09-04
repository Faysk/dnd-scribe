# 02 — Arquitetura alvo

Status: **proposta para execução após baseline**

## Objetivo

Definir a arquitetura da nova aplicação pública sem alterar o domínio funcional do DnD Scribe durante a modernização.

## Limites do sistema

A modernização é da camada pública de leitura e navegação.

Continuam separados:

```txt
App público
→ consulta conteúdo publicado
→ autentica jogadores
→ renderiza sessões, resumos e transcrições

Central Local / companion
→ importa Craig
→ processa áudio
→ transcreve
→ revisa
→ publica resultados pequenos

Supabase / PostgreSQL
→ autenticação
→ perfis
→ campanhas
→ sessões
→ conteúdo publicado
→ permissões
```

## Stack alvo

A documentação não fixa patch versions. Em cada fase deve ser adotada a versão estável/LTS mais recente compatível e validada em CI.

### Runtime

- Node.js LTS.

### Aplicação web

- Next.js com App Router;
- React;
- TypeScript strict;
- Server Components por padrão;
- Client Components apenas onde houver interação real.

### UI

- Tailwind CSS para utilitários e composição;
- design tokens próprios;
- componentes acessíveis e estilizados pela identidade DnD Scribe;
- nenhuma biblioteca deve impor visual genérico ao produto.

### Dados

- Supabase/PostgreSQL mantidos;
- `@supabase/ssr` ou integração SSR oficial vigente;
- RLS mantida/revisada;
- tipos de banco gerados quando aplicável;
- Zod para validação em runtime.

### Qualidade

- Vitest para unitários;
- Playwright para E2E e regressão visual;
- lint/format;
- typecheck obrigatório;
- Preview Deploy por PR.

## Organização do repositório

Estrutura alvo inicial:

```txt
dnd-scribe/
│
├── apps/
│   └── web/
│       ├── app/
│       ├── components/
│       ├── features/
│       ├── lib/
│       ├── styles/
│       ├── types/
│       ├── public/
│       └── tests/
│
├── local-companion/
├── api/                  # legado preservado no início
├── lib/
├── scripts/
├── tools/
└── docs/
```

A criação de `packages/` só deve acontecer quando existir compartilhamento real suficiente para justificá-la.

## Organização do app web

```txt
apps/web/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── sessoes/
│   │   ├── page.tsx
│   │   └── [sessionId]/
│   │       ├── page.tsx
│   │       └── transcricao/
│   │           └── page.tsx
│   └── ...
│
├── components/
│   ├── ui/
│   ├── layout/
│   └── campaign/
│
├── features/
│   ├── auth/
│   ├── sessions/
│   └── transcript/
│
├── lib/
│   ├── supabase/
│   ├── validation/
│   └── utils/
│
└── styles/
```

## Rotas alvo durante a modernização

```txt
/
/sessoes
/sessoes/[id]
/sessoes/[id]/transcricao
```

### `/`

Home da campanha usando apenas dados já existentes.

### `/sessoes`

Arquivo cronológico completo.

### `/sessoes/[id]`

Resumo como conteúdo padrão.

### `/sessoes/[id]/transcricao`

Transcrição completa, busca, speaker filter e download.

Não criar rotas de pessoas, mundo ou lore neste roadmap.

## Rendering

### Server Components por padrão

Usar para:

- shell de página;
- Home;
- arquivo de sessões;
- resumo;
- metadados de sessão;
- conteúdo editorial.

### Client Components

Usar somente para:

- theme switch;
- menu interativo;
- filtros;
- busca da transcrição;
- carregamento incremental;
- ações do usuário;
- componentes que dependam de APIs exclusivas do browser.

## Auth

Objetivo:

- sessão disponível no servidor;
- redirects coerentes;
- sem flicker de estado autenticado;
- cookies seguros;
- mesmas regras de campaign role/capabilities existentes;
- nenhuma chave privilegiada no browser.

## Contratos de dados

Na primeira migração, o novo app deve preferir reutilizar APIs existentes quando isso reduzir risco.

Não reescrever API e frontend ao mesmo tempo sem necessidade.

A migração de endpoints para handlers/server actions do Next só deve ocorrer quando:

1. existir teste de paridade;
2. o contrato estiver documentado;
3. a mudança reduzir complexidade ou melhorar segurança;
4. houver rollback simples.

## Markdown

Resumos atuais continuam no formato existente.

A modernização pode trocar o mecanismo de renderização, mas não deve exigir conversão manual do acervo.

Requisitos:

- sanitização segura;
- renderização server-side quando possível;
- suporte ao Markdown atual;
- regressão visual testada.

## Imagens

Mesmo sem novas galerias neste roadmap, a nova base deve tratar capas e hero images com a solução nativa do framework quando apropriado.

Requisitos:

- dimensões conhecidas;
- responsive sizes;
- lazy loading fora da dobra;
- hosts remotos explicitamente permitidos;
- ausência de layout shift evitável.

## Design system

A estética atual deve virar um sistema semântico.

Os tokens atuais serão mapeados para conceitos como:

```txt
canvas
surface
surface-elevated
border
foreground
foreground-muted
accent
accent-strong
danger
success
```

Dark e light usam os mesmos nomes semânticos com valores diferentes.

## Dependências futuras explicitamente adiadas

Não instalar na modernização sem uso real:

- Tiptap;
- React Flow / XYFlow;
- bibliotecas de grafo;
- uploader avançado de galeria;
- editor colaborativo.

## Estratégia de compatibilidade

A nova aplicação deve poder coexistir com o legado durante a migração.

Fluxo recomendado:

```txt
main / produção
→ frontend atual

branch/preview
→ nova aplicação

paridade 100%
→ cutover

estabilização
→ remoção controlada do legado
```

## Critério de encerramento desta fase

A arquitetura alvo está aprovada quando:

- stack e política de versões estão definidas;
- limites local/cloud continuam explícitos;
- rotas alvo estão definidas;
- organização do app está definida;
- auth e estratégia de dados estão definidas;
- rendering strategy está definida;
- ADRs necessários estão identificados;
- não há nenhuma feature futura misturada ao escopo.
