# 095 - Roll20 authenticated preview

## Objetivo

Transformar a pagina estatica do Roll20 em uma ferramenta real de trabalho para a mesa: preview local continua instantaneo, mas DM/Owner logado pode validar o mesmo chat contra a API de producao antes de qualquer persistencia.

## Decisoes

- O endpoint publico para a pagina usar e `POST /api/roll20-ingest`.
- `POST /api/roll20/ingest` tambem existe no handler, mas a rota curta evita a limitacao observada no catch-all da Vercel.
- A validacao em producao ainda e `dry_run_only`: nao grava eventos no banco.
- A autorizacao final fica no backend com `requireCampaignAccess(..., ['owner', 'master'])`.
- O browser usa apenas a chave publica do Supabase retornada por `/api/auth-config`; service role e segredos continuam apenas no servidor.

## Implementado nesta etapa

- `web/roll20.html` agora carrega Supabase e `auth-fetch.js`.
- A tela mostra estado de login, role da campanha e a acao de login Discord/Google.
- O botao `Validar API` envia o chat copiado para `/api/roll20-ingest` em modo dry-run.
- A resposta do backend aparece no painel lateral com quantidade de eventos validos e role do ator.
- O preview local, copiar JSON e baixar JSON continuam funcionando sem depender da API.

## Validacao feita

- `npm run check:roll20`
- `npm run check:web`
- `npm run build`
- Teste direto em producao de `POST /api/roll20-ingest` sem login retornou `401 Login Discord ou Google obrigatorio.`, confirmando que a rota existe e esta protegida.

## Proximas 10 etapas

1. Validar visualmente `/roll20.html` em producao com login Discord do DM.
2. Testar `Validar API` com um trecho real copiado do Roll20.
3. Criar tabela ou contrato final para persistir eventos Roll20 normalizados.
4. Adicionar endpoint de persistencia com `dryRun: false` apenas para DM/Owner.
5. Definir fila de review para canon, acoes de personagem, notas DM e hints de audio.
6. Ligar eventos Roll20 persistidos ao fluxo de review/publicacoes existente.
7. Criar macros Roll20 prontas para copiar na campanha.
8. Automatizar importacao de chat exportado quando o Roll20 permitir um fluxo menos manual.
9. Adicionar auditoria: quem enviou, quando enviou, qual trecho de chat originou cada evento.
10. Escrever teste automatizado cobrindo parser local, normalizador e endpoint dry-run com auth mockado.
