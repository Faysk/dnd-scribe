# ADR 008 — API legada permanece como fronteira de dados durante a migração

Status: **Accepted**  
Data: **2026-09-04**

## Contexto

O app público atual não monta a biblioteca consultando diretamente as tabelas Supabase no browser. Ele usa endpoints server-side como:

```txt
/api/auth/me
/api/library-sessions
/api/library-summary
/api/library-transcript
/api/session-download
```

O Supabase real possui RLS habilitado em todas as tabelas `public` auditadas, mas várias não possuem policies de Data API. O Security Advisor também sinaliza funções `SECURITY DEFINER` executáveis por `authenticated` que precisam ser revisadas antes de qualquer ampliação de RPCs/client access.

Migrar simultaneamente:

- frontend;
- auth;
- API;
- RLS;
- RPCs;

criaria blast radius desnecessário e dificultaria paridade/rollback.

## Decisão

Durante a modernização inicial do app público, a API existente do DnD Scribe permanece a **fronteira canônica de dados do player**.

Fluxo alvo de coexistência:

```txt
UI Next
  ↓
camada server do novo app
  ↓
contratos da API existente
  ↓
Supabase/PostgreSQL
```

O novo frontend não introduzirá `SELECT` direto de tabelas públicas pelo browser para substituir os contratos atuais de sessão/transcrição.

Server Components podem acessar a API/serviço autorizado, mas não devem transformar o schema do banco em contrato direto da UI.

## Consequências positivas

- reduz risco da migração;
- preserva autorização já testada;
- mantém DTOs menores que o schema operacional;
- permite rollback do frontend sem rollback de banco;
- evita redesenhar RLS no mesmo ciclo;
- facilita testes de contrato legado x novo.

## Consequências negativas

- parte da API legada continua existindo durante a modernização;
- pode haver bridge temporária entre sessão SSR/cookie e Bearer token legado;
- alguns benefícios de integração direta Next/Supabase ficam adiados;
- existe trabalho futuro para decidir se endpoints devem virar serviços/Route Handlers.

## Alternativas consideradas

### Acesso direto do browser ao Supabase

Rejeitado nesta fase porque exigiria policies/RPC review e aumentaria o escopo.

### Reescrever toda a API em Next antes de migrar a UI

Rejeitado porque combina duas mudanças independentes e piora rollback/paridade.

### Manter chamadas client-side diretas para `/api/*` exatamente como hoje

Pode existir temporariamente em trechos específicos, mas a direção preferida é server-first para leitura editorial. Não é necessário copiar a arquitetura client-side apenas por paridade interna.

## Critério para superseder este ADR

Este ADR só deve ser substituído quando existir uma proposta específica com:

- revisão de RLS/RPCs;
- testes de autorização;
- contratos TypeScript/DTOs;
- plano de migração;
- rollback;
- evidência de benefício real.

A modernização do frontend, sozinha, não é motivo suficiente.
