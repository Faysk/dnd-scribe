> **Referência histórica — direção substituída em 2026-09-06.** O [reboot TDA](reboot/README.md) define o plano vigente. Este documento preserva decisões/evidências do escopo anterior; versões, fases e declarações de conclusão abaixo não certificam o estado do reboot. Revalidar requisitos antes de reutilizá-los.

# Política de remoção de legado

## Regra

Toda migração precisa terminar com deleção.

Não são aceitos como estado permanente:

- `legacy-*`;
- `*-old`;
- `*-v2` coexistindo com v1 sem prazo;
- rewrites para aplicação substituída;
- duas autenticações para a mesma pessoa;
- duas APIs com a mesma responsabilidade;
- duas fontes de tema/design tokens;
- dois package managers/lockfiles para o mesmo workspace;
- build manual concorrendo com `main`.

## Exceção temporária

Um adapter pode existir durante uma migração apenas quando:

1. há uma issue de remoção;
2. o dono e o consumidor estão identificados;
3. existe teste de compatibilidade;
4. há critério objetivo para apagá-lo;
5. a fase não é marcada concluída enquanto ele continuar necessário.

## Teste mental

Para qualquer responsabilidade, deve ser possível responder com uma frase:

> “Qual é a implementação oficial?”

Se a resposta for “depende” ou mencionar duas versões, a modernização ainda não terminou.
