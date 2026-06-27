# 097 - Production-only acceptance rule

## Regra fixa

Nada novo e considerado concluido apenas por funcionar localmente. A partir desta etapa, todo fluxo do DnD Scribe deve ser pensado, implementado e validado para producao primeiro.

## Criterio de aceite

- Deploy na Vercel precisa ficar `READY` no commit esperado.
- A URL publica em `https://dnd.faysk.dev` precisa servir os arquivos novos.
- APIs novas precisam responder em producao com auth correta.
- Escritas precisam exigir role adequada no backend, nao apenas esconder botao no frontend.
- Qualquer ferramenta local fica restrita a desenvolvimento, teste auxiliar ou rollback; nao e caminho principal de operacao da mesa.

## Aplicado agora

- A UI do Roll20 deixou de chamar o parser de `preview local`.
- A tela agora fala `preview no navegador` e explicita que validacao/gravação usam API de producao.
- A regra fica documentada para guiar as proximas etapas.

## Proximas 10 checagens permanentes

1. Confirmar deploy `READY` depois de cada push.
2. Confirmar que `dnd.faysk.dev` serve os assets novos.
3. Testar rota publica sem login e esperar `401` quando for privada.
4. Testar rota logada com usuario DM/Owner quando houver escrita.
5. Validar que player nao consegue acao de DM/Owner.
6. Conferir schema real do Supabase antes de depender de tabela/indice.
7. Usar transacao com rollback para validar SQL destrutivo ou novo.
8. Evitar depender de arquivos do `tmp/`, `audio/` ou ambiente local em fluxo de usuario.
9. Registrar custo esperado quando a etapa tocar IA, storage ou fila.
10. Documentar o status prod no final de cada etapa.
