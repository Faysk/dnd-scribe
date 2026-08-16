# 72 — Companion Windows e permissões locais

## Resultado

O Edit distribui um instalador Windows privado para pessoas autenticadas com
permissão de processamento local. O executável não contém modelos nem áudios:
ele instala o aplicativo em `%LOCALAPPDATA%\DnDScribe`, prepara um ambiente
Python isolado e versionado, cria o atalho **DnD Scribe Companion** no Desktop
e mantém um controlador junto ao relógio do Windows. O controlador inicia com
o login.

O operador escolhe a raiz de dados durante a instalação. ZIPs do Craig,
faixas, modelos Whisper, transcrições, revisões, logs e SQLite permanecem nessa
raiz. O serviço escuta somente em `127.0.0.1:8765`.

A versão 0.4 é **GPU-first**. O caminho normal usa NVIDIA/CUDA e nunca cai para
CPU silenciosamente. CPU existe apenas como opção manual avançada. A referência
de compatibilidade do projeto é uma GPU da classe RTX 2080 com 8 GB; GPUs mais
novas podem aproveitar a mesma stack sem mudar o contrato de processamento.

## Perfis de transcrição

A interface expõe intenção, não detalhes de CUDA:

| Perfil | Modelo | Caminho padrão |
| --- | --- | --- |
| **Rápido** | `large-v3-turbo` | CUDA `float16` |
| **Detalhado** | `large-v3` | CUDA `float16` |

Se a carga do modelo falhar especificamente por falta de VRAM e a GPU suportar
a combinação, o companion tenta `int8_float16` **na própria GPU**. Se ainda não
for possível continuar, o job falha com diagnóstico claro. CPU `int8` só é
usada quando o operador marca explicitamente a opção avançada.

A amostra automática de cinco minutos sempre usa o perfil **Rápido**. A sessão
completa fica em **Detalhado** por padrão.

## Fluxo do operador

1. entrar em `https://dnd.faysk.dev/edit/`;
2. abrir **Processamento local**;
3. clicar em **Baixar para Windows**;
4. executar `DnDScribeCompanionSetup.exe` e escolher a pasta de dados;
5. aguardar a preparação do Python e das bibliotecas CUDA;
6. permitir ao Chrome o acesso à rede local;
7. selecionar o ZIP FLAC Multi-track pelo seletor do Windows;
8. validar a amostra de cinco minutos;
9. escolher **Rápido** ou **Detalhado** para o processamento desejado.

O menu do ícone informa se o serviço está parado, rodando ou processando. Em
processamento, mostra a porcentagem e a etapa atual, incluindo download do
modelo, ajuste de memória da GPU e reaproveitamento de uma faixa já concluída.
Também permite abrir o Edit, iniciar/parar o serviço, reparar as dependências
locais da versão, consultar versão e pastas em **Sobre**, ou encerrar tudo com
**Sair**.

## Runtime e compatibilidade

Cada release usa um runtime próprio:

```text
%LOCALAPPDATA%\DnDScribe\
├─ Companion\versions\0.4.0\
└─ Runtime\versions\0.4.0\.venv\
```

O Python global é usado somente para criar o ambiente isolado. Depois disso o
tray inicia o serviço diretamente pelo `python.exe` do runtime daquela versão.
O instalador cria o venv diretamente no diretório versionado, instala as
dependências, executa `pip check` e um smoke test de `ctranslate2`,
`faster_whisper` e FastAPI e só então grava a versão como ativa. Um runtime de
outra release não é reutilizado pela release nova.

O motor de inferência crítico é versionado no pacote (`faster-whisper` e
`ctranslate2`), assim como cuBLAS e cuDNN instalados via Python no Windows. O
driver NVIDIA continua sendo responsabilidade da máquina; o companion informa
GPU, driver, VRAM e compute types disponíveis no diagnóstico.

Os pesos do Whisper são baixados para uma pasta temporária, validados e só
depois promovidos para a pasta de modelos. Cada perfil usa uma revisão fixada
do repositório do modelo, evitando que duas instalações da mesma release
baixem pesos diferentes em datas distintas.

## Persistência e recuperação

O progresso de alta frequência fica no SQLite em vez de reescrever
`session.json` a cada poucos pontos percentuais. O JSON da sessão continua como
estado durável e é salvo em checkpoints importantes.

Escritas JSON críticas usam arquivo temporário na mesma pasta, `flush`,
`fsync` e substituição atômica. No Windows, bloqueios transitórios como
`WinError 5`/sharing violation recebem retry com backoff antes de o job ser
considerado perdido. O health check também exercita uma substituição atômica
real, mas o resultado é cacheado para não martelar o disco a cada polling do
tray.

Cada faixa concluída recebe um checkpoint com assinatura da configuração,
modelo/revisão e SHA-256 do áudio de origem. Se o serviço for fechado ou uma
faixa posterior falhar, um retry reaproveita somente checkpoints compatíveis e
continua nas faixas restantes. Checkpoints de outra configuração, outro áudio
ou outro perfil não são reutilizados.

Falhas são registradas primeiro no catálogo SQLite e depois refletidas no JSON
da sessão em melhor esforço. Assim, uma falha de filesystem ao salvar o próprio
erro não deixa o job preso como `running`.

Logs rotativos ficam em `logs/companion.log`. O processamento registra perfil,
modelo, device, compute type, tempo por faixa e RTF (real-time factor) para que
comparações de performance usem dados reais das máquinas do grupo.

## Matriz de permissões

| Capacidade | Papel técnico | Renan | Yuhara | Arthur |
| --- | --- | ---: | ---: | ---: |
| abrir o Edit | `edit_viewer`/`site_editor` | sim | sim | sim |
| editar conteúdo publicado | `site_editor` | sim | sim | sim |
| baixar companion, processar com GPU e publicar | `local_operator` | sim | sim | sim |
| ouvir áudio guardado neste PC | `audio_operator` | sim | sim | sim |
| administrar permissões do site | `site_permissions_owner` | sim | não | não |

`site_permissions_owner` não aparece como opção concedível e não pode ser
atribuído ou revogado pela API do Edit. Uma transferência futura exige mudança
administrativa explícita.

Quem pode processar localmente também pode publicar o resultado. Download,
processamento e publicação fazem parte do mesmo fluxo de `local_operator` e
aparecem como uma única permissão no Edit.

## Distribuição segura

- bucket privado `companion-releases`;
- objeto `windows/DnDScribeCompanionSetup.exe`;
- download somente após `campaign.companion.download`;
- URL assinada com cinco minutos de validade;
- limite do bucket de 10 MB;
- verificação SHA-256 de ida e volta em cada publicação do executável;
- áudio, ZIP e modelo nunca passam por Vercel ou Supabase.

O bootstrap atual ainda não possui assinatura Authenticode comercial. O
Windows pode mostrar o SmartScreen na primeira execução. Antes de distribuir
fora do grupo atual, adquirir um certificado de assinatura de código é a
melhoria recomendada.

## Build e publicação

```powershell
.\installer\build.ps1
$process = Start-Process `
  -FilePath '.\dist\companion-installer\DnDScribeCompanionSetup.exe' `
  -ArgumentList '/verify' -Wait -PassThru
if ($process.ExitCode -ne 0) { throw 'Instalador inválido.' }

npx vercel env run --environment=production -- npm run release:companion
```

O workflow `Companion installer` repete o build em `windows-latest` e guarda o
artefato por 14 dias. A cópia oficial servida pelo site continua sendo a do
bucket privado.
