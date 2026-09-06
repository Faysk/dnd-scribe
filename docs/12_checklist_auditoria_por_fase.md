> **Referência histórica — direção substituída em 2026-09-06.** O [reboot TDA](reboot/README.md) define o plano vigente. Este documento preserva decisões/evidências do escopo anterior; versões, fases e declarações de conclusão abaixo não certificam o estado do reboot. Revalidar requisitos antes de reutilizá-los.

# Checklist de auditoria pós-fase

Use este checklist **depois de cada fase**, antes de iniciar a próxima.

## Código e arquitetura

- [ ] O novo caminho é o único caminho canônico?
- [ ] O código substituído foi removido?
- [ ] Não ficaram adapters/aliases sem issue e prazo de remoção?
- [ ] Não houve aumento desnecessário de dependências?
- [ ] Arquivos grandes/monolíticos foram reduzidos ou têm justificativa?
- [ ] Fronteiras de domínio não dependem de UI/HTTP desnecessariamente?

## Tipos e contratos

- [ ] TypeScript/Python typing passa sem suppressions novas injustificadas?
- [ ] Entradas externas são validadas?
- [ ] Respostas e erros têm contrato estável?
- [ ] Tipos do banco estão sincronizados com o schema?

## Segurança

- [ ] Autenticação é única e server-side onde aplicável?
- [ ] Autorização é verificada no recurso, não só na navegação?
- [ ] RLS/service-role/cookies/secrets foram revisados?
- [ ] Não há segredo em bundle/log/resposta?
- [ ] Testes negativos de permissão existem?

## Qualidade

- [ ] Install limpo funciona?
- [ ] Lint verde?
- [ ] Typecheck verde?
- [ ] Unit tests verdes?
- [ ] Build verde?
- [ ] E2E verde?
- [ ] Smoke de produção verde quando a fase toca produção?

## UX e acessibilidade

- [ ] Light e dark revisados?
- [ ] Contraste e estados de foco corretos?
- [ ] Desktop e mobile revisados?
- [ ] Loading/error/empty states coerentes?
- [ ] Sem informação editorial irrelevante na interface pública?

## Performance e operação

- [ ] Bundle/budgets não regrediram sem justificativa?
- [ ] Queries têm índices/plano aceitável?
- [ ] Jobs longos não bloqueiam request síncrono?
- [ ] Logs permitem identificar request/job/usuário sem vazar dados sensíveis?
- [ ] Retry/idempotência revisados em integrações?

## Produção

- [ ] HEAD de `main` corresponde ao SHA servido em produção?
- [ ] Não existe deployment/manual build concorrente?
- [ ] Domínio e aliases apontam para o projeto correto?
- [ ] Rollback é possível por revert/redeploy da `main`?

## Encerramento

Uma fase só recebe status **concluída** quando:

1. o novo está funcionando;
2. a auditoria acima passou;
3. as correções da auditoria foram aplicadas;
4. o substituído foi removido;
5. produção foi validada quando aplicável.
