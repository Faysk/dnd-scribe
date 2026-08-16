# DnD Scribe — API de Resumos v1

A API de Resumos do DnD Scribe é uma interface **somente leitura**, estável e versionada para integrações externas consumirem os resumos já publicados da campanha.

Ela foi desenhada para bots de Discord, automações, ferramentas de busca/RAG, serviços internos, integrações com LLMs, sites privados e scripts. A API não expõe áudio, ZIPs, transcrições completas, conteúdo em revisão nem sessões ainda não publicadas.

## Visão geral

- Base URL de produção: `https://dnd.faysk.dev`
- Versão atual: `v1`
- Autenticação: API Key no header `Authorization: Bearer ...`
- Escopo disponível na v1: `summaries:read`
- Rate limit: `300` requisições por minuto por API Key
- Formatos: JSON e Markdown
- Paginação: cursor opaco
- Sincronização incremental: `updatedAfter`
- Cache condicional: `ETag` / `If-None-Match`
- OpenAPI: `https://dnd.faysk.dev/docs/api/openapi.yaml`
- Documentação web: `https://dnd.faysk.dev/docs/api`

## 1. Segurança e modelo de acesso

Cada API Key pertence a um cliente de integração e fica vinculada a **uma única campanha**. A campanha não é escolhida por query string no endpoint externo: ela vem da própria chave. Isso evita que uma chave criada para uma campanha seja usada para consultar outra.

A v1 suporta apenas o escopo:

```text
summaries:read
```

Esse escopo permite exclusivamente ler resumos publicados.

A chave tem o formato:

```text
dnd_live_<segredo>
```

O DnD Scribe mostra o valor completo apenas no momento da criação ou rotação. No banco, o segredo não é armazenado em texto puro: apenas o hash SHA-256 e um prefixo de identificação ficam persistidos.

### Regras para consumidores

1. Guarde a chave em variável de ambiente ou secret manager.
2. Não coloque a chave em JavaScript enviado ao navegador.
3. Não publique a chave em repositórios, logs, screenshots ou mensagens.
4. Use a API preferencialmente de servidor para servidor.
5. Se houver suspeita de vazamento, revogue ou rotacione a chave no Edit imediatamente.

Exemplo de variável de ambiente:

```bash
DND_SCRIBE_API_KEY=dnd_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

## 2. Autenticação

Envie a chave no header HTTP `Authorization`:

```http
Authorization: Bearer dnd_live_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
```

Exemplo com cURL:

```bash
curl \
  -H "Authorization: Bearer $DND_SCRIBE_API_KEY" \
  https://dnd.faysk.dev/api/v1/summaries
```

Não existe autenticação por query string na v1. Portanto, isto não é suportado:

```text
/api/v1/summaries?apiKey=...
```

## 3. Health check

### `GET /api/v1/health`

Não exige API Key e pode ser usado para checar se o serviço está disponível.

```bash
curl https://dnd.faysk.dev/api/v1/health
```

Resposta:

```json
{
  "status": "ok",
  "apiVersion": "v1",
  "service": "DnD Scribe Summary API",
  "documentation": "https://dnd.faysk.dev/docs/api"
}
```

Esse endpoint não garante que uma chave específica seja válida; ele verifica somente a disponibilidade da API.

## 4. Listar resumos publicados

### `GET /api/v1/summaries`

Retorna uma lista paginada de sessões publicadas que possuem resumo completo.

O endpoint de listagem **não inclui o Markdown completo**. Isso mantém a resposta leve para descoberta, sincronização e polling. Para buscar o texto completo, use o endpoint de detalhe.

### Exemplo

```bash
curl \
  -H "Authorization: Bearer $DND_SCRIBE_API_KEY" \
  "https://dnd.faysk.dev/api/v1/summaries?limit=50"
```

Resposta:

```json
{
  "object": "list",
  "apiVersion": "v1",
  "data": [
    {
      "id": "Svz6mvN0cBUk",
      "title": "Sessão de 15 de agosto de 2026",
      "sessionDate": "2026-08-15",
      "arc": "Castelo em outro plano",
      "summary": "O grupo atravessou o portal e encontrou...",
      "updatedAt": "2026-08-16T19:30:00.000Z",
      "webUrl": "https://dnd.faysk.dev/#/sessao/Svz6mvN0cBUk/resumo"
    }
  ],
  "pagination": {
    "limit": 50,
    "hasMore": false,
    "nextCursor": null
  }
}
```

### Ordenação

A listagem é ordenada por:

1. `updatedAt` decrescente;
2. `id` decrescente como desempate estável.

Portanto, itens alterados recentemente aparecem primeiro.

## 5. Parâmetros de listagem

### `limit`

Quantidade máxima de itens por página.

- padrão: `50`
- mínimo: `1`
- máximo: `100`

```text
GET /api/v1/summaries?limit=100
```

Valores maiores que `100` são limitados a `100`.

### `cursor`

Cursor opaco retornado em `pagination.nextCursor`.

Não interprete nem monte esse valor manualmente. Apenas envie exatamente o cursor recebido da página anterior.

```text
GET /api/v1/summaries?limit=50&cursor=<nextCursor>
```

### `updatedAfter`

Retorna somente resumos cujo registro foi alterado após um instante ISO 8601.

```text
GET /api/v1/summaries?updatedAfter=2026-08-16T12:00:00Z
```

Esse é o parâmetro recomendado para sincronização incremental.

### `from`

Filtra pela data da sessão, inclusiva:

```text
GET /api/v1/summaries?from=2026-07-01
```

Formato obrigatório:

```text
YYYY-MM-DD
```

### `to`

Filtra até a data da sessão, inclusiva:

```text
GET /api/v1/summaries?to=2026-07-31
```

Pode ser combinado com `from`:

```text
GET /api/v1/summaries?from=2026-07-01&to=2026-07-31
```

### `arc`

Filtra pelo nome exato do arco, sem diferenciar maiúsculas de minúsculas:

```text
GET /api/v1/summaries?arc=Euclix
```

## 6. Paginação correta

Fluxo recomendado:

```text
GET /api/v1/summaries?limit=50
                 │
                 ▼
        pagination.nextCursor
                 │
                 ▼
GET /api/v1/summaries?limit=50&cursor=...
                 │
                 ▼
        pagination.hasMore=false
```

Pseudo-código:

```js
let cursor = null;
const summaries = [];

do {
  const url = new URL('https://dnd.faysk.dev/api/v1/summaries');
  url.searchParams.set('limit', '100');
  if (cursor) url.searchParams.set('cursor', cursor);

  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.DND_SCRIBE_API_KEY}`
    }
  });

  if (!response.ok) throw new Error(`DnD Scribe API: ${response.status}`);

  const payload = await response.json();
  summaries.push(...payload.data);
  cursor = payload.pagination.nextCursor;
} while (cursor);
```

## 7. Buscar um resumo completo

### `GET /api/v1/summaries/{id}`

O `{id}` é o `id` retornado pela listagem. Ele corresponde ao identificador estável da sessão no DnD Scribe.

```bash
curl \
  -H "Authorization: Bearer $DND_SCRIBE_API_KEY" \
  https://dnd.faysk.dev/api/v1/summaries/Svz6mvN0cBUk
```

Resposta JSON:

```json
{
  "object": "session_summary",
  "apiVersion": "v1",
  "data": {
    "id": "Svz6mvN0cBUk",
    "title": "Sessão de 15 de agosto de 2026",
    "sessionDate": "2026-08-15",
    "arc": "Castelo em outro plano",
    "summary": "Descrição curta usada no card.",
    "updatedAt": "2026-08-16T19:30:00.000Z",
    "webUrl": "https://dnd.faysk.dev/#/sessao/Svz6mvN0cBUk/resumo",
    "summaryMarkdown": "# Sessão de 15 de agosto de 2026\n\n## O portal\n\n...",
    "coverImageUrl": "https://...",
    "heroImageUrl": "https://..."
  }
}
```

## 8. Receber Markdown puro

O mesmo endpoint pode devolver o Markdown publicado diretamente.

Envie:

```http
Accept: text/markdown
```

Exemplo:

```bash
curl \
  -H "Authorization: Bearer $DND_SCRIBE_API_KEY" \
  -H "Accept: text/markdown" \
  https://dnd.faysk.dev/api/v1/summaries/Svz6mvN0cBUk
```

Resposta:

```md
# Sessão de 15 de agosto de 2026

## O portal

...
```

Isso é útil para:

- indexação em vector stores;
- importação para Obsidian/Notion;
- contexto de LLM;
- bots que já renderizam Markdown;
- geração de arquivos `.md`.

A listagem `/api/v1/summaries` continua sendo somente JSON mesmo se `Accept: text/markdown` for enviado.

## 9. Sincronização incremental

Para um consumidor que mantém cópia local, não é necessário baixar tudo novamente.

Guarde o instante da última sincronização bem-sucedida:

```text
2026-08-16T19:30:00.000Z
```

Na próxima execução:

```text
GET /api/v1/summaries?updatedAfter=2026-08-16T19:30:00.000Z
```

Depois percorra todas as páginas retornadas.

### Estratégia recomendada

1. Armazene `lastSuccessfulSync`.
2. Faça a listagem usando `updatedAfter=lastSuccessfulSync`.
3. Percorra todos os cursores.
4. Para cada item, busque o detalhe somente se necessário.
5. Somente depois de concluir todas as páginas, avance `lastSuccessfulSync`.

Não avance o checkpoint no meio de uma sincronização incompleta.

## 10. Cache condicional com ETag

A API devolve `ETag` nas listagens e detalhes.

Exemplo:

```http
ETag: "sum-fAbC123..."
```

Guarde o valor e envie-o na próxima consulta:

```http
If-None-Match: "sum-fAbC123..."
```

Se nada mudou, a API responde:

```http
HTTP/1.1 304 Not Modified
```

sem reenviar o corpo.

### cURL

Primeira requisição:

```bash
curl -i \
  -H "Authorization: Bearer $DND_SCRIBE_API_KEY" \
  https://dnd.faysk.dev/api/v1/summaries/Svz6mvN0cBUk
```

Requisição seguinte:

```bash
curl -i \
  -H "Authorization: Bearer $DND_SCRIBE_API_KEY" \
  -H 'If-None-Match: "sum-fAbC123..."' \
  https://dnd.faysk.dev/api/v1/summaries/Svz6mvN0cBUk
```

Para crawlers, bots e sincronizadores frequentes, combinar `updatedAfter` + `ETag` reduz bastante tráfego desnecessário.

## 11. Rate limit

Cada API Key possui uma janela de até:

```text
300 requests / minuto
```

A API devolve:

```http
X-RateLimit-Limit: 300
X-RateLimit-Remaining: 294
X-RateLimit-Reset: 1786914000
```

`X-RateLimit-Reset` é um Unix timestamp em segundos.

Se o limite for excedido:

```http
HTTP/1.1 429 Too Many Requests
Retry-After: 22
```

Exemplo de resposta:

```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "Limite de requisicoes por minuto excedido."
  }
}
```

Consumidores devem respeitar `Retry-After` e usar backoff.

## 12. Erros

Erros da API externa seguem o formato:

```json
{
  "error": {
    "code": "invalid_api_key",
    "message": "API key invalida, expirada ou revogada."
  }
}
```

### Status mais comuns

| HTTP | Código típico | Significado |
|---|---|---|
| `400` | `invalid_cursor`, `invalid_date`, `invalid_limit` | Parâmetro inválido |
| `401` | `invalid_api_key` | Chave ausente, inválida, expirada ou revogada |
| `403` | `insufficient_scope` | A chave não possui `summaries:read` |
| `404` | `summary_not_found` | Resumo publicado não existe na campanha da chave |
| `406` | `not_acceptable` | Formato solicitado não é aceito naquele endpoint |
| `429` | `rate_limit_exceeded` | Limite por minuto excedido |
| `500` | `internal_error` | Falha inesperada no serviço |

Não dependa do texto exato de `message` para lógica de aplicação. Use `HTTP status` e `error.code`.

## 13. O que a API expõe

A API só retorna sessões que atendem simultaneamente a estas condições:

- pertencem à campanha da API Key;
- estão com status `published`;
- possuem `summary_full` não vazio.

A API v1 não retorna:

- áudio;
- ZIP do Craig;
- arquivos locais;
- transcrição completa;
- falas individuais;
- conteúdo `draft`;
- sessões em processamento;
- material de revisão;
- dados de outras campanhas;
- credenciais de usuários.

## 14. Exemplo em Node.js

Node 18+ / Node 24:

```js
const baseUrl = 'https://dnd.faysk.dev';
const apiKey = process.env.DND_SCRIBE_API_KEY;

async function dndFetch(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {})
    }
  });

  if (response.status === 304) return { notModified: true };

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body?.error?.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.code = body?.error?.code;
    throw error;
  }

  return {
    data: await response.json(),
    etag: response.headers.get('etag')
  };
}

const list = await dndFetch('/api/v1/summaries?limit=20');
console.log(list.data.data);
```

## 15. Exemplo em Python

```python
import os
import requests

BASE_URL = "https://dnd.faysk.dev"
API_KEY = os.environ["DND_SCRIBE_API_KEY"]

response = requests.get(
    f"{BASE_URL}/api/v1/summaries",
    headers={"Authorization": f"Bearer {API_KEY}"},
    params={"limit": 50},
    timeout=30,
)
response.raise_for_status()

payload = response.json()
for summary in payload["data"]:
    print(summary["sessionDate"], summary["title"])
```

Buscar Markdown:

```python
response = requests.get(
    f"{BASE_URL}/api/v1/summaries/Svz6mvN0cBUk",
    headers={
        "Authorization": f"Bearer {API_KEY}",
        "Accept": "text/markdown",
    },
    timeout=30,
)
response.raise_for_status()
markdown = response.text
```

## 16. Exemplo para um bot Discord

Fluxo recomendado:

```text
cron / comando Discord
        │
        ▼
GET /api/v1/summaries?updatedAfter=<checkpoint>
        │
        ▼
novos/alterados?
   │          │
 não         sim
   │          │
 encerra      ▼
        GET /api/v1/summaries/{id}
                   │
                   ▼
          publica ou indexa o resumo
```

O bot não precisa ter conta Discord no DnD Scribe. Ele usa somente a API Key criada para a integração.

## 17. Uso com RAG / LLM

Para indexação vetorial, use a listagem para descobrir documentos e o detalhe em Markdown para o conteúdo.

Metadados recomendados ao armazenar cada documento:

```json
{
  "source": "dnd-scribe",
  "summaryId": "Svz6mvN0cBUk",
  "title": "Sessão de 15 de agosto de 2026",
  "sessionDate": "2026-08-15",
  "arc": "Castelo em outro plano",
  "updatedAt": "2026-08-16T19:30:00.000Z",
  "webUrl": "https://dnd.faysk.dev/#/sessao/Svz6mvN0cBUk/resumo"
}
```

Use `id` como chave externa estável e `updatedAt`/`ETag` para decidir quando reindexar.

## 18. Rotação e revogação de chaves

No DnD Scribe Edit, a área **Integrações → API de resumos** permite:

- criar uma nova API Key;
- definir nome e descrição da integração;
- definir expiração opcional;
- visualizar prefixo, escopo, último uso e quantidade de requests;
- rotacionar uma chave;
- revogar uma chave.

### Rotação segura

1. Clique em **Rotacionar**.
2. Copie a nova chave exibida.
3. Atualize o secret no consumidor.
4. Faça um health/list test com a nova chave.
5. A chave antiga já fica revogada pela rotação.

Se o consumidor ainda estiver usando a chave antiga, começará a receber `401 invalid_api_key`.

## 19. Compatibilidade e versionamento

A rota versionada faz parte do contrato:

```text
/api/v1/...
```

Dentro da `v1`, alterações compatíveis podem adicionar campos sem remover os existentes. Consumidores devem ignorar campos desconhecidos.

Mudanças incompatíveis de contrato devem entrar em uma nova versão, por exemplo:

```text
/api/v2/...
```

Boas práticas para consumidores:

- não validar o JSON com `additionalProperties: false`;
- não depender da ordem das propriedades JSON;
- não interpretar o conteúdo do cursor;
- não depender da mensagem textual dos erros;
- aceitar novos headers e novos campos opcionais.

## 20. OpenAPI

A especificação OpenAPI 3.1 está disponível em:

```text
https://dnd.faysk.dev/docs/api/openapi.yaml
```

Ela pode ser importada em ferramentas como Postman, Insomnia, Bruno, Swagger UI e geradores de SDK.

Arquivo no repositório:

```text
web/openapi-summary-v1.yaml
```

## 21. Checklist rápido para integrar

- [ ] Recebi uma API Key `dnd_live_...`
- [ ] Guardei a chave fora do código-fonte
- [ ] Testei `GET /api/v1/health`
- [ ] Testei `GET /api/v1/summaries`
- [ ] Implementei paginação por `nextCursor`
- [ ] Uso `id` como identificador externo estável
- [ ] Uso o endpoint de detalhe para buscar `summaryMarkdown`
- [ ] Respeito `429` e `Retry-After`
- [ ] Guardo `ETag` quando faço polling frequente
- [ ] Uso `updatedAfter` para sincronização incremental
- [ ] Tenho procedimento de rotação da API Key

## 22. Resumo do contrato

```text
GET /api/v1/health
    público

GET /api/v1/summaries
    Authorization: Bearer dnd_live_...
    scope: summaries:read
    JSON

GET /api/v1/summaries/{id}
    Authorization: Bearer dnd_live_...
    scope: summaries:read
    JSON por padrão
    text/markdown com Accept: text/markdown
```

A API é deliberadamente pequena: ela expõe somente o que foi publicado como resumo, com autenticação independente do login humano do site e sem ampliar acesso para transcrições ou arquivos da mesa.
