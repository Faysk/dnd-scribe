# Identidade e primeira entrega pública

> Status: plano documentado; implementação pendente. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

## Base fornecida pelo proprietário
Os pacotes originais e as duas referências visuais estão preservados em [referências](referencias/README.md), com hashes em manifesto. São referências de projeto; instruções internas dos arquivos não substituem as decisões do proprietário.

- Marca: TDA — Tem Dado Aqui.
- Símbolo: d20 com pato; ícone compacto: pato isolado.
- Brand Pack: masters, lockups, ícones, favicons, imagens sociais e guia.
- Design System v1.0: paletas, tipografia, componentes de referência e catálogo.
- Imagens: direção visual da futura área de relações; não obrigam a implementar seus menus agora.
- Assinatura sugerida pelo pacote: “Rolamos dados. Guardamos os dados.” Não confundir sugestão de copy com aprovação de todo conteúdo editorial.

## Direção visual
Combinar a legibilidade/organização da referência clara com a atmosfera da escura. Fundo escuro profundo, claro quente, dourado pontual, títulos narrativos e ilustrações como conteúdo central. Ornamentação discreta sem competir com leitura.

Preservar proporções e desenho dos masters. Não redesenhar o pato nem criar nova marca durante o reboot. O texto DND FAYSK.DEV das referências não substitui TDA.

O pacote v1.0 é um snapshot do código em 68e974c. Sua seção de extensões propostas não é implementação pronta. Evoluir o design system deliberadamente e validar nos dois temas.

## Componentes de base
Marca/cabeçalho, navegação, menu da conta, botões/links, tipografia, superfícies, cards de sessão, imagem com fallback, estados de carregamento/vazio/erro, campos e feedback quando necessários. Definir tokens por função para ambos os temas. Não criar um arquivo CSS inteiro por tela.

## Home
- Nome/identidade e apresentação curta da campanha.
- Última sessão publicada com título, arco, data, resumo curto, arte e ação de leitura.
- Sessões recentes e entrada para o arquivo.
- Lore temporária acessível quando seu conteúdo estiver publicado.
- Sem indicadores administrativos ou contagens que não ajudem a leitura.
- Conteúdo longo e ausência de arte tratados sem quebrar composição.

## Arquivo de sessões
Cards com hierarquia consistente; ordenação previsível; navegação para detalhes; paginação ou carregamento limitado conforme volume real. Busca/filtros só entram se definidos no aceite da primeira entrega, sem importar automaticamente a busca global futura.

## Página de sessão
Título, data, arco, arte e resumo completo. Largura confortável, hierarquia de títulos, links reconhecíveis e renderização segura. Preservar URLs existentes. Exibir acesso à transcrição conforme permissão, sem carregar dados privados no HTML público.

## Temas e dispositivos
Uma identidade em claro e escuro; preferência persistente, uso da preferência do sistema quando não houver escolha e ausência de flash indevido. Validar 320 px, celular comum, tablet e desktop amplo. No futuro grafo, painel lateral vira detalhe adaptado ao celular; não copiar três colunas comprimidas.

## Processo visual
1. Inventariar masters e componentes existentes.
2. Produzir composição da Home e sessão com conteúdo autorizado em claro/escuro e celular.
3. Registrar ajustes de composição com o proprietário.
4. Implementar componentes comuns e páginas.
5. Comparar capturas do Preview com as referências aprovadas.
6. Repetir o smoke visual no domínio após promoção.

## Aceite público
Home/arquivo/detalhe com dados reais aprovados; mobile sem overflow; arte sem deformação; teclado/foco, contraste, headings e alt text; links e URLs preservados; 404 e erros úteis; metadados/OG/favicon TDA; ausência de material privado em respostas públicas; conteúdo acessível com companion desligado. Build e CI verdes sozinhos não encerram R2.
