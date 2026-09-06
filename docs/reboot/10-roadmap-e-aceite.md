# Roadmap de execução e critérios de aceite

> Status: plano documentado; implementação pendente. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

## Sequência aprovada
R0 -> R1 -> R2 -> R3 -> R4 -> R5.

A lore temporária é uma entrega auxiliar condicionada à fonte. Segurança e preservação de dados acompanham todas as fases. Datas/esforços serão estimados depois de R0; não existe prazo prometido ou percentual global.

## R0 — Preparar a reconstrução
**Estado:** não iniciada tecnicamente. A documentação de direção foi produzida.

**Entregas**
- Inventário de dados/providers/arquivos e mapa de funções atuais.
- Backup e restauração ensaiados.
- Registro das últimas versões estáveis com fontes e compatibilidade.
- Inventário de branches/PRs/deploys; criação e proteção de Preview.
- Ambiente de dados de teste, estratégia de corte e rollback.
- Checklist público fechado, decisões abertas encaminhadas e assets catalogados.

**Gate**
Todos os dados têm destino e recuperação; nenhuma versão desatualizada é adotada silenciosamente; Preview e Production têm responsáveis e escopos; critérios da primeira entrega aprovados.

**Próximo recorte concreto:** localizar as fontes de dados e pipipi, inventariar sem mutações, consultar releases oficiais e preparar a restauração isolada.

## R1 — Fundação técnica e visual
**Dependência:** R0.

**Entregas**
- Aplicação canônica em stack verificada, lockfile único e módulos definidos.
- Production/Preview com build equivalente e metadados de commit.
- Design system e assets TDA integrados; composição pública revisada.
- Contratos de leitura, autorização básica e integração segura de dados.
- CI, atualização de dependências e observabilidade configurados.

**Gate**
Instalação limpa, checks e build; Preview real identificável; zero escrita acidental em produção; temas/layout base validados; release candidata recuperável.

Não duplicar frontend público dentro da mesma branch. A coexistência entre main operacional e Preview em reconstrução é temporária e prevista.

## R2 — Home, sessões e resumos completos
**Dependência:** R1.

**Entregas**
Home, arquivo, detalhe, conteúdo existente, imagens, URLs/SEO, navegação, temas e acessibilidade. Lore temporária incluída se a fonte já estiver disponível.

**Gate de Preview**
- [ ] Todas as sessões esperadas e resumos reconciliados.
- [ ] Navegação completa, inclusive URLs antigas.
- [ ] Claro/escuro e mobile/desktop aprovados.
- [ ] Imagens e metadados corretos.
- [ ] Conteúdo privado não aparece em HTML, API pública ou cache compartilhado.
- [ ] Companion desligado não impede leitura pública.
- [ ] Acesso operacional existente continua disponível durante a troca.
- [ ] Testes/build no commit candidato, limitações registradas.

**Gate de Production**
Promoção de Preview, deploy terminal, SHA conferido e smoke de Home/arquivo/resumo/login/acesso operacional. Aprovação visual do proprietário registrada. Só então iniciar Edit novo.

## R3 — Edit moderno integrado
**Dependência:** R2 publicado e aprovado.

**Entregas**
Login/sessão únicos; capacidades; catálogo e metadados; revisão/publicação; artes; integração dos controles de operação local previstos no inventário.

**Gate**
Mesma sessão entre páginas; permissões/revogação testadas; gravação/revisão/publicação persistem; falhas não perdem trabalho; fluxos essenciais do Edit antigo têm replacement; Edit legado deixa de ser servido; smoke de produção e aceite do operador.

## R4 — Base operacional completa
**Dependência:** R3.

**Entregas**
Ciclo gravação -> transcrição -> revisão -> publicação validado; companion atualizado; instalação/upgrade Windows; jobs recuperáveis; integrações úteis recriadas; legado substituído removido.

**Gate**
Sessão real autorizada percorre todo o ciclo; GPU e CPU testados conforme suporte definido; qualidade/tempo/memória registrados; interrupção e retry sem perda/duplicação; proveniência preservada; recuperação de dados ensaiada; nenhum adapter sem consumidor/justificativa; documentação operacional atual.

Só declarar funcionamento na máquina alvo após teste nela. CI Python leve não substitui transcrição real.

## R5 — Funcionalidades novas
**Dependência:** R4 encerrado.

**Entregas**
Roadmap de produto específico para entidades/relações e outras funcionalidades priorizadas pelo proprietário.

**Gate**
Necessidade e contrato definidos por funcionalidade; dados e autorização modelados; protótipo validado; versão mais recente das tecnologias candidatas conferida; release com evidência própria.

## Ciclo por recorte
Problema e aceite -> branch temporária -> implementação -> checks -> PR para Preview -> homologação -> correções -> promoção -> smoke -> evidência -> retirada do substituído -> limpeza da branch.

## Critério de parada
Se a implementação exigir ampliar o escopo ou criar outro serviço/interface concorrente, registrar a necessidade e rever a arquitetura antes de prosseguir. Não converter atalhos em dependências permanentes sem decisão.

## Encerramento do reboot
R0–R4 aprovados com evidência, dados preservados, versões verificadas, uma aplicação web com Edit integrado, produção rastreável, recuperação praticável e legado substituído retirado. R5 é evolução posterior, não condição para dizer que a base está pronta.
