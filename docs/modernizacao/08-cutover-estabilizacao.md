# 08 — Cutover e estabilização

Status: **plano para fase final da modernização**

## Objetivo

Trocar o app público legado pela nova aplicação de forma controlada, reversível e observável, seguido por um período de estabilização antes de qualquer roadmap de features.

## Pré-condições para cutover

O cutover só pode começar quando:

- matriz de paridade obrigatória estiver em 100%;
- Preview estiver aprovado;
- auth real validada;
- dark/light homologados;
- desktop/mobile homologados;
- smoke tests preparados;
- CI verde;
- nenhuma regressão crítica/alta aberta;
- rollback documentado;
- env de produção revisado;
- mudanças de banco, se houver, forem compatíveis ou reversíveis.

## Checklist pré-deploy

### Código

- [ ] branch atualizada com `main`;
- [ ] typecheck verde;
- [ ] lint verde;
- [ ] unit tests verdes;
- [ ] E2E críticos verdes;
- [ ] build verde;
- [ ] visual regression revisada.

### Ambiente

- [ ] variáveis de produção presentes;
- [ ] URLs de Supabase corretas;
- [ ] chaves públicas corretas;
- [ ] nenhuma chave privilegiada no client;
- [ ] redirects/rewrite revisados;
- [ ] domínios de imagens permitidos;
- [ ] cookies/auth validados no domínio final.

### Dados

- [ ] nenhum migration destrutivo não testado;
- [ ] backup aplicável concluído;
- [ ] sessões reais consultáveis no Preview;
- [ ] sessão mais recente validada;
- [ ] sessão antiga validada.

### Operação

- [ ] deploy anterior conhecido para rollback;
- [ ] responsável pelo cutover definido;
- [ ] janela de observação definida;
- [ ] procedimento de rollback acessível.

## Deploy

Preferência:

1. gerar Preview idêntico ao artefato candidato;
2. homologar;
3. promover/deployar o mesmo commit para produção;
4. executar smoke test imediatamente.

Evitar mudanças adicionais entre homologação e produção.

## Smoke test de produção

Executar nesta ordem:

1. abrir `/`;
2. validar assets e tema padrão;
3. login com usuário real;
4. validar avatar/perfil;
5. abrir `/sessoes`;
6. abrir a sessão mais recente;
7. confirmar resumo;
8. abrir transcrição;
9. buscar termo conhecido;
10. filtrar speaker conhecido;
11. limpar filtros;
12. testar paginação/progressive load;
13. baixar `.md`;
14. alternar dark/light;
15. logout;
16. repetir cenário essencial em mobile.

## Critérios para rollback imediato

Rollback deve ser considerado sem insistir em hotfix quando ocorrer:

- login quebrado para usuários reais;
- Home ou sessões inacessíveis;
- dados exibidos de campanha errada;
- falha de autorização/RLS;
- exposição de segredo;
- transcrição essencialmente inutilizável;
- regressão severa em mobile;
- erro de produção sem correção rápida e segura.

## Rollback

O procedimento exato será preenchido antes do cutover com os mecanismos reais de Vercel e banco.

Deve incluir:

```txt
commit/deploy estável anterior
como restaurar o deploy
como validar auth
como validar sessão
como validar transcrição
como lidar com migrations feitas durante o cutover
```

## Compatibilidade com links antigos

Antes do cutover, testar links salvos que usam hash routing.

Casos:

```txt
/#/
/#/sessao/:id
/#/sessao/:id/resumo
```

Como fragmentos de URL não chegam ao servidor, pode ser necessário manter bridge client-side temporária para redirecionar links antigos às novas rotas.

A bridge deve ser removida apenas quando o custo de compatibilidade não justificar mais sua manutenção.

## Período de estabilização

Após produção, começa uma fase explícita de estabilização.

Durante esse período:

- feature freeze continua ativo;
- nenhuma feature de personagem/NPC/lore é iniciada;
- prioridade absoluta para regressões da migração;
- métricas reais são coletadas;
- feedback da mesa é classificado.

## O que observar

### Funcional

- auth;
- navegação;
- sessões;
- resumo;
- transcrição;
- busca;
- download;
- temas.

### Performance

- carregamento da Home;
- carregamento das imagens;
- abertura da sessão;
- transcript pagination;
- comportamento em rede móvel.

### UX

- usuários encontram o resumo mais rápido?;
- `/sessoes` está fácil de descobrir?;
- tema claro continua confortável para leitura?;
- mobile exige passos inesperados?;
- ações principais estão claras?.

## Classificação de feedback

Todo feedback pós-cutover entra em uma destas categorias:

1. regressão da modernização — corrigir agora;
2. refinamento necessário para fechar modernização — avaliar agora;
3. feature futura — backlog do roadmap seguinte;
4. preferência pessoal sem impacto relevante — registrar, não bloquear.

## Encerramento da estabilização

A estabilização termina quando:

- não houver bug crítico/alto aberto da migração;
- auth estiver estável;
- performance real estiver aceitável;
- dark/light estiverem aprovados em uso real;
- mobile estiver aprovado em uso real;
- documentação corresponder à produção;
- rollback não for mais necessário como resposta provável a defeitos conhecidos.

## Próximo passo

Somente após o encerramento desta fase pode ser produzido o relatório final da modernização e, depois, um novo roadmap para expansão de features.
