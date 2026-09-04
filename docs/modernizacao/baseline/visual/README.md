# Golden baseline visual do legado

Status: **parcial — evidências desktop disponíveis, captura oficial ainda incompleta**  
Data de referência: **2026-09-04**

## Objetivo

Manter um inventário reproduzível das imagens reais do app legado usadas como referência durante a modernização.

Este diretório é o ponto canônico para o baseline visual. As imagens abaixo foram fornecidas durante o planejamento da modernização e correspondem ao `dnd.faysk.dev` legado autenticado. Neste momento o manifesto registra dimensões e hashes SHA-256; os binários ainda precisam ser persistidos no repositório ou em artefato durável antes do gate final da Fase 0.

> Imagens conceituais geradas para a Home futura não pertencem a este baseline.

## Evidências já disponíveis

| ID lógico | Tela | Tema | Dimensões do arquivo | SHA-256 | Estado |
| --- | --- | --- | ---: | --- | --- |
| `desktop-home-dark-primary` | Home | dark | 2048 × 1279 | `dbe7a0b797a242e091cada1cbf768f01a87f7b15f040d25c3eed875ea67bc27a` | capturada; binário ainda não persistido |
| `desktop-home-light-primary` | Home | light | 2048 × 1280 | `94ca24ec85eb8a6e6f4d5b92f76b0cfdca272b7260475534f5d3cb2753077fe0` | capturada; binário ainda não persistido |
| `desktop-session-transcript-dark` | sessão/transcrição | dark | 2047 × 1279 | `a8186a90e4f10acd6b614c77a164af9e92d490ad368c1e28009fb0b506488410` | capturada; binário ainda não persistido |
| `desktop-home-dark-secondary` | Home | dark | 1919 × 1079 | `91d4c0b6cc47a865b3a64a1b58a7746bb98872bdcff0cbdc3356879fb41f4cbd` | captura adicional; não é a principal |
| `desktop-home-light-secondary` | Home | light | 1919 × 1079 | `031fc9a6ce0798544d090210588bb13573583fcfae6c4313454c66e674d33475` | captura adicional; não é a principal |

Os hashes acima permitem verificar posteriormente que o arquivo persistido é exatamente a evidência usada durante o planejamento, sem depender do nome temporário do upload.

## Convenção final de arquivos

Quando os binários forem persistidos, normalizar para:

```txt
docs/modernizacao/baseline/visual/
├── desktop/
│   ├── dark/
│   │   ├── home.png
│   │   ├── session-transcript.png
│   │   ├── session-summary.png
│   │   ├── login.png
│   │   ├── pending-access.png
│   │   ├── error-retry.png
│   │   └── user-menu.png
│   └── light/
│       └── ...
└── mobile/
    ├── dark/
    │   └── ...
    └── light/
        └── ...
```

Arquivos finais podem ser PNG, WebP lossless ou outro formato sem perda visual relevante, desde que a escolha seja única para o conjunto e o manifesto registre o hash final.

## Regras de captura

- capturar a produção legada, não um Preview;
- não alterar CSS, conteúdo ou configuração antes da captura;
- esconder apenas dados realmente sensíveis, se houver;
- manter zoom do navegador em 100%;
- registrar viewport CSS separadamente da resolução do screenshot;
- registrar navegador/versão;
- usar a mesma sessão real de referência quando possível;
- não recortar elementos só para a imagem ficar mais bonita;
- preservar scrollbar quando ela fizer parte da composição real da tela.

## Viewports oficiais futuros

```txt
desktop: 1920 × 1080 CSS px
mobile: 390 × 844 CSS px
```

As capturas já fornecidas incluem chrome do navegador e não devem ser tratadas como prova do viewport CSS exato.

## Sessão de referência

Principal:

```txt
26 de agosto de 2026
O Olho que Devora a Floresta
```

Ela possui capa, hero, resumo, transcrição longa e metadata suficiente para exercitar praticamente todo o reader legado.

## Pendências do baseline visual

### Desktop

- [x] Home dark — evidência disponível;
- [x] Home light — evidência disponível;
- [x] sessão/transcrição dark — evidência disponível;
- [ ] sessão/transcrição light;
- [ ] resumo dark;
- [ ] resumo light;
- [ ] login dark;
- [ ] login light;
- [ ] acesso pendente;
- [ ] erro/retry;
- [ ] user menu aberto.

### Mobile

- [ ] Home dark;
- [ ] Home light;
- [ ] sessão/transcrição dark;
- [ ] sessão/transcrição light;
- [ ] resumo dark;
- [ ] resumo light;
- [ ] login;
- [ ] user menu;
- [ ] busca/filtro em uso.

## Gate

As três capturas desktop já disponíveis reduzem o risco de perda da identidade visual, mas **não encerram a Fase 0**. O gate exige persistência durável das evidências essenciais e cobertura mobile/auth mínima.