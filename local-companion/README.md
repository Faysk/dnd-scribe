# Craig to Text

Aplicação local para importar um ZIP **FLAC Multi-track** do
[Craig](https://craig.chat/), transcrever cada participante separadamente e
reunir as falas em uma linha do tempo pesquisável.

## Formato recomendado

Use **FLAC Multi-track**. FLAC preserva o áudio original sem perdas e ocupa
consideravelmente menos espaço que WAV. As faixas separadas já identificam o
orador, então não é necessário usar diarização para tentar adivinhar quem
falou.

AAC, Ogg Vorbis e Opus são aceitáveis quando espaço ou download são a
prioridade, mas são formatos com perdas. Audacity Project e Adobe Audition
Session são úteis para edição manual, não para este fluxo.

## Instalação no Windows

```powershell
py -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\run.ps1 E:\DnD-Scribe
```

Abra <http://127.0.0.1:8765>. O modelo é baixado na primeira transcrição.

Com o companheiro aberto, a mesma Central Local também pode ser acessada pela
interface de produção:

<https://dnd.faysk.dev/central-local/>

No primeiro acesso pelo Chrome, permita que `dnd.faysk.dev` procure e se
conecte a dispositivos na rede local. A página fica na Vercel, mas as chamadas
de áudio, catálogo e processamento vão diretamente para
`http://127.0.0.1:8765`; os arquivos não passam pela Vercel.

O argumento de `run.ps1` configura uma raiz de dados fora do código:

```txt
E:\DnD-Scribe\
  inbox\
  sessions\
  models\
```

Também é possível definir a variável `CRAIG_TO_TEXT_ROOT`. Sem argumento ou
variável, o layout antigo `downs/` + `data/` continua funcionando.

O modo recomendado usa `large-v3-turbo`, `float16` e CUDA. Caso as bibliotecas
CUDA necessárias ao CTranslate2 não estejam instaladas, selecione CPU no app
apenas para testar; para sessões longas, configure CUDA antes de processar.

## Fluxo

1. Coloque o ZIP em `E:\DnD-Scribe\inbox\`.
2. Importe o arquivo pela tela inicial.
3. Opcionalmente preencha termos da campanha e nomes próprios.
4. Rode primeiro o teste de 5 minutos.
5. Quando o resultado estiver bom, processe a sessão completa.

Os resultados ficam em `E:\DnD-Scribe\sessions\<recording-id>\`. A aplicação
nunca modifica o ZIP original.

O ID interno da gravação do Craig impede importações duplicadas. Se o ZIP de
uma sessão já processada continuar na pasta de entrada, o card mostra
**Transcrição pronta** e abre diretamente o resultado existente, sem extrair
as faixas novamente.

## Central Local

A tela inicial também funciona como painel operacional do computador:

- mostra pasta configurada, espaço livre, GPU/CUDA, modelo e fila;
- mantém catálogo de sessões e jobs em `craig-to-text.sqlite3`;
- recupera jobs pendentes depois de reiniciar o aplicativo;
- permite editar título, data jogada, arco e notas;
- permite aprovar, marcar para revisão, corrigir ou descartar segmentos;
- salva decisões em `review/decisions.json`, sem alterar `session.json`;
- permite repetir jobs que falharam ou foram interrompidos.

SQLite guarda somente catálogo, metadados e estado da fila. ZIPs, FLACs,
transcrições e decisões continuam como arquivos dentro da raiz local.

## Diagnóstico e export

- `GET /api/health`: disco, pastas, CUDA, modelos, sessões e fila;
- `GET /api/jobs`: jobs persistidos, com filtros por sessão;
- `PATCH /api/sessions/<id>`: título e metadados locais;
- `PATCH /api/sessions/<id>/segments/<segment-id>/review`: decisão e correção
  local, aplicada como uma camada sobre a transcrição original;
- `POST /api/jobs/<job-id>/retry`: nova tentativa de um job interrompido;
- `GET /api/sessions/<id>/publication-bundle.json`: pacote pequeno sem áudio,
  palavras, transcrição completa ou caminhos locais;
- `manifest.json`: hashes SHA-256 do ZIP, faixas e transcrição.

## Testes

```powershell
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\python -m compileall -q app tools tests
node --check static\app.js
```
