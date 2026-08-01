# 72 — Companion Windows e permissões locais

## Resultado

O Edit distribui um instalador Windows privado para pessoas autenticadas com
permissão de processamento local. O executável não contém modelos nem áudios:
ele instala o aplicativo em `%LOCALAPPDATA%\DnDScribe`, prepara um ambiente
Python isolado e cria o atalho **DnD Scribe Companion** no Desktop.

O operador escolhe a raiz de dados durante a instalação. ZIPs do Craig,
faixas, modelo Whisper, transcrições, revisões e SQLite permanecem nessa raiz.
O serviço escuta somente em `127.0.0.1:8765`.

## Fluxo do operador

1. entrar em `https://dnd.faysk.dev/edit/`;
2. abrir **Processamento local**;
3. clicar em **Baixar para Windows**;
4. executar `DnDScribeCompanionSetup.exe` e escolher a pasta de dados;
5. aguardar a preparação do Python e das bibliotecas CUDA;
6. permitir ao Chrome o acesso à rede local;
7. selecionar o ZIP FLAC Multi-track pelo seletor do Windows;
8. validar a amostra de cinco minutos antes da sessão completa.

A primeira instalação baixa as dependências Python. A primeira transcrição
baixa o modelo `large-v3-turbo`. O computador precisa de driver NVIDIA recente,
Python 3.11/3.12 (o instalador tenta instalar 3.12 via `winget`) e espaço livre.
Não é necessário colocar o ZIP manualmente em uma pasta: o seletor preserva o
original e cria uma cópia verificada na raiz gerenciada.

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
