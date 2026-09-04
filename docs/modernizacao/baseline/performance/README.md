# Baseline técnico de performance do legado

Status: **protocolo fechado; medições autenticadas pendentes**  
Data de referência: **2026-09-04**

## Objetivo

Definir como medir o app legado antes da migração para que a comparação com o novo Next.js seja justa, reproduzível e útil.

Não buscamos um número isolado para exibir em README. O objetivo é ter um ponto de comparação confiável para detectar regressão durante a Fase 10.

## Limitação atual

As rotas relevantes do DnD Scribe dependem de autenticação e acesso à campanha. Ferramentas remotas sem a sessão real tendem a medir apenas login/redirect e, portanto, não representam Home, resumo ou transcrição.

Por isso o baseline oficial deve ser executado em um navegador autenticado real.

## Ambiente padrão

Registrar em cada execução:

```txt
data/hora local
commit/deployment de produção
URL e hash-route usados
navegador + versão
SO
perfil desktop/mobile
viewport
throttling
tema
usuário aprovado na campanha
```

### Perfis oficiais

Desktop:

```txt
viewport: 1920 × 1080 CSS px
zoom: 100%
Lighthouse: Desktop
```

Mobile:

```txt
viewport de referência: 390 × 844 CSS px
Lighthouse: Mobile
```

Quando Lighthouse usar emulação própria, registrar a configuração efetiva em vez de assumir que ela corresponde exatamente ao viewport acima.

## Regra de repetição

Executar **3 medições por cenário e perfil**, preferindo uma janela curta sem mudanças de deploy entre as execuções.

A métrica de referência é a **mediana**, não o melhor resultado.

Se houver variação anormal entre runs, executar mais duas medições e registrar a causa provável.

## Cenários obrigatórios

### P0 — Home autenticada

Fluxo:

```txt
abrir produção
sessão já autenticada
carregar #/
aguardar estabilização
```

Registrar:

- LCP;
- CLS;
- TBT em laboratório;
- Speed Index;
- FCP;
- bytes transferidos;
- JS transferido;
- CSS transferido;
- imagens transferidas;
- requests totais;
- requests da API;
- tempo até conteúdo principal utilizável.

### P1 — Sessão/transcrição longa

Sessão principal:

```txt
26 de agosto de 2026
O Olho que Devora a Floresta
```

Fluxo:

```txt
abrir a sessão no legado
aguardar hero + primeira página da transcrição
não rolar antes da primeira coleta
```

Registrar além das métricas comuns:

- tempo da primeira resposta de `/api/library-transcript`;
- tempo até as primeiras falas estarem legíveis;
- quantidade inicial de segmentos;
- memória do tab se a ferramenta disponibilizar;
- impacto do hero image.

### P2 — Busca na transcrição

Fluxo:

```txt
abrir sessão principal
aguardar primeira página
informar termo estável
aguardar resultado
```

Registrar:

- tempo entre submit/input estabilizado e resultado;
- request da API correspondente;
- quantidade de resultados;
- bloqueio perceptível da UI;
- event timing/INP se disponível.

O termo real usado deve ser salvo junto ao resultado para que a comparação futura use o mesmo filtro.

### P3 — Filtro por speaker

Fluxo:

```txt
abrir sessão principal
selecionar um speaker com presença conhecida
aguardar resultado
```

Registrar os mesmos dados de P2.

### P4 — Resumo longo

Fluxo:

```txt
abrir resumo da sessão principal
aguardar Markdown completo
```

Registrar:

- LCP;
- CLS;
- bytes de Markdown/API;
- tempo até conteúdo textual legível;
- custo de JS associado a `marked`/DOMPurify no legado.

## Métricas centrais

### Core Web Vitals

- **LCP** — laboratório e, futuramente, RUM quando disponível;
- **CLS** — laboratório;
- **INP** — preferir dado de interação real/RUM; Lighthouse pode não produzir INP representativo em todos os cenários.

### Proxy de laboratório

Quando INP não for possível:

- registrar **TBT**;
- registrar observação explícita de que TBT não é INP;
- não comparar TBT legado com INP novo como se fossem a mesma métrica.

### Peso

Registrar:

```txt
HTML
CSS
JS
fontes
imagens
API/XHR
outros
TOTAL
```

Também registrar quantidade de requests por classe.

## Formato dos resultados

Criar um diretório por data:

```txt
docs/modernizacao/baseline/performance/2026-09-04/
├── environment.md
├── desktop-home/
│   ├── run-1.json
│   ├── run-2.json
│   ├── run-3.json
│   └── summary.md
├── mobile-home/
│   └── ...
├── desktop-session/
│   └── ...
└── mobile-session/
    └── ...
```

Arquivos JSON do Lighthouse devem ser mantidos brutos. HTML report é opcional porque ocupa mais espaço e pode ser regenerado a partir de JSON conforme ferramenta/versão.

## Template de `summary.md`

```md
# Desktop — Home legado

Data:
Deployment:
Browser:
Lighthouse:
Tema:
Viewport/perfil:

| Métrica | Run 1 | Run 2 | Run 3 | Mediana |
| --- | ---: | ---: | ---: | ---: |
| LCP | | | | |
| CLS | | | | |
| TBT | | | | |
| FCP | | | | |
| Speed Index | | | | |
| Requests | | | | |
| Transfer bytes | | | | |
| JS bytes | | | | |
| Image bytes | | | | |

Observações:
```

## Baseline operacional da Vercel já observado

A auditoria não destrutiva confirmou chamadas de produção bem-sucedidas para:

```txt
GET /api/auth-config       200
GET /api/auth/me           200
GET /api/library-sessions  200
```

Esses logs confirmam o caminho operacional atual, mas **não substituem métricas de frontend** como LCP, CLS, INP/TBT ou bytes transferidos no browser.

## Interpretação futura

Na Fase 10 não devemos exigir que toda métrica do Next seja numericamente menor. A comparação deve responder:

1. houve regressão perceptível para o player?
2. houve aumento significativo de JS sem benefício?
3. imagens ficaram mais eficientes?
4. navegação e leitura melhoraram?
5. a transcrição continua responsiva em sessão longa?
6. o custo adicional, quando existir, tem justificativa clara?

## Gate da Fase 0

O protocolo está fechado, mas a Fase 0 só marca performance como concluída quando os resultados autenticados reais forem persistidos com pelo menos:

- [ ] Home desktop, 3 runs;
- [ ] Home mobile, 3 runs;
- [ ] sessão/transcrição longa desktop, 3 runs;
- [ ] sessão/transcrição longa mobile, 3 runs;
- [ ] busca/filtro representativos;
- [ ] resumo dos valores medianos;
- [ ] arquivos brutos da ferramenta.