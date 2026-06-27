# 101 - Auth wall for static shell

## Objetivo

Blindar a superficie visual do site para que a mesa veja apenas uma tela simples de login antes de qualquer area operacional.

## Decisao tecnica

O projeto continua em HTML, CSS e JavaScript puro. Isso nao e problema para o MVP: as APIs e gravacoes sensiveis ja ficam protegidas no backend por token Supabase e papel da campanha.

O limite desse modelo e que arquivos estaticos como HTML, CSS e JS ainda sao baixaveis pelo navegador. Por isso, nada secreto deve ficar nesses arquivos. A seguranca real fica nas APIs, no banco e nos tokens. Para bloqueio server-side antes de servir qualquer byte da aplicacao, uma etapa futura seria migrar o shell para SSR/cookies ou middleware com sessao verificavel no servidor.

## Implementado

- A home inicia com `body.auth-locked` e mostra apenas `#siteGate`.
- O app principal so aparece depois de uma sessao Supabase detectada no navegador.
- Discord aparece como login principal; Google fica secundario.
- A pagina `/roll20.html` recebeu a mesma barreira visual.
- Sessao existente continua abrindo o app automaticamente.
- `terms`, `privacy` e `linked-role` permanecem publicos porque sao URLs exigidas/consultadas pelo Discord e nao exibem dados da mesa.

## Validacao esperada em producao

1. Abrir `https://dnd.faysk.dev` sem sessao deve mostrar somente a tela de login.
2. Abrir `https://dnd.faysk.dev/roll20.html` sem sessao deve mostrar somente a tela de login.
3. Logar com Discord deve abrir o app normal se o perfil ja estiver aprovado.
4. Logar com Google deve funcionar como alternativa.
5. APIs seguem exigindo `Authorization: Bearer <token>`.
