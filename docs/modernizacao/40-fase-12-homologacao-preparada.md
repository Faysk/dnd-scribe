# 40 — Fase 12: Homologação preparada

Status: **PREPARAÇÃO CONCLUÍDA — execução real em standby pelo release candidate Vercel**  
Data: **2026-09-04**

## Objetivo deste bloco

Deixar a Fase 12 mecanicamente pronta para começar assim que existir um release candidate autenticável do Web Next.

Este documento não marca como aprovados cenários que ainda não foram exercitados com sessão real.

## Evidência de entrada já disponível

```txt
Web Next CI #71             ✅
CI legado #390              ✅
TypeScript strict           ✅
ESLint                      ✅
Vitest                      ✅
Next production build       ✅
client bundle audit         ✅
Playwright multi-browser    ✅
corpus real de sessões      ✅
produção legada preservada  ✅
```

A matriz automatizada cobre Desktop Chromium, Firefox, WebKit, Mobile Chromium e Mobile WebKit.

## Corpus fixo

A homologação não escolherá exemplos convenientes. Usará os casos registrados em `39-fase-11-corpus-homologacao.md`, incluindo:

```txt
rmDsxh640RR4
Svz6mvN0cBUk
craig-AdabEqbzngmT-stage1-full
craig-BIRq3nIWB4v9
manual-2026-07-05-20260705-sessao-000806
```

## Roteiro congelado

Assim que o RC existir, executar nesta ordem:

1. login Google;
2. logout;
3. login Discord;
4. restauração/refresh de sessão;
5. usuário aprovado;
6. usuário pending access quando disponível;
7. perfil/avatar/capabilities;
8. Home com acervo real;
9. `/sessoes` completo;
10. resumo mais recente;
11. resumo longo;
12. transcrição longa;
13. busca conhecida;
14. speaker filter conhecido;
15. busca + speaker;
16. clear filters;
17. cursor/progressive load;
18. fallback manual "Carregar mais";
19. download `.md`;
20. hash bridge real;
21. ID inexistente/erro não destrutivo;
22. dark/light;
23. 320px e mobile real quando disponível;
24. zoom 200%;
25. cookies HTTPS;
26. benchmark equivalente ao legado.

## Evidência por cenário

Para cada cenário registrar somente:

```txt
RC SHA
URL
browser/device
usuário/classe sem dado sensível
PASS | FAIL | BLOCKED
nota curta
screenshot apenas quando útil
issue quando houver regressão
```

Não copiar token, cookie, Authorization ou conteúdo privado desnecessário para issue pública.

## Critério de bug

```txt
critical/high → bloqueia cutover
medium        → corrigir ou aceitar explicitamente
low           → pode ir para estabilização
future        → roadmap posterior
```

## Benchmark

O benchmark deve repetir o protocolo já definido na Fase 10:

- três execuções por cenário;
- mediana;
- mesmas condições sempre que possível;
- legado e moderno autenticados;
- desktop e mobile;
- resultados brutos preservados.

Não usar a melhor execução como resultado.

## O que já está pronto sem Vercel

```txt
roteiro                         ✅
corpus                          ✅
matriz de browsers              ✅
checks automatizados            ✅
critérios de severidade         ✅
política de evidência           ✅
feature freeze                  ✅
plano de benchmark              ✅
plano de cutover rehearsal      ✅
```

## Standby externo

A execução humana/autenticada depende do candidato publicado com:

```txt
SHA verde atual
envs públicos do Supabase
DND_LEGACY_ORIGIN estável
redirect URL real do candidato
```

A URL do candidato é necessária para finalizar as allowlists de redirect/OAuth correspondentes. Por isso essa configuração fica acoplada ao mesmo gate de Preview/Homologação em standby.

## Gate

A preparação está concluída. A **Fase 12 não é declarada concluída** até o roteiro acima ser executado contra um RC real e receber aprovação explícita.
