# ADR 015 — Memória pública, material bruto privado

Status: **Accepted**  
Data: **2026-09-05**

## Contexto

O legado nasceu com o arquivo inteiro atrás de autenticação. Na modernização, porém, a experiência editorial passou a tratar o resumo como a memória principal da campanha e a transcrição como material de consulta secundário.

Manter o resumo atrás do login criaria uma contradição de produto: um link para uma sessão compartilhado com alguém de fora da mesa abriria uma barreira de autenticação antes da própria história. Ao mesmo tempo, tornar os endpoints privados atuais simplesmente anônimos poderia vazar campos que nunca foram desenhados como contrato público, como contagens derivadas, participantes ou futuros metadados internos.

O norte do produto permanece:

> Você não procura uma sessão. Você procura uma memória.

## Decisão

A memória editorial publicada da campanha passa a ser pública. Material bruto, ferramentas e superfícies operacionais permanecem privados.

### Público, sem login

- `/`;
- `/sessoes`;
- `/sessoes/:id`;
- título, data, arco, resumo curto, resumo completo e artes da sessão;
- navegação, tema e links compartilháveis.

Uma sessão entra no contrato público somente quando `sessions.status = 'published'`.

### Privado para membro aprovado

- `/sessoes/:id/transcricao`;
- busca e filtro por speaker;
- paginação/cursor da transcrição;
- download `.md`;
- material bruto derivado da gravação.

### Privado operacional

Edit, Central Local, revisão, pipeline, notas privadas, candidatos de canon/outtakes e administração continuam seguindo suas permissões existentes.

### Usuário autenticado sem membership

Não perde acesso ao arquivo público. O shell informa discretamente que o acesso interno está pendente. Ao tentar abrir uma transcrição, recebe um estado de acesso pendente em vez de o site inteiro ficar bloqueado.

## Fronteira de dados pública

Não será removido `requireCampaignAccess` dos endpoints privados existentes.

O legado expõe uma superfície separada e mínima em:

```text
GET /api/public-library?campaignSlug=yuhara-main
GET /api/public-library?campaignSlug=yuhara-main&sourceSessionId=:id
```

O catálogo retorna somente campos editoriais explicitamente permitidos. O detalhe acrescenta `summaryFull`.

Campos como transcrição, participantes, contagens de falas, duração, IDs internos de banco e metadata bruta não fazem parte do contrato público.

O Next consome essa superfície server-side por `DND_LEGACY_ORIGIN`. O browser não recebe credenciais privilegiadas e não passa a consultar PostgreSQL diretamente.

## Cache

Por ser intencionalmente público e limitado a sessões `published`, o endpoint pode usar cache compartilhado curto:

```text
public, s-maxage=60, stale-while-revalidate=300
```

Endpoints privados continuam com cache privado/no-store conforme seus contratos.

## Autorização

A regra conceitual passa a ser orientada por capacidade:

```text
visitante
  canReadSummary = true

membro aprovado
  canReadSummary = true
  canReadTranscript = true
  canDownloadTranscript = true

editor/master
  capacidades adicionais conforme backend existente
```

A implementação não deve transformar `role === player` em condição espalhada por componentes. A API continua sendo a autoridade final das permissões privadas.

## Compatibilidade com sessões existentes

Na data desta decisão existem 11 sessões `published`, todas com resumo curto e completo. Essas memórias passam a compor o arquivo público.

O campo `consent_confirmed` existente não é reutilizado como chave de publicação: seu significado atual não foi definido para este caso e os registros existentes não sustentam essa semântica. A regra inicial e conservadora é `status = 'published'`.

Uma política futura de visibilidade individual (`public | members | private`) pode ser introduzida em etapa própria, com migração e default explícitos. Ela não é requisito deste cutover.

## Consequências positivas

- links de sessão passam a funcionar como conteúdo compartilhável;
- login deixa de ser barreira antes da história;
- a Home comunica a campanha antes de pedir credenciais;
- o contrato público é allowlist, reduzindo risco de vazamento por evolução de endpoints internos;
- transcrições e downloads mantêm exatamente o boundary de membership;
- usuário pendente ainda consegue acompanhar as memórias públicas.

## Custos e riscos

- o endpoint público precisa ser tratado como superfície de segurança permanente;
- qualquer novo campo público exige decisão explícita;
- resumos já publicados devem ser considerados conteúdo efetivamente público;
- SEO/social previews aumentam a capacidade de descoberta do conteúdo publicado, o que é intencional e deve ser considerado ao escrever novos resumos.

## Alternativas rejeitadas

### Tornar `/api/library-sessions` e `/api/library-summary` anônimos

Rejeitado porque esses contratos nasceram privados e podem crescer com campos internos.

### Manter tudo atrás do login

Rejeitado porque contradiz a prioridade editorial da modernização e reduz o valor dos links compartilháveis.

### Consultar Supabase diretamente do browser

Rejeitado. RLS e grants atuais não foram desenhados para essa exposição, e a modernização preserva o boundary server-side.

## Relação com o feature freeze

Esta decisão é uma alteração deliberada de política de acesso do player antes do lançamento, não a abertura de um novo domínio funcional. Ela entra antes do cutover para evitar publicar uma arquitetura de acesso que já sabemos não representar a experiência desejada.
