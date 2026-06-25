# 35 — Roadmap das Proximas 10 Etapas

## Regra de documentacao

A partir daqui, cada etapa deve gerar:

```txt
docs/{numero}_resultado_etapa_{etapa}_{slug}.md
```

Cada documento de resultado precisa conter:

- objetivo;
- decisoes tomadas;
- arquivos criados/alterados;
- comandos usados;
- validacao;
- riscos/residuos;
- proximo passo recomendado.

## Etapa 12 — Auth e RLS

Objetivo: proteger dados por usuario/campanha usando Supabase Auth e Row Level Security.

Entregas:

- mapa `profiles.id` -> `auth.users.id`;
- funcoes SQL auxiliares para membership e DM;
- policies iniciais para leitura segura;
- plano de uso de service role apenas no backend/worker;
- smoke com perfis DM, player e convidado.

Validacao:

```txt
DM ve campanha/sessoes/fontes/publicacoes.
Player ve apenas o permitido.
Convidado nao ve fontes privadas.
Frontend segue sem service_role.
```

Critério de pronto:

```txt
consultas anonimas/cliente nao conseguem ler transcricao ou fonte privada sem permissao.
```

## Etapa 13 — Front real: UX de revisao

Objetivo: transformar o Review Board local em ferramenta confortavel para uso real do DM.

Entregas:

- persistencia local de rascunho por sessao;
- estados visuais de alterado/salvo;
- filtros melhores por candidato, personagem, tipo IA e pendencia;
- painel lateral de fontes;
- protecao contra aplicar decisao vazia por acidente.

Validacao:

```txt
DM revisa 5+ itens sem editar JSON manualmente.
Aplicar decisoes limpa fila local.
Nao ha overflow mobile/desktop.
```

Critério de pronto:

```txt
uma sessao real pode ser revisada pelo front sem depender de scripts diretos.
```

## Etapa 14 — Player de audio por timestamp

Objetivo: permitir conferir trecho transcrito ouvindo a fonte.

Entregas:

- endpoint para URL assinada R2 por arquivo;
- player no detalhe do segmento;
- pular para timestamp aproximado;
- fallback para transcript quando audio nao estiver disponivel;
- indicador de fonte/track.

Validacao:

```txt
clicar em segmento abre/toca audio da track correta.
URL assinada expira.
Nenhum bucket fica publico.
```

Critério de pronto:

```txt
DM consegue auditar uma fala por audio em ate 2 cliques.
```

## Etapa 15 — Criacao e gerenciamento de sessoes

Objetivo: sair da sessao fixa e permitir iniciar novas sessoes pela interface.

Entregas:

- tela de lista/detalhe de sessoes;
- criacao de sessao;
- edicao de titulo/data/arco/status;
- associacao de participantes esperados;
- status operacional por etapa.

Validacao:

```txt
nova sessao aparece no Supabase e no front.
sessao sem audio nao quebra o Review Board.
```

Critério de pronto:

```txt
DM cria uma sessao nova sem tocar no banco manualmente.
```

## Etapa 16 — Upload/Ingestao pelo front

Objetivo: importar ZIP Craig ou arquivos de sessao a partir da interface local.

Entregas:

- seletor/upload local para ZIP;
- execucao server-side de ingest;
- progresso por etapa;
- logs de erro amigaveis;
- link para pasta gerada.

Validacao:

```txt
ZIP real novo passa por ingestao local via front.
manifest/participants/chunks sao criados.
```

Critério de pronto:

```txt
um novo arquivo Craig entra no pipeline sem comando manual.
```

## Etapa 17 — Worker/queue local

Objetivo: tirar tarefas longas do request da interface.

Entregas:

- tabela/fila de jobs padronizada;
- worker local com loop;
- jobs para ingest, transcribe, classify, publish;
- retry simples;
- tela de monitoramento.

Validacao:

```txt
job falho aparece como failed.
retry funciona.
front nao trava durante processamento longo.
```

Critério de pronto:

```txt
transcricao/classificacao rodam como jobs, nao como acao bloqueante do front.
```

## Etapa 18 — Roll20 Logger integrado

Objetivo: trazer eventos de mesa para a timeline.

Entregas:

- consolidar script `!dnd`;
- parser de eventos;
- import para `roll20_events`;
- alinhamento aproximado por timestamp;
- visualizacao junto da transcricao.

Validacao:

```txt
comando !dnd scene/canon/secret vira evento no Supabase.
evento aparece na timeline.
```

Critério de pronto:

```txt
marcadores Roll20 ajudam a revisar uma sessao real.
```

## Etapa 19 — Discord/Craig operacional

Objetivo: reduzir atrito antes, durante e depois da sessao.

Entregas:

- checklist pre-sessao;
- registro de link/arquivo Craig;
- instrucoes de download do ZIP;
- mapeamento de nicks atualizado pela UI;
- deteccao de novos convidados.

Validacao:

```txt
novo nick entra como convidado pendente.
DM consegue revisar mapeamento antes da transcricao.
```

Critério de pronto:

```txt
captura de uma nova sessao tem menos passos manuais e menos risco de nick errado.
```

## Etapa 20 — Importacao de historico Markdown

Objetivo: trazer o historico antigo da campanha sem misturar com a pipeline de audio.

Entregas:

- inventario de arquivos `.md`;
- parser/importador conservador;
- status `historical_import`;
- vinculo com entidades/canon quando possivel;
- relatorio de conflitos/duvidas.

Validacao:

```txt
amostra de historico entra no banco.
nada vira canon novo sem revisao.
```

Critério de pronto:

```txt
historico antigo fica pesquisavel sem contaminar canon aprovado.
```

## Etapa 21 — Entidades e canon consolidado

Objetivo: transformar decisoes aprovadas em memoria navegavel da campanha.

Entregas:

- tela de entidades;
- relacao candidato -> entidade;
- canon entries consolidadas;
- timeline por personagem/local/item;
- musicas e performances vinculadas a sessoes/cenas;
- notas privadas por audiencia.

Validacao:

```txt
canon aprovado gera/atualiza entidade.
performance aprovada pode aparecer na memoria do personagem.
player ve apenas entidades permitidas.
DM ve visao completa.
```

Critério de pronto:

```txt
uma publicacao aprovada alimenta memoria estruturada da campanha.
```

## Ordem recomendada

```txt
12 Auth/RLS
13 UX de revisao
14 Audio por timestamp
15 Criacao de sessoes
16 Upload/Ingestao pelo front
17 Worker/queue local
18 Roll20 Logger integrado
19 Discord/Craig operacional
20 Historico Markdown
21 Entidades e canon consolidado
```

## Observacao

Se uma etapa revelar risco alto, ela pode ser quebrada em subetapas menores. A regra principal continua: validar com dado real, documentar o resultado e so entao avancar.
