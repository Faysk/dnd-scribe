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

### Para operadores autorizados

Entre em <https://dnd.faysk.dev/edit/>, abra **Processamento local** e clique
em **Baixar para Windows**. O instalador oficial prepara o ambiente, solicita a
pasta de dados e cria um atalho no Desktop.

O Windows pode mostrar o SmartScreen porque esta versão interna ainda não tem
assinatura Authenticode comercial. Confira se o arquivo se chama
`DnDScribeCompanionSetup.exe` e se foi baixado pelo Edit autenticado.

### Instalação de desenvolvimento

```powershell
py -m venv .venv
.\.venv\Scripts\python -m pip install --upgrade pip
.\.venv\Scripts\python -m pip install -e ".[dev]"
.\run.ps1 E:\DnD-Scribe
```

Abra <http://127.0.0.1:8765>. O modelo é baixado na primeira transcrição.

Com o companheiro aberto, a mesma Central Local também pode ser acessada pela
interface de produção:

<https://dnd.faysk.dev/edit/>

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

1. Clique em **Selecionar ZIP do Craig** no Edit ou na tela local.
2. Escolha o ZIP **FLAC Multi-track** na janela do Windows.
3. O companheiro valida o conteúdo, copia o ZIP com verificação SHA-256 e
   importa as faixas sem alterar o arquivo escolhido.
4. Se CUDA estiver disponível, o teste de 5 minutos entra automaticamente na
   fila.
5. Confira a amostra, ajuste os termos da campanha se necessário e então
   processe a sessão completa.

Como recuperação manual, ainda é possível colocar o ZIP em
`E:\DnD-Scribe\inbox\` e importá-lo pela lista **Arquivos disponíveis**.

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
- `POST /api/import/select`: abre o seletor nativo do Windows, preserva e
  verifica o ZIP, importa a sessão e agenda a amostra inicial;
- `GET /api/sessions/<id>/publication-bundle.json`: pacote pequeno sem áudio,
  palavras, transcrição completa ou caminhos locais;
- `manifest.json`: hashes SHA-256 do ZIP, faixas e transcrição.

## Testes

```powershell
.\.venv\Scripts\python -m pytest -q
.\.venv\Scripts\python -m compileall -q app tools tests
node --check static\app.js
```
