# ADR 007 — Feature freeze durante a modernização

Status: **Accepted**

## Contexto

O produto já tem uma visão clara de expansão futura: personagens, NPCs, lore extensa, galerias, itens, timeline e relações. Misturar essa expansão com a migração tecnológica aumentaria muito o risco e tornaria paridade difícil de medir.

## Decisão

Enquanto o roadmap de modernização estiver ativo, novas features de domínio ficam congeladas.

Exceções somente quando a mudança for necessária para:

1. paridade com o produto atual;
2. segurança;
3. estabilidade;
4. desbloquear diretamente uma fase da modernização.

## Fora do escopo explícito

- personagens;
- NPCs;
- lore editável;
- galerias;
- coleções;
- itens e companheiros;
- timeline;
- relações;
- grafo;
- busca global de entidades.

## Alternativas consideradas

- modernizar e expandir simultaneamente;
- adicionar as features futuras “aos poucos” durante cada tela migrada.

## Motivos

- reduzir variáveis;
- facilitar rollback;
- tornar testes de paridade objetivos;
- permitir avaliação clara do sucesso da modernização;
- impedir que bugs de feature sejam confundidos com bugs de migração.

## Consequências

Positivas:

- escopo controlado;
- prazo e risco mais previsíveis;
- base moderna chega à produção antes da expansão.

Custos:

- ideias novas precisam esperar;
- algumas estruturas serão preparadas para o futuro sem receber uso imediato.

## Liberação

O feature freeze termina somente quando o relatório final marcar explicitamente:

```txt
MODERNIZAÇÃO: COMPLETA
```
