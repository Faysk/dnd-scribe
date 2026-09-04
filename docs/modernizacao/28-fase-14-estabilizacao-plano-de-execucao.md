# 28 — Fase 14: plano de execução da Estabilização

Status: **pré-planejado; execução começa imediatamente após Fase 13**

## Objetivo

Observar a aplicação moderna em produção, corrigir regressões reais e confirmar que o novo frontend é operacionalmente estável antes de encerrar a modernização ou iniciar qualquer feature nova.

A modernização ainda está sob feature freeze.

---

## 1. Regra da fase

> produção nova não significa modernização concluída.

Durante a estabilização:

- bugs da migração têm prioridade absoluta;
- feedback é triado;
- performance real é observada;
- auth e gateway legado recebem atenção especial;
- nenhuma feature de Pessoas/NPC/Lore entra.

---

## 2. Janela mínima

Direção padrão:

```txt
mínimo de 7 dias corridos
```

A janela deve ser estendida se:

- houver bug high/critical;
- auth ainda apresentar incidentes;
- gateway legado tiver falha recorrente;
- uma correção relevante entrar perto do fim da janela;
- não houver uso real suficiente para validar os fluxos críticos.

A janela não termina apenas porque o calendário chegou ao sétimo dia.

---

## 3. Observação intensiva inicial

Nas primeiras horas após cutover, monitorar mais de perto:

```txt
5xx
401/403 inesperados
auth callback
BFF
legacy upstream
gateway /api/*
/edit/central-local
transcript requests
image errors
```

Se surgir blocker, aplicar critério de rollback da Fase 13 enquanto ainda fizer sentido.

---

## 4. Logs dos dois projetos

A modernização continua operando em dois projetos:

```txt
Projeto Next
→ frontend + BFF + gateway

Projeto legado
→ API + jobs + Central Local + crons
```

Portanto incidentes precisam ser correlacionados.

Pergunta de triagem:

```txt
falhou no Next?
falhou no gateway?
falhou no upstream legado?
falhou no Supabase?
```

Não abrir issue genérica “site lento/quebrado” sem tentar classificar a camada.

---

## 5. Métricas funcionais

Observar ao menos:

- logins bem-sucedidos;
- callbacks com erro;
- 401/403 inesperados;
- Home load;
- `/sessoes`;
- summary requests;
- transcript initial/load-more;
- search/filter;
- download;
- passthrough legado.

Não é necessário coletar analytics invasivo. Logs operacionais agregados podem ser suficientes.

---

## 6. Auth em produção

Cenários a confirmar durante a janela:

```txt
usuário já logado volta ao site
sessão expira/renova
novo login Discord
novo login Google
logout/login
pending access
capability real
```

Observar problemas que Preview pode não reproduzir:

- cookies no domínio real;
- redirects;
- cache/CDN;
- múltiplas abas;
- sessão antiga do legado.

---

## 7. Gateway legado

Monitorar rotas encaminhadas:

```txt
/api/* legado
/edit/*
/central-local/*
/terms
/privacy
/linked-role
/docs/api/*
```

Observar:

- loops;
- status divergentes;
- headers perdidos;
- cache inesperado;
- latência adicional;
- erros de integração externa.

Manter matriz de paths legados ainda em uso.

---

## 8. Crons e jobs

Confirmar após cutover que:

- crons continuam executando somente no projeto legado;
- não houve duplicação;
- paths chamados pelos crons continuam válidos;
- jobs/pipeline não sofreram efeito colateral da mudança de domínio.

Qualquer problema nessa área é regressão da modernização, mesmo que o frontend esteja bonito.

---

## 9. Integrações externas

Observar pelo menos um ciclo real das integrações relevantes quando ocorrerem.

Exemplos do inventário atual:

- Discord;
- Roll20;
- API integrations;
- companion/tooling.

Se não houver tráfego real durante a janela, manter smoke programado e registrar limitação de evidência.

---

## 10. Performance real

Comparar sinais de produção com Fase 10.

Observar:

```txt
Home LCP/percepção
resumo
transcript first load
search/filter latency
image loading
mobile network
5xx/timeouts
```

Uma regressão que só aparece em rede/dispositivo real deve ser investigada mesmo que Lighthouse esteja verde.

---

## 11. Feedback da mesa

Coletar de forma leve.

Perguntas úteis:

- conseguiu encontrar a última sessão?;
- resumo ficou mais fácil de achar?;
- teve alguma dificuldade no celular?;
- busca da transcrição funcionou como antes?;
- tema claro/escuro incomodou em algo?;
- algum link antigo quebrou?;
- precisou usar o site legado por algum motivo?

A última pergunta é especialmente importante.

---

## 12. Classificação de feedback

### 1. Regressão da modernização

Corrigir durante Fase 14.

### 2. Refinamento necessário para fechar modernização

Avaliar e corrigir se impacto real.

### 3. Feature futura

Registrar para o roadmap seguinte; não implementar.

### 4. Preferência pessoal sem impacto relevante

Registrar opcionalmente; não bloquear encerramento.

---

## 13. Severidade de bugs

### Critical

- exposição de dados/segredo;
- autorização quebrada;
- app indisponível;
- integração crítica causando efeito destrutivo.

### High

- login não funciona para grupo relevante;
- sessões/resumo/transcrição inacessíveis;
- gateway crítico quebrado;
- mobile inutilizável.

### Medium

- fluxo funciona com fricção significativa;
- erro/retry ruim;
- problema visual importante mas contornável.

### Low

- detalhe visual/copy;
- refinamento sem impacto operacional.

Gate final exige Critical/High = 0.

---

## 14. Correções durante estabilização

Toda correção deve manter disciplina:

```txt
issue/registro
→ branch/PR
→ CI
→ Preview
→ smoke
→ produção
```

Evitar editar configuração diretamente em produção sem registro, exceto resposta emergencial devidamente documentada depois.

---

## 15. Regressão visual pós-cutover

Alterações feitas durante estabilização precisam rodar snapshots relevantes.

Não deixar a correção de um bug de mobile mudar silenciosamente a Home desktop.

---

## 16. Regressão de performance pós-cutover

Para correções significativas em:

- imagens;
- auth;
- BFF;
- transcrição;
- caching;

repetir benchmark proporcional ao risco.

Não é necessário rerodar toda Fase 10 para mudar uma copy.

---

## 17. Rollback ainda disponível

Durante a parte inicial da estabilização, rollback de domínio continua sendo opção se surgir defeito sistêmico grave.

Com o tempo, preferir forward fix quando:

- dados/contratos já provaram estabilidade;
- defeito é isolado;
- rollback causaria mais impacto que correção.

A decisão é operacional, não orgulho da migração.

---

## 18. Frontend legado

Durante Fase 14 o frontend antigo ainda deve permanecer recuperável no projeto legado/deployment histórico.

Não apagar imediatamente:

```txt
web/
public legacy build path
configuração de rollback
```

A decisão de arquivar/remover frontend antigo ocorre na Fase 15.

Backend/API legados podem permanecer por muito mais tempo conforme ADR 012.

---

## 19. Hash bridge

Monitorar ocorrências quando possível.

Se links `#/sessao/...` ainda forem usados, isso reforça manutenção da bridge.

Não remover na estabilização.

---

## 20. Documentação viva

Durante a fase, corrigir documentação se produção real divergir do plano:

- versão efetiva;
- hostname;
- gateway paths;
- OAuth;
- runbooks;
- smoke tests;
- observabilidade.

O relatório final deve refletir o que foi implantado, não o que pretendíamos implantar.

---

## 21. Dívidas encontradas

Toda dívida recebe categoria:

```txt
modernization debt
legacy backend debt
future feature
operational improvement
```

Somente debt que compromete estabilidade impede fechamento.

Não misturar feature futura com bug atual para justificar extensão infinita da modernização.

---

## 22. Uso real como prova

Antes de encerrar, exigir evidência de uso normal:

- mais de um acesso autenticado;
- consulta de sessões;
- resumo;
- transcrição;
- busca/filtro;
- mobile quando disponível.

Idealmente incluir pelo menos um uso próximo de uma sessão real da mesa.

Se isso não ocorrer durante 7 dias, a janela pode ser estendida ou homologação real complementar pode ser registrada.

---

## 23. Checklist diário leve

Durante a janela:

```txt
[ ] 5xx anormais?
[ ] auth errors anormais?
[ ] gateway errors?
[ ] upstream legado saudável?
[ ] bugs novos?
[ ] feedback novo?
[ ] correção publicada?
```

Não precisa virar operação 24/7 para um projeto pessoal, mas evita “ninguém olhou e então estava estável”. 😆

---

## 24. Critério de extensão da estabilização

Reiniciar/estender janela após:

- correção critical/high;
- mudança relevante em auth;
- mudança relevante de gateway;
- alteração estrutural da transcrição;
- troca de estratégia de cache.

A extensão pode ser proporcional ao risco, não necessariamente mais sete dias completos para toda pequena mudança.

---

## 25. Critério de encerramento

A Fase 14 termina quando:

```txt
janela mínima/uso suficiente ✅
critical bugs = 0 ✅
high bugs = 0 ✅
auth estável ✅
Home/sessões/resumo estáveis ✅
transcrição estável ✅
mobile aprovado em uso real ✅
dark/light aprovados ✅
gateway legado estável ✅
crons/jobs sem regressão ✅
integrações críticas sem regressão conhecida ✅
performance real aceitável ✅
documentação corresponde à produção ✅
nenhum motivo provável para rollback por bug conhecido ✅
feature freeze mantido ✅
```

Medium restantes precisam estar explicitamente aceitos/documentados.

---

## 26. Saída da fase

Produzir um relatório curto de estabilização:

```txt
período
incidentes
bugs corrigidos
métricas observadas
feedback
legacy dependencies restantes
issues aceitos
status final
```

---

## 27. Próxima fase

Após o gate:

```txt
Fase 15 — Encerramento da Modernização
```

Ainda não iniciar roadmap de features até o relatório final declarar a modernização concluída.