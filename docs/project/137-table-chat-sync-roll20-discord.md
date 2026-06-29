# 137 - Table chat sync: Roll20 and Discord

Data: 2026-06-29

## Objetivo

Deixar a captura de conversas, rolagens e eventos externos pronta para uso real em producao, sem depender de scripts locais e sem custo OpenAI.

## Discord

O Discord e a parte que pode ser automatizada via API oficial:

- `POST /api/discord-sync-channel` busca mensagens do canal configurado;
- o bot usa `DISCORD_BOT_TOKEN` e `DISCORD_DND_CHANNEL_ID`;
- mensagens viram `table_notes` com `source_system='discord'`;
- a timeline exibe a lane `Discord`;
- anexos ficam referenciados por URL/metadados, sem baixar/copiar arquivo;
- a sincronizacao e idempotente por `source_id=discord-message:<id>`.

### Janela da sessao

A timeline agora consegue pedir `syncMode='session_window'`.

Nesse modo o backend:

1. busca paginas de mensagens do Discord, mais recentes para antigas;
2. para quando cruza o inicio real da sessao;
3. filtra por `sessions.started_at` e `sessions.ended_at`/`duration_ms`;
4. grava apenas mensagens dentro da janela, exceto quando `includeBeforeStart` ou `includeAfterEnd` forem usados;
5. devolve metadados de paginas, mensagens buscadas, aceitas, criadas e atualizadas.

Limites conservadores:

- ate 100 mensagens por chamada;
- ate 10 paginas por execucao;
- nenhum uso de OpenAI.

## Roll20

Roll20 ainda entra pelo caminho seguro de import autenticado no site:

- `/roll20.html` exige login;
- `POST /api/roll20-ingest` exige owner/master;
- eventos sao gravados em `roll20_events`;
- a timeline exibe a lane `Roll20`;
- comandos `!dnd`, conversa comum e rolagens podem entrar no mesmo eixo temporal.

### Dados e rolagens

O parser compartilhado (`lib/roll20-commands.js`) agora extrai dados comuns, incluindo:

- formula: `1d20 + 4`, `[[1d20+7]]`, etc.;
- resultado final quando aparece como `= 17`, `resultado 17`, `total 17`;
- termos de dado, como `1d20`;
- indicio de critico/falha critica quando for um d20 com resultado bruto 20 ou 1.

O payload persistido recebe `diceRoll`, e a timeline/review mostram formula e resultado sem precisar abrir o JSON cru.

### Sincronizacao temporal

Quando o chat Roll20 tem horario por linha e o import informa `Inicio da sessao`, o parser calcula `approxStartMs`.

Quando a sessao tambem tem `started_at`, a API estima `created_at_roll20` como:

```text
sessions.started_at + approxStartMs
```

Isso deixa Roll20, Discord e audio comparaveis na timeline.

## Limite tecnico do Roll20

O projeto ainda nao faz "pull" server-side automatico do Roll20 porque nao ha, no projeto, um token/API oficial configurado para ler historico da campanha em producao.

O caminho atual e intencional:

- nao guardar cookie de navegador Roll20 em servidor;
- nao depender de scraping fragil em Vercel;
- importar texto/export do chat pela UI autenticada;
- manter tudo auditavel e idempotente no Supabase.

Se depois quisermos auto-coleta Roll20, o proximo desenho recomendado e um conector explicito:

1. uma extensao/bookmarklet ou bridge no navegador do DM, lendo a pagina Roll20 ja autenticada;
2. envio para `/api/roll20-ingest` com login do DnD Scribe;
3. fallback manual por copy/paste/export;
4. somente considerar worker com credenciais Roll20 se aceitarmos os riscos de login automatizado, captcha, mudancas de HTML e termos da plataforma.

## Status de producao

Pronto agora:

- Discord: sincronizacao manual por bloco e por janela da sessao;
- Roll20: import autenticado de chat, conversa comum e dados;
- Timeline: fala/audio + Discord + Roll20 no mesmo eixo;
- Custo: OpenAI USD 0 nessa etapa.

Ainda futuro:

- conector Roll20 por navegador para puxar automaticamente sem copy/paste;
- botao na timeline para transformar mensagem Discord/Roll20 em canon ou nota revisada;
- vinculo visual direto entre rolagem Roll20 e fala/acao de personagem.
