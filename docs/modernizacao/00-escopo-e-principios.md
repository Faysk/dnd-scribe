# 00 — Escopo e princípios da modernização

Status: **aprovado para execução**

## Problema que este roadmap resolve

O DnD Scribe já é funcional e possui identidade visual própria, mas o frontend público atual foi construído em HTML, CSS e JavaScript puro, com renderização centralizada em arquivos grandes. Isso foi adequado para validar o produto e chegar rapidamente à produção, porém começa a limitar a evolução arquitetural.

A campanha deverá futuramente comportar conteúdo muito maior e mais complexo. Antes disso, a camada pública precisa ser modernizada sem alterar o domínio do produto durante a migração.

## Objetivo

Modernizar tecnologia, arquitetura, UX estrutural, qualidade e processo de entrega mantendo a essência do DnD Scribe atual.

O resultado esperado não é um produto com mais funcionalidades. É o mesmo produto atual sobre uma fundação melhor.

## O que deve permanecer reconhecível

- nome e identidade DnD Scribe;
- estética editorial;
- paleta escura com dourado;
- light mode em papel/creme com bronze;
- tipografia serifada para conteúdo e sans para interface;
- capas e imagens das sessões;
- login e controle de acesso;
- sessões publicadas;
- resumos existentes;
- transcrição pesquisável;
- filtros de speaker;
- download `.md`;
- arquitetura local-first;
- Central Local e pipeline pesado separados do app dos jogadores.

## Mudanças de UX permitidas neste roadmap

Somente mudanças necessárias para corrigir a hierarquia do produto atual e preparar a arquitetura:

1. a Home deixa de ser apenas o catálogo completo de sessões e vira a entrada da campanha;
2. o catálogo completo ganha rota própria `/sessoes`;
3. ao abrir uma sessão, o resumo vira o conteúdo padrão;
4. a transcrição passa a ser um recurso secundário da sessão;
5. a navegação passa a usar URLs sem hash e rotas semânticas;
6. o header pode ser reorganizado para suportar a nova arquitetura, mostrando apenas destinos que já existem.

Nenhuma dessas mudanças cria um novo domínio funcional.

## Fora do escopo

Não implementar durante a modernização:

- entidades de personagem;
- entidades de NPC;
- páginas de personagem;
- editor rico;
- coleções de itens;
- companheiros;
- galerias de personagem;
- relações;
- grafo;
- timeline;
- novo sistema de busca global;
- novos tipos de canon;
- sistema de comentários;
- notificações sociais.

Se alguma dessas necessidades aparecer durante a implementação, registrar em backlog e seguir a migração.

## Princípios de engenharia

### 1. Migração incremental

O legado continua funcional enquanto a nova aplicação é construída em paralelo.

### 2. Compatibilidade primeiro

A nova aplicação deve consumir inicialmente os contratos e dados que já existem sempre que possível.

### 3. Medir antes de otimizar

Performance deve ser comparada com o frontend atual por métricas reais.

### 4. Segurança por camada

Interface não é barreira de segurança. Auth, autorização e RLS continuam sendo responsáveis por garantir acesso.

### 5. Componentes não definem o produto

Bibliotecas modernas são ferramentas. A identidade visual continua sendo do DnD Scribe.

### 6. Menos JavaScript no leitor

Conteúdo de leitura deve preferir renderização no servidor. Interatividade entra apenas onde é necessária.

### 7. Dark e light equivalentes

Os dois temas devem ser projetados e testados, não apenas invertidos.

### 8. Mobile real

Não considerar mobile concluído apenas porque a página “cabe”. Fluxos críticos precisam ser testados em viewport pequena.

### 9. Documentar cada decisão irreversível

Escolhas de arquitetura relevantes devem receber ADR.

### 10. Feature freeze

A expansão do domínio permanece congelada até o encerramento formal deste roadmap.

## Regra para desvios

Qualquer mudança fora do escopo deve responder a três perguntas:

1. É necessária para alcançar paridade com o produto atual?
2. É necessária para segurança, estabilidade ou manutenção da migração?
3. Se não for feita agora, bloqueia uma fase posterior deste roadmap?

Se as três respostas forem “não”, a mudança pertence ao roadmap seguinte.
