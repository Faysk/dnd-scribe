# 23 — Fase 9: plano de execução de Qualidade, Segurança e Acessibilidade

Status: **pré-planejado; execução depende da Fase 8 concluída**

## Objetivo

Executar uma revisão transversal do novo app depois que todas as capacidades públicas atuais já estiverem presentes.

A Fase 9 não é o momento em que qualidade começa. TypeScript, validação, auth e acessibilidade entram desde as fases anteriores. Aqui eles deixam de ser verificações locais de cada feature e passam por uma auditoria completa do produto moderno.

Escopo funcional esperado na entrada desta fase:

```txt
Auth/Shell ✅
Home ✅
/sessoes ✅
Resumo default ✅
Transcrição ✅
Busca/filtro/paginação/download ✅
Dark/Light ✅
Desktop/Mobile ✅
```

---

## 1. Princípio

> Não considerar a migração pronta apenas porque todas as telas abrem.

A aplicação moderna precisa demonstrar:

- contratos tipados e validados;
- autorização consistente;
- segredo fora do client;
- Markdown seguro;
- rotas e BFF protegidos;
- acessibilidade funcional;
- falhas controladas;
- dependências auditáveis;
- observabilidade mínima;
- CI que realmente bloqueia regressões.

---

## 2. Auditoria TypeScript

Executar `tsc` em strict mode e revisar exceções.

### Gate

```txt
strict = true
noEmit = true
0 erros
```

Revisar explicitamente:

- `any` explícitos;
- `as unknown as`;
- `@ts-ignore`;
- `@ts-expect-error`;
- non-null assertions `!`;
- casts de payload externo;
- tipos duplicados de contratos.

Exceções localizadas podem existir apenas com justificativa concreta e, quando relevante, issue de remoção.

Não aceitar `ignoreBuildErrors` no Next.

---

## 3. Fronteiras de validação runtime

Inventariar todas as entradas não confiáveis:

```txt
route params
search params
cookies
OAuth callback params
env vars
payloads da API legada
BFF query/body
headers relevantes
Markdown publicado
URLs de imagens
```

Cada fronteira deve possuir:

- schema/validação; ou
- justificativa explícita de por que o framework já garante o formato.

### Zod

Usar Zod onde agrega segurança e clareza, especialmente para:

- env;
- contratos legados;
- BFF input;
- route/search params complexos.

Não criar schemas gigantes duplicando tipos sem necessidade.

---

## 4. Auditoria de autenticação

Validar o fluxo completo:

```txt
anonymous
→ OAuth
→ callback
→ cookies
→ authorized/pending
→ refresh
→ logout
```

Cenários obrigatórios:

- cookie ausente;
- cookie expirado;
- refresh token expirado;
- callback inválido;
- state/code inválidos quando aplicável;
- usuário removido da campanha durante sessão ativa;
- role/capability alterada enquanto usuário está logado;
- API legada retorna 401;
- API legada retorna 403.

A UI deve convergir para estado correto sem ficar presa em sessão fantasma.

---

## 5. Autorização da campanha

Revisar toda rota protegida e toda ação BFF.

Pergunta obrigatória para cada endpoint:

> Se alguém descobrir esta URL e chamar manualmente, o servidor ainda impede acesso indevido?

Não aceitar como autorização:

- botão escondido;
- estado React;
- `campaignRole` enviado pelo browser;
- rota não exibida na navegação.

A fonte de verdade continua server-side/legado/Supabase conforme contratos aprovados.

---

## 6. Supabase e RLS

A modernização não deve alterar RLS sem necessidade, mas a Fase 9 precisa revisar o estado real.

Revisar:

- tabelas relevantes ao app público;
- policies existentes;
- tabelas com RLS habilitado e ausência de policy deliberada;
- funções `SECURITY DEFINER` relevantes;
- grants;
- exposição via Data API;
- uso de publishable/anon key;
- inexistência de service role no client.

### Regra

Não “corrigir” warnings automaticamente.

Para cada alerta:

```txt
risco real?
comportamento intencional?
consumidor atual?
mudança compatível?
```

Se uma correção exigir mudança de banco fora do escopo seguro da modernização, registrar dívida/issue e avaliar blocker conforme severidade.

---

## 7. Segredos e bundle do client

Auditar build output e código-fonte por:

```txt
SUPABASE_SECRET_KEY
service_role
DND_LEGACY_ORIGIN se for tratado como interno
API tokens
Discord secrets
worker secrets
companion credentials
private paths
Bearer tokens
```

O que é público por natureza deve ser documentado como público; o que é secreto não pode aparecer em chunk client, source map público, HTML ou log.

Executar busca automatizada no output de build por padrões de secrets conhecidos/falsos de teste.

---

## 8. BFF e origem legada

Conforme ADR 010 e ADR 012:

```txt
Browser
→ /api/web/* ou Server Component
→ BFF
→ DND_LEGACY_ORIGIN
```

Auditar:

- nunca usar `dnd.faysk.dev` como upstream interno;
- não permitir arbitrary upstream URL enviada pelo client;
- construir URLs com allowlist fixa de paths;
- validar method/query/body;
- definir timeout;
- cancelar requests quando aplicável;
- não retransmitir `Set-Cookie` legado indiscriminadamente;
- não retransmitir headers hop-by-hop;
- sanitizar erros;
- não logar Authorization.

---

## 9. SSRF e URL construction

O BFF não pode virar proxy genérico.

Proibido:

```txt
/api/web/proxy?url=https://qualquer-coisa
```

Preferir adapters específicos:

```txt
getCampaignAccess()
listSessions()
getSessionSummary(id)
getTranscriptPage(params)
downloadTranscript(id)
```

Se houver helper HTTP genérico interno, o destino base vem apenas de env server-only validado.

---

## 10. Markdown e XSS

Auditar o pipeline real escolhido na Fase 7.

Testes maliciosos mínimos:

```txt
<script>alert(1)</script>
<img src=x onerror=alert(1)>
javascript: URLs
HTML inline inesperado
links com atributos perigosos
SVG/HTML quando suportados
```

Objetivo:

- conteúdo válido do corpus continua funcionando;
- payload malicioso não executa;
- nenhum `dangerouslySetInnerHTML` não auditado.

---

## 11. Texto da transcrição

Falas devem ser renderizadas como texto.

Testar conteúdo com:

```txt
< > & " '
markdown-like text
URLs
emoji
quebras de linha
```

Não interpretar texto da transcrição como HTML.

---

## 12. Headers de segurança

Revisar com base no app real:

- `Content-Security-Policy`;
- `Referrer-Policy`;
- `X-Content-Type-Options: nosniff`;
- frame protections via CSP `frame-ancestors` quando apropriado;
- `Permissions-Policy`;
- HSTS no domínio HTTPS quando adequado;
- headers de cache em conteúdo autenticado.

### CSP

Não copiar uma CSP de exemplo cegamente.

Inventariar origens reais necessárias:

- Supabase;
- imagens;
- Vercel/Next assets;
- OAuth;
- outras integrações realmente presentes.

Preferir política restritiva compatível em vez de `*`.

---

## 13. CORS

O novo web app deve preferir same-origin BFF.

Consequência desejada:

- reduzir necessidade de CORS no browser;
- não abrir API legada para origens amplas por conveniência.

Qualquer CORS ainda necessário precisa ter consumidor identificado.

---

## 14. Open redirect

Auditar:

- OAuth callback `next/redirectTo`;
- bridge de hash legado;
- links de retorno;
- qualquer parâmetro de redirect.

Somente destinos internos/allowlisted.

Testes:

```txt
//evil.example
https://evil.example
%2F%2Fevil.example
javascript:...
```

---

## 15. Cookies

Revisar atributos reais:

- Secure;
- SameSite compatível com OAuth;
- HttpOnly quando aplicável;
- Path;
- Domain;
- lifetime/refresh.

Não compartilhar cookies com `legacy.dnd.faysk.dev` sem necessidade.

---

## 16. Dependências

Executar inventário de dependências do novo app.

Para cada dependência direta:

- por que existe?;
- é usada?;
- tamanho/impacto?;
- versão estável?;
- vulnerabilidades conhecidas?;
- poderia ser removida?

Rodar auditoria do package manager e ferramentas disponíveis.

Não bloquear automaticamente por advisory sem contexto, mas não ignorar criticidade alta/crítica.

---

## 17. Supply chain

Requisitos mínimos:

- lockfile versionado;
- instalação CI frozen/immutable;
- scripts de terceiros revisados quando sensíveis;
- dependabot/renovate planejado/configurado;
- secrets não disponíveis para PRs não confiáveis quando aplicável.

---

## 18. Acessibilidade — estrutura

Auditar:

```txt
html lang=pt-BR
landmarks
header/nav/main
skip link
heading hierarchy
links vs buttons
page title
```

Cada página deve possuir um `h1` lógico sem depender apenas do tamanho visual.

---

## 19. Acessibilidade — teclado

Executar manualmente sem mouse:

```txt
login
user menu
theme toggle
Home
/sessoes
abrir sessão
Resumo | Transcrição
busca
speaker filter
clear filters
load more fallback
download
logout
```

Validar:

- ordem de tab lógica;
- foco visível;
- menu não aprisiona foco incorretamente;
- foco não some após navegação;
- sem elemento clicável inacessível por teclado.

---

## 20. Acessibilidade — screen reader/ARIA

Revisar:

- nomes acessíveis de icon buttons;
- estado ativo das tabs/navegação;
- inputs com label;
- select de speaker;
- loading;
- erros;
- contagem de resultados;
- menu do usuário;
- imagens informativas/decorativas.

Regra:

> ARIA não deve consertar HTML semântico mal escolhido quando existe elemento nativo adequado.

---

## 21. Acessibilidade — contraste e cor

Medir dark e light.

Especial atenção:

- dourado sobre canvas claro;
- bronze em texto pequeno;
- muted text;
- borders;
- focus ring;
- estado ativo das tabs;
- links no Markdown.

Nenhuma informação crítica depende apenas de cor.

---

## 22. Zoom e reflow

Validar pelo menos:

- 200% zoom desktop;
- viewport mobile oficial;
- texto maior do sistema quando possível.

Não pode ocorrer:

- conteúdo principal cortado;
- controles inacessíveis;
- horizontal scroll para texto comum;
- toolbar da transcrição inutilizável.

Tabelas/code blocks podem ter overflow localizado quando necessário.

---

## 23. Reduced motion

Com `prefers-reduced-motion: reduce`:

- transições decorativas removidas/reduzidas;
- nenhuma função depende de animação;
- scroll/menus continuam previsíveis.

---

## 24. Auditoria automatizada de a11y

Adicionar ferramenta automatizada compatível ao Playwright quando útil, por exemplo axe-core.

Usar automação como rede de segurança, não como substituto de teste manual.

Executar nas páginas críticas em dark/light quando possível.

---

## 25. Erros e resiliência

Forçar cenários:

```txt
API offline
timeout
500
429
payload malformado
imagem quebrada
sessão inexistente
transcript next page falha
OAuth falha
```

Confirmar:

- sem tela branca;
- sem detalhes internos sensíveis;
- retry onde faz sentido;
- estado já carregado preservado quando apropriado.

---

## 26. Observabilidade

Definir campos mínimos de log server-side:

```txt
timestamp
environment
route
request correlation id quando útil
upstream category
status/error code
duration
```

Evitar:

- conteúdo completo da transcrição;
- Markdown privado;
- tokens;
- cookies;
- PII desnecessária.

Separar erros de:

```txt
novo app
auth
BFF
legacy upstream
```

---

## 27. CI

O gate completo do novo app deve executar:

```txt
install frozen
typecheck
lint
unit
build
E2E crítico
a11y automatizada crítica
```

Regressão visual pode rodar em job separado, mas deve estar verde antes de release candidate.

CI legado continua verde.

---

## 28. Matriz de achados

Todo achado da Fase 9 recebe:

```txt
ID
categoria
severidade
rota/componente
evidência
correção
status
```

Severidade sugerida:

```txt
critical
high
medium
low
info
```

Gate:

- `critical = 0`;
- `high = 0`;
- medium relevantes possuem decisão explícita.

---

## 29. O que NÃO fazer

- adicionar feature para “resolver” achado de UX;
- reestruturar banco sem necessidade de segurança real;
- trocar framework;
- adicionar observability SaaS sem necessidade comprovada;
- criar novas entidades;
- começar roadmap futuro.

---

## 30. Gate de saída

A Fase 9 termina quando:

```txt
TypeScript strict limpo ✅
fronteiras runtime validadas ✅
auth auditada ✅
autorização auditada ✅
Supabase/RLS revisado ✅
segredos/client bundle auditados ✅
BFF/SSRF auditado ✅
Markdown/XSS auditado ✅
headers/cookies/cache revisados ✅
dependências auditadas ✅
keyboard completo ✅
a11y automatizada crítica ✅
contraste dark/light ✅
zoom/reflow ✅
reduced motion ✅
error states ✅
observabilidade mínima ✅
critical/high findings = 0 ✅
CI completo verde ✅
```

Registrar ao final:

- relatório de achados;
- mudanças realizadas;
- issues adiadas;
- evidências de a11y;
- auditoria de dependências;
- revisão Supabase/RLS;
- headers finais.

---

## 31. Próxima fase

Após o gate:

```txt
Fase 10 — Performance
```

A partir daqui a aplicação funcional e segura é comparada quantitativamente com o baseline legado.