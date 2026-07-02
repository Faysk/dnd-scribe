# Roll20 Bridge usage guide

Este guia descreve como ligar a ponte Roll20 em producao para capturar chat,
rolagens, comandos e eventos da mesa no DnD Scribe.

Para o fluxo completo da mesa, veja tambem
`docs/project/190-dnd-scribe-operator-tutorials.md` e a aba `Tutoriais` no site.

## Objetivo

A ponte tem duas camadas de producao e um fallback legado:

1. Extensao Chrome local: observa o chat/rolagens no navegador do GM e envia
   eventos para `https://dnd.faysk.dev/api/roll20-bridge`.
2. API DnD Scribe: valida `ROLL20_BRIDGE_TOKEN`, normaliza os eventos e grava
   em `roll20_events`.
3. Roll20 Mod/API script: fica instalado como fallback/debug. O transporte
   antigo por chat fica desligado por padrao para nao sujar a tela do DM com
   `DND_SCRIBE_EVENT`.

O site normal nao pede esse token para jogadores. O token e somente da ponte.

## Pre-requisitos

- Usuario GM/DM com acesso ao jogo no Roll20.
- Permissao para adicionar Mod/API Script no Roll20.
- Chrome ou Edge Chromium.
- Extensao local do projeto em:
  `D:\Projects\dnd\integrations\roll20\chrome-extension`
- Producao com `ROLL20_BRIDGE_TOKEN` configurado na Vercel.
- Sessao criada no DnD Scribe para receber os eventos.

## Instalar o Mod/API no Roll20

1. Abra a pagina do jogo no Roll20.
2. Entre em `Settings` -> `Mod (API) Scripts`.
3. Clique em `New Script`.
4. Cole o conteudo de:
   `D:\Projects\dnd\integrations\roll20\dnd-scribe-mod.js`
5. Salve o script.
6. Abra a mesa normalmente pelo botao `Launch Game` / `Iniciar Jogo`.

O script responde aos comandos:

- `!dndscribe status`: mostra estado do Mod e do transporte legado.
- `!dndscribe on` ou `!dndscribe ligar`: liga apenas o Mod legado, sem enviar
  pacotes pelo chat.
- `!dndscribe off` ou `!dndscribe pausar`: pausa o Mod e desliga o transporte
  legado.
- `!dndscribe transport on` ou `!dndscribe legacy on`: liga o transporte antigo
  por chat. Use somente para debug, porque ele pode exibir `DND_SCRIBE_EVENT`
  no chat do GM se a extensao nao esconder a tempo.
- `!dndscribe transport off` ou `!dndscribe legacy off`: desliga o transporte
  antigo por chat.

## Instalar a extensao Chrome

1. Abra `chrome://extensions`.
2. Ative `Developer mode` / `Modo do desenvolvedor`.
3. Clique em `Load unpacked` / `Carregar sem compactacao`.
4. Selecione a pasta:
   `D:\Projects\dnd\integrations\roll20\chrome-extension`
5. Confirme que aparece a extensao `DnD Scribe Roll20 Bridge`.

A extensao roda apenas dentro do editor da mesa:

```text
https://app.roll20.net/editor/*
```

Se voce estiver na pagina de detalhes da campanha, o painel nao aparece.

## Configurar uma sessao real

1. Abra `https://dnd.faysk.dev/roll20-bridge.html`.
2. Faca login como DM/Owner/Admin.
3. No card `Token da ponte`, selecione a sessao alvo.
4. Copie:
   - token;
   - `sourceSessionId`;
   - config padrao, se quiser conferir URL e campaign slug.
5. Abra a mesa no Roll20.
6. No painel pequeno `DnD Scribe`, no canto inferior direito, clique em
   `Config`.
7. Preencha os prompts:

```text
DnD Scribe URL: https://dnd.faysk.dev
Campaign slug: yuhara-main
Source session id da sessao atual: <sourceSessionId copiado>
Token da ponte Roll20: <token copiado>
```

Depois disso a extensao salva a configuracao no storage local do navegador.

## Uso durante a sessao

1. Depois que a extensao estiver instalada, configurada e com o painel visivel,
   rode no chat do Roll20 se quiser conferir o Mod:

```text
!dndscribe status
```

2. Verifique o painel da extensao:
   - `ligado`: captura ativa;
   - `Captura`: deve mostrar `DOM direto`;
   - `Sessao`: deve mostrar o `sourceSessionId` correto;
   - `Fila`: deve ficar perto de zero depois dos envios;
   - resultado: deve mostrar algo como `ok: N novos, M atualizados`.

3. Durante a sessao, mensagens, rolagens e comandos do Roll20 entram na fila e
   sao enviados em lotes para producao.

4. Se quiser pausar temporariamente, use o botao `Pausar` no painel da
   extensao.

5. O comando abaixo tambem deixa o fallback legado quieto:

```text
!dndscribe off
```

Nao use `!dndscribe transport on` no fluxo normal da mesa.

## Validacao rapida

Depois de configurar, faca um teste simples no chat do Roll20:

```text
!dnd acao teste da ponte roll20
```

Resultado esperado:

- o painel da extensao mostra envio `ok`;
- a fila volta para zero;
- a sessao passa a ter evento Roll20 vinculado;
- a timeline pode usar esse evento como item sincronizado.

## Troubleshooting

### O painel da extensao nao aparece

- Confirme que a extensao esta instalada em `chrome://extensions`.
- Confirme que voce esta em `https://app.roll20.net/editor/...`.
- Recarregue a pagina da mesa.
- Confirme que a extensao tem permissao para `https://app.roll20.net/*`.

### Aparece `configure sourceSessionId e token`

- Clique em `Config` no painel da extensao.
- Cole novamente `sourceSessionId` e token.
- Confirme que a sessao selecionada em `/roll20-bridge.html` e a sessao correta.

### Aparece `401` ou `Token da ponte Roll20 invalido`

- O token da extensao nao bate com `ROLL20_BRIDGE_TOKEN` em producao.
- Copie o token de novo em `/roll20-bridge.html`.
- Se o token foi rotacionado, atualize a extensao.

### Aparece `409 ROLL20_BRIDGE_TOKEN ausente`

- A Vercel nao esta com `ROLL20_BRIDGE_TOKEN` configurado no ambiente correto.
- Configure em `Production` e faca redeploy.

### Aparece sessao nao encontrada

- O `sourceSessionId` colado na extensao nao existe mais ou nao corresponde a
  campanha `yuhara-main`.
- Copie novamente pela pagina `/roll20-bridge.html`.

### A fila cresce e nao baixa

- Clique em `Enviar` no painel da extensao.
- Confira a internet do navegador.
- Confira se o token e a sessao ainda estao corretos.
- Se continuar, pause com `Pausar`, copie o erro exibido e investigue a API.

### O GM esta recebendo mensagens enormes `DND_SCRIBE_EVENT`

Isso significa que o transporte legado por chat esta ligado ou existe um script
antigo do Mod ainda rodando no Roll20.

Acao imediata:

```text
!dndscribe transport off
!dndscribe off
```

Depois:

- confira em `Settings -> Mod (API) Scripts` se nao ha scripts antigos
  duplicados do DnD Scribe;
- substitua o Mod pelo `dnd-scribe-mod.js` versao `1.1.0` ou superior;
- confirme que a extensao esta carregada no navegador do GM que abriu a mesa;
- recarregue a pagina do Roll20;
- confirme que o painel `DnD Scribe` aparece no canto inferior direito;
- clique em `Config` e cole `sourceSessionId` e token;
- use `Enviar` se houver fila;
- nao religue `transport on` durante a mesa normal.

Mensagens curtas de `!dndscribe status` so devem aparecer quando o GM pedir
status manualmente. Pacotes longos `DND_SCRIBE_EVENT:%7B...` nao devem aparecer.

## Seguranca

- Nao cole `ROLL20_BRIDGE_TOKEN` em chat publico.
- O token deve ficar apenas na Vercel, no `.env.local` e no navegador do GM
  que esta rodando a ponte.
- Se vazar, gere outro token, atualize a Vercel, faca redeploy e reconfigure a
  extensao.
- Jogadores comuns nao precisam desse token.

## Checklist antes da mesa

- [ ] Sessao criada no DnD Scribe.
- [ ] `ROLL20_BRIDGE_TOKEN` ativo em producao.
- [ ] Mod/API script salvo no Roll20, sem duplicatas antigas.
- [ ] Extensao Chrome carregada.
- [ ] Mesa aberta em `/editor/`.
- [ ] Painel `DnD Scribe` visivel.
- [ ] `sourceSessionId` correto configurado.
- [ ] Painel mostrando `Captura: DOM direto`.
- [ ] Transporte legado desligado: `!dndscribe transport off`.
- [ ] `!dndscribe status` respondendo somente se precisar diagnosticar.
- [ ] Evento teste enviado com sucesso.
