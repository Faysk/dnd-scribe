# ADR 011 — Compatibilidade de rotas hash legadas no cutover

Status: **Accepted**  
Data: **2026-09-04**

## Contexto

O app público legado usa hash routing:

```txt
/#/
/#/sessao/:sourceSessionId
/#/sessao/:sourceSessionId/resumo
```

A aplicação moderna usa rotas reais do App Router:

```txt
/
/sessoes
/sessoes/[id]
/sessoes/[id]/transcricao
```

Links antigos podem existir em:

- Discord;
- favoritos;
- histórico do navegador;
- documentação;
- mensagens da mesa.

O fragmento `#...` de uma URL não é enviado ao servidor em uma requisição HTTP. Portanto Vercel redirects, `next.config.ts`, Route Handlers ou Server Components não conseguem distinguir no servidor:

```txt
https://dnd.faysk.dev/#/sessao/ABC
```

de:

```txt
https://dnd.faysk.dev/
```

antes do JavaScript do browser ler `window.location.hash`.

## Decisão

Durante o cutover, o novo app terá uma bridge client-side mínima e temporária para reconhecer rotas hash conhecidas do legado e substituí-las pela URL moderna equivalente.

Mapeamento:

```txt
#/sessao/:id
→ /sessoes/:id/transcricao

#/sessao/:id/resumo
→ /sessoes/:id

#/ ou hash vazio
→ /
```

A bridge deve usar navegação equivalente a `replace`, evitando criar uma entrada adicional desnecessária no histórico.

## Localização

A bridge deve estar próxima do root do app moderno, mas isolada em Client Component pequeno.

Ela não deve transformar a aplicação inteira em Client Component.

Comportamento conceitual:

```txt
render root
→ client bridge inspeciona location.hash
→ hash legado reconhecido?
    sim → validar + replace para rota moderna
    não → não fazer nada
```

A implementação pode usar um script/Client Component antecipado se necessário para minimizar flash da Home antes do redirect.

## Validação

A bridge deve aceitar somente padrões conhecidos.

Não fazer:

```txt
window.location.href = conteúdo arbitrário do hash
```

O `sourceSessionId` deve ser tratado como segmento de rota e codificado/validado adequadamente.

Hashes desconhecidos não devem gerar redirect externo nem execução arbitrária.

## Consequências positivas

- links históricos continuam úteis;
- cutover não quebra mensagens antigas da campanha;
- não é necessário manter o hash router legado;
- compatibilidade fica isolada e removível;
- novas URLs ficam limpas.

## Custos

- pequeno Client Component temporário no root;
- possível flash de conteúdo se redirect só ocorrer após hidratação;
- precisa de testes específicos;
- precisa de critério futuro para remoção.

## Alternativas consideradas

### 1. Redirect server-side

Rejeitada porque fragmentos não chegam ao servidor.

### 2. Quebrar links antigos

Rejeitada. O DnD Scribe é um arquivo de memória; links históricos fazem parte da utilidade do acervo.

### 3. Manter hash routing no app novo

Rejeitada. Impediria aproveitar corretamente App Router, URLs semânticas, Server Components e navegação moderna.

### 4. Manter uma página legado separada indefinidamente

Rejeitada como estratégia principal. A compatibilidade necessária é pequena e pode ser resolvida sem carregar o frontend antigo inteiro.

## Testes obrigatórios

```txt
/#/sessao/ABC
→ /sessoes/ABC/transcricao

/#/sessao/ABC/resumo
→ /sessoes/ABC

/#/
→ /

/#/foo/bar
→ não redireciona para destino externo

ID com caracteres permitidos
→ codificação correta
```

Também validar:

- back/forward;
- refresh da URL moderna;
- ausência de loop;
- ausência de interferência em URLs modernas.

## Vida útil

A bridge deve sobreviver ao menos ao cutover e período de estabilização.

Sua remoção futura exige:

1. decisão explícita;
2. ausência de dependência operacional relevante;
3. registro no changelog/ADR se aplicável.

Não remover automaticamente no fim da modernização apenas por o frontend legado ter sido aposentado.

## Relação com o roadmap

A implementação entra na Fase 7 e é validada novamente nas Fases 11–14.

Este ADR não autoriza iniciar código antes dos gates anteriores.