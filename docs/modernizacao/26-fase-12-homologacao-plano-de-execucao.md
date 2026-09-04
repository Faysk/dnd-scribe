# 26 — Fase 12: plano de execução de Homologação

Status: **pré-planejado; execução depende da Fase 11 concluída**

## Objetivo

Validar o release candidate moderno com uso humano real antes de qualquer mudança no domínio de produção.

A Fase 11 prova paridade técnica. A Fase 12 responde uma pergunta diferente:

> a mesa consegue usar o novo DnD Scribe com confiança, sem precisar pensar na migração?

A homologação ocorre em Preview/hostname estável separado. `dnd.faysk.dev` continua no projeto legado.

---

## 1. Release candidate fixo

A homologação começa com um commit identificado:

```txt
commit SHA
Preview/Homolog URL
data
versões principais
matriz de paridade associada
```

Não testar uma branch que recebe commits silenciosamente durante a sessão de homologação.

Se uma correção entrar:

```txt
novo commit
→ novo release candidate
→ retestar cenários afetados
```

---

## 2. Hostname de homologação

Preferir hostname estável para:

- OAuth;
- cookies;
- favoritos temporários;
- testes repetidos;
- comparação entre usuários.

Exemplo conceitual:

```txt
next.dnd.faysk.dev
```

ou hostname equivalente aprovado.

Ele pertence ao novo projeto Next e não substitui produção.

---

## 3. Participantes

Idealmente homologar com mais de um tipo de usuário real quando disponíveis:

```txt
usuário aprovado comum
usuário com canOpenEdit/role elevada
usuário pending access de teste
```

Não é necessário criar contas fictícias privilegiadas se isso aumentar risco. Usar perfis/controlos reais disponíveis ou fixtures seguras para cenários não destrutivos.

---

## 4. Regra de homologação

Durante a homologação:

- não adicionar features;
- não mudar copy/design a cada opinião isolada;
- registrar todo feedback;
- corrigir regressões e blockers;
- separar preferência de problema real;
- manter produção intacta.

---

## 5. Cenário 1 — Primeiro acesso

Com navegador sem sessão do novo hostname:

```txt
abrir app
→ login
→ escolher provider
→ OAuth
→ callback
→ Home
```

Avaliar:

- clareza;
- ausência de flash estranho;
- tempo percebido;
- erro compreensível se OAuth falhar;
- URL final correta;
- tema inicial coerente.

---

## 6. Cenário 2 — Usuário já autenticado

```txt
abrir hostname
→ sessão restaurada
→ Home diretamente
```

Validar:

- não pedir login de novo sem motivo;
- role/capabilities corretos;
- avatar/perfil;
- tema persistido.

---

## 7. Cenário 3 — Acesso pendente

```txt
login válido
→ sem campaignRole
→ Acesso pendente
→ Verificar novamente
→ logout
```

Avaliar:

- mensagem compreensível;
- não parecer erro técnico;
- recheck funciona;
- nenhuma informação privada da campanha aparece.

---

## 8. Cenário 4 — Home moderna

O jogador deve conseguir responder em poucos segundos:

```txt
onde paramos?
qual foi a última sessão?
como abro o arquivo completo?
```

Validar:

- LatestSession chama atenção sem dominar tudo;
- stats não parecem dashboard SaaS;
- RecentSessions suficientes;
- CTA `/sessoes` descobrível;
- nenhuma feature futura vazia.

Pergunta prática:

> antes da próxima sessão, eu saberia onde clicar sem explicação do desenvolvedor?

---

## 9. Cenário 5 — Arquivo de sessões

```txt
Home
→ Ver todas as sessões
→ escolher sessão recente
→ voltar
→ escolher sessão antiga
```

Avaliar:

- scanning dos cards;
- legibilidade de títulos longos;
- capas;
- datas;
- metadata;
- scroll;
- retorno.

---

## 10. Cenário 6 — Resumo

Abrir sessão recente:

```txt
/sessoes/[id]
```

Validar:

- usuário entende que resumo é conteúdo principal;
- hero não atrapalha;
- título/arco/data claros;
- Markdown agradável em leitura longa;
- largura boa;
- navegação para transcrição evidente mas secundária.

Repetir com resumo antigo/longo.

---

## 11. Cenário 7 — Transcrição

```txt
Resumo
→ Transcrição
→ buscar termo conhecido
→ filtrar speaker
→ combinar filtros
→ limpar
→ scroll até carregar páginas
→ simular/observar retry quando possível
→ download .md
→ voltar ao Resumo
```

Avaliar não apenas “funciona”, mas:

- controles são encontrados;
- feedback de loading é claro;
- texto continua legível;
- mobile não fica apertado;
- scroll não engasga.

---

## 12. Cenário 8 — Links históricos

Abrir links reais/representativos:

```txt
/#/sessao/:id
/#/sessao/:id/resumo
```

Confirmar bridge ADR 011.

Idealmente testar um link copiado de conversa/histórico antigo, não apenas URL digitada manualmente.

---

## 13. Cenário 9 — Tema

Em cada tela principal:

```txt
system
light
dark
```

Avaliar:

- contraste;
- identidade;
- leitura longa;
- cards;
- imagens;
- focus;
- reload/persistência.

Pergunta:

> os dois parecem versões oficiais do mesmo produto?

---

## 14. Cenário 10 — Mobile

Executar em aparelho real quando possível, não apenas DevTools.

Fluxo completo mínimo:

```txt
login
Home
/sessoes
resumo
transcrição
busca
speaker
theme
menu
logout
```

Observar:

- teclado virtual;
- safe areas;
- sticky/fixed elements;
- scroll;
- target sizes;
- orientação quando relevante;
- rede móvel real se possível.

---

## 15. Cenário 11 — Browser real

Além de automação, testar pelo menos:

- Chrome/Chromium desktop;
- Firefox desktop;
- Safari/WebKit quando disponível;
- Chrome/Android ou equivalente;
- Safari/iOS quando disponível.

Não é necessário que cada player execute toda matriz. Distribuir cobertura de maneira prática.

---

## 16. Cenário 12 — Falha controlada

Homologar pelo menos um erro não destrutivo:

- bloquear request em DevTools;
- usar ID inexistente;
- simular offline temporário;
- usar fixture de erro no ambiente de teste.

Validar:

- mensagem;
- retry;
- retorno;
- ausência de detalhes sensíveis.

---

## 17. Gateway legado em homologação

Antes do cutover, o hostname novo deve conseguir exercitar a topologia do ADR 012 sem mover produção.

Testar paths representativos:

```txt
/api/... legado via gateway
/edit ou caminho equivalente
/terms
/privacy
/docs/api
```

Se o gateway ainda não estiver ativado na Homologação, ele precisa ser testado em release candidate específico antes da Fase 13.

O objetivo é não descobrir no dia do cutover que a Home funciona e todo o resto morreu. 😅

---

## 18. Central Local/Edit

Como essa superfície continua legada:

- não redesenhar;
- confirmar bridge/gateway;
- confirmar headers necessários;
- confirmar que o caminho histórico continua acessível;
- confirmar que permissões atuais continuam aplicadas.

Não testar ações destrutivas sem necessidade.

---

## 19. Performance percebida

Mesmo após benchmarks, perguntar aos usuários:

- Home parece instantânea/adequada?;
- covers aparecem sem piscar demais?;
- resumo abre rápido?;
- busca responde rápido?;
- mobile sente atraso?;

Feedback subjetivo não substitui números, mas pode revelar problema que mediana de laboratório esconde.

---

## 20. Checklist de experiência

Cada homologador pode responder:

```txt
[ ] encontrei a última sessão sem ajuda
[ ] entendi onde ficam todas as sessões
[ ] abri um resumo
[ ] achei a transcrição
[ ] usei busca/filtro
[ ] troquei tema
[ ] usei no celular
[ ] encontrei algum bloqueio
[ ] preferiria voltar ao legado por algum motivo? qual?
```

Evitar formulário gigante; o objetivo é evidência útil.

---

## 21. Classificação de feedback

Usar quatro categorias:

### A — Blocker de cutover

Exemplos:

- login falha;
- dados errados;
- mobile inutilizável;
- download quebrado;
- gateway rompe API importante.

### B — Regressão relevante

Corrigir antes do cutover quando possível.

### C — Refinamento não bloqueante da modernização

Pode entrar antes do cutover se pequeno e seguro; senão registrar para estabilização.

### D — Feature futura

Não entra agora.

---

## 22. Severidade

Sugestão:

```txt
critical
high
medium
low
future
```

Cutover exige:

```txt
critical = 0
high = 0
```

Medium precisa de decisão explícita de aceite/adiamento.

---

## 23. Correções durante homologação

Para cada correção:

1. abrir issue/registro;
2. corrigir em branch/PR;
3. CI completo;
4. novo Preview;
5. retestar cenário afetado;
6. atualizar release candidate.

Não editar produção para “testar rapidinho”.

---

## 24. Evidências

Registrar:

```txt
release candidate SHA
hostname
data
participantes/cenários cobertos
browsers/devices
issues encontrados
issues resolvidos
screenshots relevantes
aceites deliberados
```

Não registrar conteúdo privado desnecessário em issues públicas se houver risco.

---

## 25. Aprovação

A homologação não exige unanimidade estética sobre cada pixel.

Exige confiança operacional de que:

- fluxo principal é melhor/igual;
- nada essencial sumiu;
- mudanças deliberadas fazem sentido;
- não há blocker conhecido;
- rollback está preparado.

Registrar aprovação explícita do responsável pelo projeto antes da Fase 13.

---

## 26. Cutover rehearsal

Antes de aprovar a fase, executar ensaio documental/técnico:

```txt
qual commit vai?
qual projeto recebe domínio?
qual é legacy origin?
quais rewrites entram?
qual smoke matrix?
como rollback?
quem executa?
```

Não mover o domínio no ensaio.

---

## 27. O que NÃO fazer

- iniciar features futuras a partir de feedback;
- migrar backend de última hora;
- remover projeto legado;
- mudar banco sem necessidade;
- mover domínio antes da aprovação;
- aceitar blocker porque “dá para arrumar depois”.

---

## 28. Gate de saída

A Fase 12 termina quando:

```txt
release candidate identificado ✅
OAuth real homologado ✅
authorized user ✅
pending access ✅
Home ✅
/sessoes ✅
resumo ✅
transcrição ✅
busca/filtro/download ✅
legacy hash links ✅
dark/light ✅
mobile real ✅
browsers críticos ✅
erro/retry ✅
gateway legado ensaiado/testado ✅
critical/high = 0 ✅
medium aceitos explicitamente ✅
cutover rehearsal ✅
aprovação explícita ✅
```

---

## 29. Próxima fase

Após o gate:

```txt
Fase 13 — Cutover
```

Essa é a primeira fase em que `dnd.faysk.dev` pode ser movido para o novo projeto.