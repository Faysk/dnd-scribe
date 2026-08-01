# 68 — Central Local em produção

Data: 26/07/2026.

Status: publicada.

## Resultado

Interface:

```txt
https://dnd.faysk.dev/central-local/
```

Deployment:

```txt
id=dpl_FzrSEW3Z43dVUkKeeWGFTr1t9yXr
status=READY
target=production
function_api_size=11.02MB
```

## Arquitetura efetiva

```txt
dnd.faysk.dev
  -> entrega HTML, CSS e JavaScript pequenos
  -> navegador pede permissão para acessar o loopback
  -> http://127.0.0.1:8765
  -> FastAPI + SQLite + GPU + arquivos do PC
```

Áudio, ZIP, transcrição completa, SQLite e modelos não são enviados para a
Vercel. O computador precisa estar ligado e `run.ps1` precisa estar aberto.

O código-fonte do companheiro também está versionado em `local-companion/`;
`E:\Project\craig-to-text` continua sendo a instalação operacional.

## Proteções

- FastAPI permanece ligado somente em `127.0.0.1`;
- CORS permite somente `dnd.faysk.dev` e o alias oficial;
- o preflight de rede privada é aceito explicitamente;
- a página de produção recebe `Permissions-Policy` para loopback;
- quando o companheiro está desligado, a interface mostra instrução local;
- `.tools`, `lore` completo, áudio e estado local não entram no upload.

## Correção do bundle da função

O primeiro deploy falhou antes de substituir produção:

```txt
api/[...path]=327.42MB
limite=250MB
```

A causa era `includeFiles: lore/**`, que empacotava 342,66 MB de acervo para
uma API que referencia somente 17 arquivos.

Foi criado `lore-runtime`, com apenas os arquivos realmente usados:

```txt
arquivos=17
bytes=11450695
função_final=11.02MB
```

Não foi habilitada a opção de função grande.

## Validação

```txt
craig-to-text pytest=10 passed
preflight_http=200
access-control-allow-origin=https://dnd.faysk.dev
access-control-allow-private-network=true
cuda_available=true
sessions_local=1
npm_check=ok
egress_guards=ok
production_page_http=200
permissions_policy=local-network + loopback-network
vercel_status=READY
```

O navegador interno de validação não implementa a permissão de loopback e,
por isso, não consegue concluir o último salto. O teste final dessa permissão
deve ser feito no Chrome real, aceitando o diálogo de acesso à rede local.

## Operação

No PC principal:

```powershell
cd E:\Project\craig-to-text
.\run.ps1
```

Depois:

```txt
https://dnd.faysk.dev/central-local/
```

Se o acervo for movido futuramente:

```powershell
.\run.ps1 E:\DnD-Scribe
```
