# 18 — Riscos e Mitigações

## Risco 1 — Áudio ruim

Problema:

- microfone baixo;
- ruído;
- música alta;
- gente falando junto;
- queda do Discord.

Mitigação:

- Craig multitrack;
- OBS backup;
- teste antes;
- fone obrigatório;
- normalização com ffmpeg;
- revisão por timestamp.

## Risco 2 — IA inventar canon

Problema:

- alucinação;
- confundir piada com fato;
- transformar especulação em verdade.

Mitigação:

- IA só gera candidato;
- revisão humana;
- status explícito;
- fonte obrigatória;
- prompts rígidos.

## Risco 3 — Projeto ficar grande demais

Problema:

- tentar fazer wiki, bot, timeline, mapa, IA, clipes e foguete no mesmo sprint.

Mitigação:

- MVP focado;
- roadmap por fases;
- priorizar captura/transcrição/revisão;
- deixar firula para depois.

## Risco 4 — Custo de transcrição

Problema:

- sessões longas;
- múltiplas faixas;
- histórico grande.

Mitigação:

- processar só sessões novas no começo;
- comparar modelos;
- comprimir áudio;
- usar WhisperX local futuramente;
- guardar custo por sessão.

## Risco 5 — Privacidade

Problema:

- áudio bruto contém conversa pessoal;
- bastidores podem expor alguém;
- publicação acidental.

Mitigação:

- buckets privados;
- aprovação de bastidores;
- botão remover trecho;
- RLS;
- consentimento fixado;
- status privado por padrão.

## Risco 6 — Falha de captura

Problema:

- Craig não gravou;
- OBS travou;
- Roll20 não exportou.

Mitigação:

- múltiplas fontes;
- checklist;
- responsável da sessão;
- sync no início;
- verificação durante pausa.

## Risco 7 — Revisão continuar trabalhosa

Problema:

- IA gera candidato demais;
- muita coisa irrelevante.

Mitigação:

- ajustar thresholds;
- usar marcadores humanos;
- filtrar por tipo;
- priorizar trechos com Roll20/markers;
- melhorar prompts com feedback.

## Risco 8 — Dependência de um só fornecedor

Problema:

- OpenAI muda preço;
- Supabase limita storage;
- Vercel limita execução.

Mitigação:

- abstrair provider de transcrição;
- exportar dados;
- usar banco padrão Postgres;
- storage compatível com S3 futuramente;
- worker independente.

## Risco 9 — Roll20 bridge complicada

Problema:

- integração em tempo real pode ser chata.

Mitigação:

- MVP usa chat export;
- eventos estruturados no chat;
- bridge só depois.

## Risco 10 — Perder o tom da campanha

Problema:

- recap virar ata de reunião.

Mitigação:

- prompts com tom da campanha;
- versões diferentes: Mestre, Dandelion, público;
- humanos revisam estilo;
- preservar falas marcantes.
