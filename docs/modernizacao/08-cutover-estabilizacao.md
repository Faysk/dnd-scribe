# 08 — Cutover e estabilização

Status: **plano macro; execução detalhada nos documentos 27 e 28**

## Objetivo

Trocar o app público legado pela nova aplicação de forma controlada, reversível e observável, seguido por um período de estabilização antes de qualquer roadmap de features.

Planos detalhados:

- [27 — Fase 13: Cutover](27-fase-13-cutover-plano-de-execucao.md)
- [28 — Fase 14: Estabilização](28-fase-14-estabilizacao-plano-de-execucao.md)
- [ADR 011 — Compatibilidade de hash](adr/011-compatibilidade-hash-legado-no-cutover.md)
- [ADR 012 — Origem legada estável e gateway](adr/012-origem-legada-estavel-e-gateway-no-cutover.md)

---

## Princípio operacional

A modernização troca o **frontend público**, não todo o sistema DnD Scribe em um big-bang.

O projeto Vercel atual também hospeda API, Central Local/Edit, integrações, jobs e crons.

Por isso o cutover final usa:

```txt
legacy.dnd.faysk.dev (nome recomendado)
→ projeto legado
→ API/Central Local/jobs/crons

dnd.faysk.dev
→ projeto Next
→ páginas modernas
→ BFF moderno
→ gateway de contratos legados
```

O BFF usa `DND_LEGACY_ORIGIN` e não usa `dnd.faysk.dev` como upstream interno.

---

## Pré-condições para cutover

O cutover só pode começar quando:

- matriz de paridade obrigatória estiver em 100%;
- release candidate estiver identificado;
- Preview/Homologação estiver aprovado;
- auth real validada;
- dark/light homologados;
- desktop/mobile homologados;
- performance sem regressão crítica não justificada;
- segurança/a11y revisadas;
- smoke tests preparados;
- CI novo e legado verdes;
- nenhuma regressão crítica/alta aberta;
- rollback documentado/ensaiado;
- env de produção revisado;
- origem técnica legada saudável;
- gateway legado testado em homologação;
- OAuth do domínio final preparado;
- crons/integrations inventariados.

---

## Checklist pré-deploy

### Código

- [ ] branch/candidato atualizado e identificado;
- [ ] typecheck verde;
- [ ] lint verde;
- [ ] unit tests verdes;
- [ ] E2E críticos verdes;
- [ ] build verde;
- [ ] visual regression revisada;
- [ ] matriz de paridade verde.

### Ambiente moderno

- [ ] variáveis de produção presentes;
- [ ] URLs Supabase corretas;
- [ ] `DND_LEGACY_ORIGIN` correto;
- [ ] nenhuma chave privilegiada no client;
- [ ] redirects OAuth revisados;
- [ ] remote image patterns revisados;
- [ ] cookies/auth preparados para domínio final.

### Ambiente legado

- [ ] origem técnica DNS/TLS saudável;
- [ ] API responde diretamente na origem técnica;
- [ ] `/edit`/Central Local responde;
- [ ] crons continuam somente no projeto legado;
- [ ] integrações externas críticas identificadas;
- [ ] deployment legado atual registrado.

### Gateway

- [ ] `/api/web/*` permanece local no Next;
- [ ] `/api/*` legado representativo passa ao upstream;
- [ ] `/edit/*` passa ao upstream;
- [ ] `/central-local/*` passa ao upstream;
- [ ] `/terms`, `/privacy`, `/linked-role`, `/docs/api*` testados;
- [ ] headers especiais preservados;
- [ ] cache privado não virou compartilhado.

### Dados

- [ ] nenhum migration destrutivo não testado;
- [ ] backup aplicável confirmado;
- [ ] sessões reais consultáveis no candidato;
- [ ] sessão mais recente validada;
- [ ] sessão antiga validada.

### Operação

- [ ] responsável pelo cutover definido;
- [ ] janela de observação definida;
- [ ] logs dos dois projetos acessíveis;
- [ ] procedimento de rollback acessível;
- [ ] comunicação mínima preparada.

---

## Deploy/cutover

Preferência:

1. homologar commit candidato;
2. garantir que o mesmo commit/deployment seja promovido;
3. confirmar origem legada saudável;
4. confirmar gateway no candidato;
5. mover/associar `dnd.faysk.dev` ao novo projeto;
6. executar smoke imediato;
7. observar logs;
8. manter ou reverter conforme critérios.

Evitar qualquer mudança adicional entre homologação e produção.

---

## Smoke test de produção

Executar nesta ordem aproximada:

1. abrir `/`;
2. login com usuário real;
3. validar avatar/perfil;
4. abrir `/sessoes`;
5. abrir sessão mais recente;
6. confirmar resumo;
7. abrir transcrição;
8. buscar termo conhecido;
9. filtrar speaker conhecido;
10. limpar filtros;
11. testar progressive load;
12. baixar `.md`;
13. alternar dark/light;
14. validar hash URL antiga;
15. validar `/api/*` legado representativo via gateway;
16. validar `/edit`/Central Local;
17. validar rotas auxiliares legadas;
18. validar integração externa crítica não destrutiva;
19. logout/login;
20. repetir fluxo essencial em mobile.

---

## Critérios para rollback imediato

Rollback deve ser considerado sem insistir em hotfix quando ocorrer:

- login quebrado para usuários reais;
- Home/sessões inacessíveis;
- dados exibidos de campanha errada;
- falha de autorização/RLS;
- exposição de segredo;
- BFF em self-loop;
- `/api/*` crítico quebrado;
- gateway rompe integração importante;
- Central Local indisponível quando necessária;
- transcrição essencialmente inutilizável;
- regressão severa em mobile;
- erro sistêmico sem correção rápida e segura.

---

## Rollback

A topologia do ADR 012 torna o rollback principal simples:

```txt
mover dnd.faysk.dev de volta ao projeto Vercel legado
```

A origem técnica `legacy.dnd.faysk.dev` permanece no projeto antigo durante todo o processo.

Após rollback:

- validar Home/login legado;
- validar sessão/transcrição;
- validar `/api/*`;
- validar `/edit`;
- validar integrações críticas;
- registrar causa;
- manter projeto Next disponível apenas em homologação para correção.

---

## Compatibilidade com links antigos

ADR 011 define bridge client-side mínima para:

```txt
/#/sessao/:id
→ /sessoes/:id/transcricao

/#/sessao/:id/resumo
→ /sessoes/:id
```

Como fragmentos não chegam ao servidor, redirect server-side comum não resolve sozinho.

A bridge continua durante cutover e estabilização.

---

## Período de estabilização

Após produção começa fase explícita de estabilização.

Direção padrão:

```txt
mínimo de 7 dias corridos + evidência de uso real suficiente
```

Pode ser estendida após correção relevante.

Durante esse período:

- feature freeze continua ativo;
- nenhuma feature de personagem/NPC/lore é iniciada;
- prioridade para regressões;
- métricas reais são observadas;
- feedback da mesa é classificado;
- logs do projeto Next e legado são correlacionados.

---

## O que observar

### Funcional

- auth;
- Home;
- sessões;
- resumo;
- transcrição;
- busca;
- download;
- temas;
- hash bridge;
- gateway legado.

### Operacional

- API antiga;
- Central Local;
- jobs;
- crons;
- integrações externas.

### Performance

- Home;
- imagens;
- abertura da sessão;
- transcript pagination;
- busca/filtro;
- rede móvel.

### UX

- usuários encontram o resumo mais rápido?;
- `/sessoes` está fácil de descobrir?;
- claro continua confortável para leitura?;
- mobile exige passos inesperados?;
- ações principais estão claras?.

---

## Classificação de feedback

Todo feedback pós-cutover entra em uma destas categorias:

1. regressão da modernização — corrigir agora;
2. refinamento necessário para fechar modernização — avaliar agora;
3. feature futura — backlog do roadmap seguinte;
4. preferência pessoal sem impacto relevante — registrar, não bloquear.

---

## Encerramento da estabilização

A estabilização termina quando:

- janela mínima/uso suficiente concluídos;
- não houver bug crítico/alto aberto da migração;
- auth estiver estável;
- gateway legado estiver estável;
- crons/integrations sem regressão conhecida;
- performance real estiver aceitável;
- dark/light estiverem aprovados em uso real;
- mobile estiver aprovado;
- documentação corresponder à produção;
- rollback não for resposta provável a defeitos conhecidos.

## Próximo passo

Somente após essa fase pode ser produzido o relatório final da modernização e então, em uma etapa separada, planejado o roadmap de novas features.
