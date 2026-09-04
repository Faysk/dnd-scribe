# 34 — Fase 6: Home e arquivo de sessões

Status: **implementação de código concluída; homologação com dados reais depende do Preview configurado**

Data: 2026-09-04

## Objetivo

Modernizar a entrada da campanha sem introduzir entidades, lore ou outras features futuras. A Home passa a responder rapidamente onde a campanha parou e `/sessoes` assume o catálogo cronológico completo.

## Implementado

- contrato TypeScript/runtime para `GET /api/library-sessions`;
- fetch server-side autenticado via BFF/origem legada, sempre `no-store`;
- access token lido somente no servidor após `getClaims()` válido;
- Home editorial com:
  - contexto da campanha;
  - última sessão em destaque;
  - dimensão do arquivo;
  - quatro memórias recentes;
  - acesso ao arquivo completo;
- rota `/sessoes` com catálogo cronológico completo;
- cards com capa, arco, data, título, resumo curto, duração, falas e participantes;
- normalização de títulos técnicos antigos;
- fallback visual quando uma sessão não possui arte;
- validação de URLs de imagem aceitando apenas HTTPS;
- estados vazio, erro e Preview sem envs;
- navegação principal `Início` / `Sessões` ativa no shell;
- link de Sessões no menu móvel do usuário;
- testes unitários de contrato e formatação;
- smoke E2E de `/sessoes` sem secrets.

## Decisões de UX

A Home não virou dashboard. Estatísticas aparecem como uma faixa editorial e não como uma grade de cards de SaaS. A última sessão é o ponto focal; o catálogo completo vive em `/sessoes`.

Os cards já usam o destino semântico final `/sessoes/[id]`. A implementação completa dessa rota pertence à Fase 7 e será feita imediatamente na etapa seguinte, antes de qualquer cutover.

## Privacidade e cache

- a biblioteca permanece privada;
- Bearer token nunca é enviado ao browser pelo novo app;
- fetch server-side usa `cache: no-store`;
- imagens são aceitas somente quando a origem retornada é HTTPS;
- nenhuma service role é adicionada ao Web Next.

## Gate

Código/CI pode ser fechado nesta fase quando:

```txt
install ✅
typecheck ✅
lint ✅
unit ✅
build ✅
e2e smoke ✅
CI legado ✅
```

A aprovação visual dark/light e desktop/mobile com dados reais permanece vinculada ao Preview/Homologação externa. Produção `dnd.faysk.dev` continua intocada.
