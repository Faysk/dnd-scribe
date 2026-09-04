# 16 — Fase 0: runbook de captura do baseline

Status: **procedimento pronto para execução em navegador autenticado**  
Issue de controle: **#21**

## Objetivo

Transformar o último bloqueio da Fase 0 em um procedimento mecânico. Quem executar este runbook não precisa reinterpretar o roadmap ou decidir quais telas medir.

A produção legada deve permanecer inalterada durante a execução.

## Pré-condições

- usuário aprovado na campanha;
- produção em `https://dnd.faysk.dev` funcionando;
- zoom do navegador em 100%;
- DevTools/Lighthouse disponível;
- nenhuma extensão que altere layout/tema da página;
- sessão `O Olho que Devora a Floresta` acessível;
- branch/documentação da modernização já mergeada no `main`;
- não iniciar `apps/web` antes do fechamento do gate.

## Passo A — registrar ambiente

Criar uma nota de ambiente contendo:

```txt
data/hora
SO
resolução física
browser + versão
zoom
produção/deployment observado
tema do sistema
usuário com campaignRole aprovado
```

Não registrar access token, cookies ou qualquer segredo.

## Passo B — capturas desktop

Viewport alvo: **1920 × 1080 CSS px** quando possível.

Capturar na ordem:

1. Home dark;
2. Home light;
3. sessão/transcrição dark;
4. sessão/transcrição light;
5. resumo dark;
6. resumo light;
7. login dark;
8. login light;
9. acesso pendente, usando conta/estado apropriado quando disponível;
10. erro/retry representativo;
11. user menu aberto.

Para sessão/transcrição e resumo usar preferencialmente:

```txt
26 de agosto de 2026
O Olho que Devora a Floresta
```

### Regras

- não recortar conteúdo essencial;
- scrollbar pode permanecer;
- não esconder metadata real da sessão;
- não usar mock;
- não capturar concept art da Home futura;
- se não for possível produzir um estado sem alterar dados, registrar como `não capturado` e explicar.

## Passo C — capturas mobile

Viewport alvo: **390 × 844 CSS px**.

Capturar:

1. Home dark;
2. Home light;
3. sessão/transcrição dark;
4. sessão/transcrição light;
5. resumo dark;
6. resumo light;
7. login;
8. user menu aberto;
9. busca da transcrição com termo aplicado;
10. filtro de speaker aplicado.

Se o browser responsivo usar device emulado, registrar o device e DPR.

## Passo D — persistência das imagens

Destino preferido:

```txt
docs/modernizacao/baseline/visual/
```

A estrutura e o manifesto ficam em `baseline/visual/README.md`.

Depois de salvar cada arquivo:

```bash
sha256sum caminho/arquivo.png
```

ou equivalente no sistema operacional.

Registrar hash, dimensões e viewport no manifesto.

## Passo E — performance desktop

Abrir `baseline/performance/README.md` e seguir os cenários P0–P4.

No mínimo executar 3 vezes:

```txt
P0 Home autenticada
P1 sessão/transcrição longa
P2 busca
P3 speaker filter
P4 resumo longo
```

Para os cenários Lighthouse, guardar JSON bruto.

## Passo F — performance mobile

Repetir os cenários essenciais em perfil mobile:

```txt
P0 Home
P1 sessão/transcrição longa
```

Busca/filtro mobile devem pelo menos receber validação manual de responsividade, ainda que a medição de laboratório específica seja redundante.

## Passo G — mediana

Nunca escolher o run mais bonito.

Para cada métrica numérica:

```txt
run1
run2
run3
→ ordenar
→ valor do meio = baseline
```

Registrar qualquer outlier relevante.

## Passo H — atualização documental

Ao terminar:

1. atualizar `baseline/visual/README.md`;
2. adicionar pasta datada em `baseline/performance/`;
3. atualizar `11-fase-0-evidencias-e-checklist.md`;
4. atualizar `01-baseline-atual.md`;
5. atualizar o issue #21;
6. marcar Fase 0 como concluída no roadmap mestre;
7. somente então criar branch da Fase 3.

## Checklist de saída

- [ ] Home desktop dark persistida;
- [ ] Home desktop light persistida;
- [ ] sessão desktop dark persistida;
- [ ] sessão desktop light persistida;
- [ ] resumo desktop dark/light persistido;
- [ ] mobile essencial persistido;
- [ ] auth/pending documentado visualmente;
- [ ] 3 runs de Home desktop;
- [ ] 3 runs de Home mobile;
- [ ] 3 runs de sessão desktop;
- [ ] 3 runs de sessão mobile;
- [ ] busca/filtro medidos ou cronometrados de forma reproduzível;
- [ ] medianas documentadas;
- [ ] arquivos brutos persistidos;
- [ ] issue #21 fechado.

## Resultado esperado

Ao final deste runbook a frase abaixo deixa de ser uma intenção e vira um gate verificável:

```txt
FASE 0 = CONCLUÍDA
FASE 3 = LIBERADA
```
