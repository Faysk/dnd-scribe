# Login Google e Usuários

A versão real deve usar Supabase Auth com Google Provider.

## Fluxo

1. Usuário entra em `dnd.faysk.dev`.
2. Clica em “Entrar com Google”.
3. Supabase autentica o Google.
4. O sistema busca o perfil vinculado em `campaign_members`.
5. O perfil define:
   - nome do jogador;
   - personagem;
   - papel: DM ou player;
   - permissões;
   - campanhas disponíveis;
   - quais segredos e fontes pode ver.

## Perfis iniciais

| Usuário | Papel | Personagem | Observação |
|---|---|---|---|
| Yuhara | DM | Mestre | Aprova canon e gerencia permissões. |
| Renan | Player | Dandelion | Pode criar diários privados, músicas e segredos. |
| Arthur | Player | Astel | Possui Roll20 Pro e pode operar o logger. |
| Fernanda | Player | Screacky | Controla segredos e decisões da Screacky. |

## Regra importante

O DM não deve acessar automaticamente diário privado `owner_only`.

Diário privado é rascunho pessoal, não canon.
