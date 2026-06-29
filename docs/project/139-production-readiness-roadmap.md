# 139 - Production readiness roadmap

Data: 2026-06-29

## Objetivo

Organizar as proximas etapas de producao depois da base de login, upload,
Discord, Roll20 import/bridge e timeline inicial.

## Ordem recomendada

1. Monitoramento tecnico completo.
2. Operacao do pipeline de audio com retry/pausa/continuidade.
3. Controle de storage e custos por sessao.
4. Timeline V2 como central de revisao.
5. Conversao de eventos em nota/canon/lore.
6. Vínculo de identidades: Discord, Roll20, jogador e personagem.
7. Testes guiados de producao.
8. Auditoria e logs pesquisaveis.
9. Polimento de uso real por fase da mesa.

## Criterios de producao

- Toda etapa critica precisa ter status visivel no site.
- Toda falha precisa ter proxima acao clara.
- Toda operacao destrutiva precisa de confirmacao e registro.
- Todo custo relevante precisa aparecer antes ou perto do momento em que ele e gerado.
- Tudo que depende de servico externo precisa mostrar configurado/online/falhando.

## Prioridade imediata

Comecar por monitoramento e pipeline, porque essas duas areas reduzem risco
operacional antes de novas sessoes reais.

