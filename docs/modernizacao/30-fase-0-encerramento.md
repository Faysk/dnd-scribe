# 30 — Encerramento da Fase 0

Status: **CONCLUÍDA**  
Data: **2026-09-04**  
Issue de controle: **#21**

## Decisão de encerramento

A Fase 0 é considerada concluída após autorização explícita do owner para avançar à implementação.

O encerramento não significa que todas as evidências inicialmente desejadas foram coletadas. Ele significa que o risco restante foi classificado e movido para fases posteriores sem perder o requisito.

## O que foi congelado

Antes do bootstrap foram documentados e auditados:

- frontend público legado;
- hash routing atual;
- contratos de auth;
- estados anonymous / pending access / authorized;
- endpoints consumidos pelo player;
- contrato da biblioteca de sessões;
- resumo e Markdown;
- transcrição, cursor, busca, speaker filter, progressive loading e download;
- temas dark/light/system;
- identidade visual e tokens atuais;
- build legado;
- topologia Vercel;
- fronteira Supabase;
- local-first;
- feature freeze;
- estratégia de coexistência;
- estratégia de cutover e origem legada estável.

## Evidência visual

Existem referências desktop reais do legado para Home dark/light e reader/transcrição.

A matriz originalmente pedia ainda cobertura completa de:

- mobile;
- login;
- pending access;
- erro/retry;
- resumo em ambos os temas;
- outros estados interativos.

Esses itens **não foram descartados**.

Foram reclassificados para:

```txt
Fase 5  → auth/shell + regressão visual de login/pending/menu
Fase 11 → paridade visual completa desktop/mobile dark/light
```

O novo app não pode chegar ao cutover sem essa cobertura.

## Performance

O baseline quantitativo completo do legado inicialmente previsto na Fase 0 também permanece obrigatório.

Ele foi movido para a Fase 10, onde haverá comparação reproduzível entre legado e Next antes do cutover.

A Fase 10 deve registrar, no mínimo:

- LCP;
- CLS;
- INP quando mensurável e TBT como proxy de laboratório quando necessário;
- JS transferido;
- requests;
- bytes de imagens;
- primeira renderização;
- Home autenticada;
- transcrição longa;
- busca/filtro.

Sem essa medição e sem análise de regressão crítica, a Fase 10 não encerra.

## Justificativa

O objetivo do baseline é impedir regressões silenciosas, não produzir documentação por documentação.

Neste ponto:

- o comportamento estrutural está suficientemente documentado;
- o legado permanece em produção e disponível para comparação durante toda a migração;
- o novo app nasce em paralelo, sem cutover;
- regressão visual e performance continuam com gates explícitos antes da produção.

Portanto, bloquear o bootstrap apenas pela ausência das últimas capturas não reduz materialmente o risco, desde que essas obrigações permaneçam no roadmap.

## Gate da Fase 0

```txt
Auditoria de código/contratos      ✅
Arquitetura e fronteiras           ✅
Feature freeze                     ✅
Referências visuais principais     ✅ parcial suficiente para bootstrap
Cobertura visual total             → Fases 5 e 11
Performance quantitativa           → Fase 10
Autorização do owner               ✅
Issue #21                          ✅ fechado
```

Resultado:

```txt
FASE 0 = CONCLUÍDA
FASE 1 = CONCLUÍDA
FASE 2 = CONCLUÍDA
FASE 3 = LIBERADA / EM EXECUÇÃO
```

## Regra de segurança

Este encerramento **não** permite remover o legado, mover `dnd.faysk.dev` ou relaxar os gates das Fases 10–13.

A produção atual continua sendo a referência até homologação, paridade e cutover formal.
