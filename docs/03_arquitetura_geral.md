# 03 — Arquitetura Geral

## Visão de alto nível

```txt
Usuários / Mestre / Jogadores
        ↓
dnd.faysk.dev — Next.js na Vercel
        ↓
Supabase Auth + Postgres + Storage + Queues
        ↓
Worker Docker Node/Python
        ↓
OpenAI / ffmpeg / parsers
        ↓
Banco auditável + publicações
```

## Componentes

### 1. Frontend

Recomendado: **Next.js na Vercel**.

Responsável por:

- login;
- dashboard;
- criação de sessão;
- upload de arquivos;
- visualização de transcrição;
- tela de revisão;
- publicação;
- busca;
- painel público/privado;
- administração.

### 2. Supabase Auth

Responsável por:

- usuários;
- perfis;
- papéis: Mestre, Jogador, Convidado;
- permissões;
- controle de acesso aos dados privados.

### 3. Supabase Postgres

Fonte principal da verdade.

Armazena:

- sessões;
- participantes;
- arquivos;
- segmentos de transcrição;
- eventos Roll20;
- marcadores;
- candidatos;
- decisões de revisão;
- entidades;
- publicações;
- log de auditoria.

### 4. Supabase Storage

Armazena:

- arquivos Craig;
- áudio por participante;
- OBS backup;
- Roll20 chat export;
- transcrições brutas;
- JSONs intermediários;
- publicações geradas;
- eventuais cortes aprovados.

No MVP, Supabase Storage é suficiente. Futuramente, Cloudflare R2 pode entrar para baratear armazenamento de áudio bruto em grande volume.

### 5. Supabase Queues

Fila de processamento.

Exemplo:

```txt
process_session
transcribe_file
classify_segments
extract_candidates
build_publications
```

Isso evita tentar processar áudio dentro de uma request HTTP da Vercel. Vercel é linda, mas não é lugar para enfiar seis horas de áudio e falar “vai, minha filha”.

### 6. Worker Docker

Rodando inicialmente no seu WSL/local ou em uma VPS futuramente.

Stack:

- Node.js para orquestração;
- Python para processamento pesado, se necessário;
- ffmpeg para áudio;
- SDK OpenAI;
- SDK Supabase;
- parsers de Roll20/Craig.

Responsável por:

- baixar arquivos do Storage;
- converter áudio;
- dividir chunks;
- transcrever;
- juntar transcrições;
- classificar segmentos;
- extrair candidatos;
- gerar outputs;
- salvar tudo no banco.

### 7. Roll20 Pro Logger

Um Mod Script no Roll20 Pro para registrar eventos estruturados no chat.

No MVP:

- o script escreve eventos no chat;
- após a sessão, exporta o chat;
- o sistema parseia os eventos.

Futuramente:

- bridge via extensão/browser/local sidecar;
- envio em tempo real para API externa.

### 8. Discord/Craig

Craig captura áudio multitrack por participante.

Discord pode fornecer:

- slash commands de marcador;
- canal de logs;
- notificações;
- recap pós-sessão;
- comandos rápidos.

### 9. OpenAI

Uso inicial:

- transcrição por faixa Craig;
- classificação de segmentos;
- extração de candidatos de canon;
- geração de recaps;
- geração de versões públicas/privadas;
- normalização de nomes próprios com glossário.

## Fluxo principal

```txt
1. Mestre cria sessão no site.
2. Mesa joga usando Discord + Roll20.
3. Craig grava faixas separadas.
4. OBS grava backup.
5. Roll20 Logger registra eventos no chat.
6. Após a sessão, arquivos são enviados ao sistema.
7. Worker processa tudo.
8. IA gera transcrição e candidatos.
9. Mestre/jogadores revisam.
10. Sistema publica material aprovado.
```

## Ambientes

### Local/dev

```txt
Windows + WSL
Docker Compose
Supabase remoto ou local
Node.js
Python
ffmpeg
```

### Produção MVP

```txt
Vercel: frontend/API leve
Supabase: banco/storage/auth/queues
Worker: WSL/local manual ou VPS
Cloudflare: DNS dnd.faysk.dev
GitHub: repo e versionamento
```

### Produção futura

```txt
Worker dedicado 24/7
Cloudflare R2 para arquivos grandes
Backups automáticos
Observabilidade
CI/CD completo
```
