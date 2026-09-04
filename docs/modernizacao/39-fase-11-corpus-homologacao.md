# 39 — Corpus real de homologação da Fase 11

Status: **PREPARADO**  
Data do levantamento: **2026-09-04**  
Campanha: `yuhara-main` / Mesa DnD Yuhara

## Objetivo

Fixar um conjunto pequeno e representativo de sessões reais para a paridade entre o app legado e o app Next.

O corpus evita homologar apenas o “happy path” ou escolher sessões diferentes a cada execução. Ele deve ser usado no mesmo estado de dados, com as mesmas consultas e as mesmas interações nos dois apps.

Este documento não substitui a matriz de paridade. Ele define **quais dados reais** devem alimentar a comparação.

## 1. Snapshot do acervo publicado

No levantamento de 2026-09-04, a campanha possui **11 sessões publicadas**.

| Data | `source_session_id` | Título | Resumo completo | Segmentos | Falantes | Duração |
| --- | --- | --- | ---: | ---: | ---: | ---: |
| 2026-08-26 | `rmDsxh640RR4` | O Olho que Devora a Floresta | 64.806 chars | 3.380 | 4 | 9.606.020 ms |
| 2026-08-19 | `YgbKlhBVrC3X` | Entre Canções e Raízes Corrompidas | 31.657 chars | 3.923 | 4 | 10.945.180 ms |
| 2026-08-15 | `Svz6mvN0cBUk` | O Gato Prometido e o Coração-Raiz | 24.887 chars | 6.169 | 5 | 19.742.540 ms |
| 2026-08-05 | `3y6TnJVTOlaK` | A Floresta Sem Norte e os Ecos do Passado | 15.109 chars | 3.088 | 4 | 8.440.720 ms |
| 2026-07-29 | `w3jzQJgzAkou` | Fogo Amigo, o Refúgio das Dríades e a Estrela que Não Era Estrela | 17.730 chars | 3.111 | 4 | 8.512.140 ms |
| 2026-07-25 | `AY2M6WBqKgq9` | A Tinta das Memórias | 26.493 chars | 3.275 | 4 | 19.830.140 ms |
| 2026-07-11 | `fqSsIl6c2HeV` | A Entrada Atrás da Cachoeira | 8.083 chars | 5.447 | 3 | 17.843.160 ms |
| 2026-07-04 | `manual-2026-07-05-20260705-sessao-000806` | O Caçador Marcado e o Covil dos Licantropos | 9.975 chars | 663 | 5 | 11.603.395 ms |
| 2026-07-01 | `manual-2026-07-01-20260701-sessao-235100` | O Retorno do Bardo e a Forja do Último Suspiro | 16.792 chars | 624 | 5 | 10.578.158 ms |
| 2026-06-27 | `craig-BIRq3nIWB4v9` | O Verde Esquisito e a Forja Impossível | 21.408 chars | 1.136 | 5 | `null` |
| 2026-06-24 | `craig-AdabEqbzngmT-stage1-full` | As Cabeças que Ainda Falam | 13.030 chars | 41 | 5 | 5.520.045 ms |

Todos os 11 registros publicados do snapshot possuem `coverImageUrl` e `heroImageUrl`.

Consequência importante: **não existe hoje um caso publicado real para fallback de arte**. O fallback continua coberto por testes determinísticos, mas não deve ser inventado como evidência de paridade com o corpus real.

## 2. Corpus mínimo obrigatório

### Caso A — sessão mais recente e resumo muito longo

```txt
source_session_id: rmDsxh640RR4
título: O Olho que Devora a Floresta
data: 2026-08-26
resumo completo: 64.806 chars
segmentos: 3.380
falantes: 4
```

Usar para:

- Home / sessão mais recente;
- ordenação do arquivo;
- hero e cover reais;
- recap muito longo;
- headings, listas e blockquotes em Markdown;
- navegação resumo → transcrição;
- métricas da sessão.

### Caso B — maior transcrição e stress de busca/filtro

```txt
source_session_id: Svz6mvN0cBUk
título: O Gato Prometido e o Coração-Raiz
data: 2026-08-15
segmentos: 6.169
falantes: 5
```

Distribuição de segmentos por falante no snapshot:

```txt
renanyuhara     2996
arutorux        1277
faysk           1024
sunnrq           859
gustavo199625     13
```

Termos úteis conhecidos no conteúdo bruto:

```txt
dandelion → 87 segmentos contendo o termo
gato      → 93 segmentos contendo o termo
fogo      → 20 segmentos contendo o termo
raiz      → 7 segmentos contendo o termo
```

Para `gato`, a distribuição bruta por falante é:

```txt
renanyuhara      48
faysk            28
arutorux         10
sunnrq            6
gustavo199625     1
```

Usar para:

- paginação/cursor;
- carregamento progressivo;
- busca;
- filtro por falante;
- busca + filtro combinados;
- limpar busca/filtro;
- download da transcrição;
- estabilidade em transcrição grande.

**Nota:** esses números são contagens diretas do banco (`ILIKE` em segmentos). Não devem ser transformados automaticamente em expectativa do `total` da API até o contrato legado e o Next serem executados lado a lado, porque a API pode aplicar normalização ou regras adicionais.

### Caso C — transcrição mínima / formato antigo

```txt
source_session_id: craig-AdabEqbzngmT-stage1-full
título: As Cabeças que Ainda Falam
data: 2026-06-24
segmentos: 41
falantes: 5
```

Distribuição:

```txt
Arthur     10
Fernanda   10
Renan      10
Yuhara     10
Random      1
```

Usar para:

- primeira página sem necessidade de paginação extensa;
- filtro que retorna apenas um segmento (`Random`);
- IDs históricos `craig-*`;
- comportamento de fim de lista;
- download pequeno.

### Caso D — duração ausente

```txt
source_session_id: craig-BIRq3nIWB4v9
título: O Verde Esquisito e a Forja Impossível
data: 2026-06-27
duration_ms: null
```

Usar para:

- formatter de duração ausente;
- layout sem quebrar quando uma métrica não existe;
- cards e detalhe com metadado incompleto.

### Caso E — ID longo/manual

```txt
source_session_id: manual-2026-07-05-20260705-sessao-000806
título: O Caçador Marcado e o Covil dos Licantropos
data: 2026-07-04
```

Usar para:

- encoding/decoding de rota;
- BFF com `source_session_id` longo;
- navegação direta;
- download e transcript endpoint com identificador não curto.

## 3. Markdown real existente

O snapshot das 11 sessões publicadas mostra:

```txt
headings    → presentes em todas
listas       → presentes em todas
blockquotes  → presentes na maioria
links        → nenhum caso real publicado
code fences  → nenhum caso real publicado
tabelas      → nenhum caso real publicado
```

Portanto a paridade visual com conteúdo real deve obrigatoriamente comparar:

- headings;
- parágrafos longos;
- listas;
- blockquotes;
- espaçamento vertical;
- largura de leitura;
- dark/light.

Links, code fences e tabelas permanecem responsabilidade de testes de sanitização/renderização enquanto não houver exemplo real publicado.

## 4. Consultas fixas de transcrição

A homologação deve repetir o mesmo conjunto de consultas nos dois apps.

### Consulta 1 — busca ampla em corpus grande

```txt
session: Svz6mvN0cBUk
q: gato
speaker: vazio
```

Validar:

- query refletida corretamente;
- resultados semanticamente equivalentes;
- total/cursor equivalentes entre legado e Next;
- nenhum resultado fora da sessão;
- limpar busca restaura estado padrão.

### Consulta 2 — busca + filtro

```txt
session: Svz6mvN0cBUk
q: gato
speaker: faysk
```

Validar:

- interseção dos filtros;
- contagem equivalente;
- cursor equivalente;
- chips/estado da UI equivalentes em significado.

### Consulta 3 — filtro mínimo

```txt
session: craig-AdabEqbzngmT-stage1-full
q: vazio
speaker: Random
```

O banco bruto possui um único segmento desse falante nesse snapshot.

Validar:

- um único resultado quando o contrato da API confirmar a mesma semântica;
- ausência de “carregar mais” indevido;
- estado de fim de lista.

### Consulta 4 — termo inexistente

```txt
session: Svz6mvN0cBUk
q: __dnd_scribe_paridade_sem_resultado__
```

Validar:

- estado vazio;
- ausência de erro técnico;
- limpar busca retorna a transcrição.

## 5. URLs obrigatórias por caso

Para cada sessão selecionada:

```txt
/sessoes/<source_session_id>
/sessoes/<source_session_id>/transcricao
```

Também validar bridge histórico em pelo menos um caso:

```txt
/#/sessao/<source_session_id>/resumo
→ /sessoes/<source_session_id>

/#/sessao/<source_session_id>
→ /sessoes/<source_session_id>/transcricao
```

A bridge sintética já pode ser coberta em E2E sem credenciais; a execução com uma sessão real confirma que o destino também resolve no ambiente autenticado.

## 6. Imagens reais

Todas as sessões publicadas do snapshot possuem cover e hero no bucket público de `session-images`.

Na homologação:

- não comparar URLs byte a byte se o pipeline de imagem do Next transformar a entrega;
- comparar identidade da arte, proporção, crop, alt e ausência de layout shift grosseiro;
- confirmar que a Home usa o artwork correto da sessão mais recente;
- confirmar que o detalhe usa hero/cover conforme a precedência definida no componente.

## 7. Regra de comparação

A paridade exigida é de **comportamento e informação**, não de DOM idêntico.

Para cada caso, registrar:

```txt
legado → resultado observado
Next   → resultado observado
status → PASS / FAIL / diferença deliberada
prova  → screenshot, response, trace ou anotação reproduzível
```

Diferenças deliberadas já esperadas pela modernização:

- resumo abre como página principal da sessão;
- transcrição é recurso secundário;
- URLs deixam de usar hash;
- composição visual é modernizada preservando a identidade editorial.

## 8. O que este corpus não prova sozinho

Mesmo usando dados reais, o corpus não substitui:

- Google OAuth real;
- Discord OAuth real;
- membership pendente/aprovada;
- refresh de sessão;
- capabilities;
- logout real;
- cookies HTTPS;
- dark/light em browser real;
- zoom 200%;
- benchmark legado x Next;
- falhas reais de upstream;
- cutover/rollback.

Esses itens continuam na matriz e nos planos das Fases 11–13.

## 9. Gate de preparação do corpus

```txt
sessão recente definida                    ✅
resumo longo definido                      ✅
transcrição grande definida                ✅
transcrição mínima definida                ✅
metadado incompleto definido               ✅
source_session_id longo definido           ✅
consultas de busca fixadas                 ✅
filtros de speaker fixados                 ✅
Markdown real inventariado                 ✅
hero/cover inventariados                   ✅
execução lado a lado legado x Next         ⬜
resultado incorporado à matriz             ⬜
```

O corpus está pronto para uso assim que um release candidate autenticável estiver disponível.
