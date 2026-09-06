# 64 — Proposta de arquitetura local-first

> **Histórico — direção substituída em 2026-09-06.** O destino final agora é [100% cloud com o PC desligado](reboot/registros/operacao-cloud.md), incluindo transcrição, dados e recuperação. Este documento preserva a proposta antiga; não define a arquitetura do reboot.

Status: proposta recomendada para a reformulação de 26/07/2026.

Implementação: pendente.

## Decisão em uma frase

O computador do operador processa e guarda o material pesado; a nuvem recebe
somente o catálogo da campanha e os resultados pequenos que precisam ser
compartilhados.

```txt
PC do operador
  ZIP Craig + FLAC + modelo Whisper + transcrição completa + jobs
                         |
                         | publicação explícita de resultados pequenos
                         v
dnd.faysk.dev + Supabase
  login + sessões + resumos + canon aprovado + páginas da campanha
```

Essa separação resolve os dois maiores custos:

- áudio e artefatos regeneráveis deixam de ocupar storage e consumir egress;
- transcrição usa GPU, CPU e disco já disponíveis no PC, sem pagar por minuto
  de áudio em uma API.

## Evidência já existente

O projeto `E:\Project\craig-to-text` já provou o caminho local:

- FastAPI em `127.0.0.1:8765`;
- `faster-whisper` com `large-v3-turbo`;
- CUDA `float16`;
- importação de ZIP Craig FLAC multitrack;
- uma fila local com um processamento pesado por vez;
- retomada segura sem alterar o ZIP original;
- faixas, JSON e Markdown gravados em disco.

A sessão Craig `AY2M6WBqKgq9`, de 25/07/2026, produziu:

- 574,78 MiB na pasta local da sessão;
- 1,51 GiB de modelo local reutilizável;
- uma transcrição final Markdown de aproximadamente 254 KiB;
- um resumo final de aproximadamente 27 KiB em
  `lore/03_sessoes/25-07-2026`.

O resultado demonstra a proporção que orienta a arquitetura: centenas de MiB
ficam locais e apenas dezenas ou centenas de KiB precisam virar publicação.

## O papel de cada ambiente

| Dado ou trabalho | PC local | Nuvem |
| --- | --- | --- |
| ZIP Craig original | fonte principal | não enviar |
| FLAC por participante | fonte principal | não enviar |
| modelo Whisper | cache local | não enviar |
| chunks, palavras e logs técnicos | local e regenerável | não enviar |
| transcrição completa | local por padrão | opcional, nunca carregada globalmente |
| revisão detalhada por timestamp | local | apenas trechos aprovados |
| título, data e estado da sessão | cache local | sim |
| resumo curto e completo aprovado | cache local | sim |
| canon, NPCs, itens e pontas abertas | cache local | sim |
| conteúdo privado do mestre | local ou nuvem com RLS específica | somente se necessário |
| autenticação dos jogadores | não | Supabase Auth |
| páginas da campanha | não | `dnd.faysk.dev` |

## A tela que usa a pasta local

Sim, é possível criar essa tela. Há duas formas diferentes.

### Forma recomendada agora: Central Local

A tela pesada é servida pelo próprio aplicativo local, por exemplo:

```txt
http://127.0.0.1:8765
```

Ela pode ter a mesma aparência e navegação do DnD Scribe, mas o backend Python
tem acesso controlado às pastas locais. O fluxo fica:

1. escolher uma pasta raiz, por exemplo `E:\DnD-Scribe`;
2. importar ou detectar o ZIP em `inbox`;
3. extrair e transcrever usando a GPU local;
4. revisar a transcrição e gerar resumo localmente;
5. clicar em `Publicar resultados`;
6. enviar apenas um pacote pequeno e aprovado ao site.

Essa é a opção mais estável, simples e segura para o objetivo imediato.

### Forma posterior: site conversando com o companheiro local

Quando `dnd.faysk.dev` for aberto no PC do operador, ele poderá tentar detectar
um serviço em `127.0.0.1` e mostrar:

```txt
Companheiro local: conectado
GPU: pronta
Pasta: E:\DnD-Scribe
Jobs: 1 em execução
```

Isso não deve ser a única forma de operar. A integração precisa considerar:

- permissão do navegador para acesso à rede local;
- CORS limitado exatamente a `https://dnd.faysk.dev`;
- serviço vinculado somente a `127.0.0.1`, nunca a `0.0.0.0`;
- segredo local curto e rotacionável;
- proteção contra CSRF;
- nenhuma rota que aceite caminho arbitrário fora da raiz configurada;
- nenhuma chave `service_role` entregue ao navegador.

O Chrome passou a exigir permissão de Local Network Access para sites públicos
acessarem destinos locais. Outros navegadores podem se comportar de outra
forma. Por isso a Central Local deve funcionar sozinha.

## O que acontece em outro computador

Outro computador não consegue usar automaticamente:

- a pasta `E:\...` do operador;
- a GPU do operador;
- o modelo Whisper instalado no operador;
- o serviço em `127.0.0.1` do operador.

`127.0.0.1` sempre significa “este computador”.

Há três cenários possíveis:

1. Jogador comum: usa apenas o site e vê o conteúdo publicado.
2. Outro operador: instala o companheiro local no próprio PC e usa os próprios
   recursos.
3. Acesso privado ao PC principal: futuramente, usar uma rede privada como
   Tailscale Serve, com controle de acesso. Não expor o FastAPI diretamente na
   internet e não usar Funnel como padrão.

Se alguém precisar mandar áudio do computador dela para o PC principal, os
bytes terão de atravessar alguma rede. Uma conexão privada direta evita guardar
o arquivo em storage de terceiros, mas não elimina o tempo de upload nem a
necessidade de autorização.

## Armazenamento local proposto

```txt
E:\DnD-Scribe\
  inbox\                         ZIPs ainda não importados
  sessions\
    2026-07-25__AY2M6WBqKgq9\
      source\                    ZIP original, somente leitura
      tracks\                    FLAC por participante
      transcripts\              JSON por faixa + transcript master
      review\                    correções e decisões
      publications\             resumo, canon e pacote de publicação
      session.json               manifesto pequeno
  models\                        cache do faster-whisper
  backups\                       cópia dos manifestos e publicações
  dnd-scribe.sqlite3             catálogo e fila local
```

Regras:

- nunca alterar o ZIP original;
- identificar conteúdo por hash, não só pelo nome;
- caminhos relativos ao diretório raiz;
- escrita atômica;
- artefatos regeneráveis marcados como descartáveis;
- backup obrigatório de manifesto, transcrição e publicações;
- áudio bruto pode ter retenção configurável, mas nenhuma remoção automática
  entra na primeira versão.

JSON já atende ao protótipo atual. SQLite passa a ser útil quando integrarmos
fila, histórico de tentativas, publicação idempotente e busca entre sessões.

## Contrato de publicação

A Central Local não deve sincronizar a pasta inteira. Ela gera um pacote
explícito, versionado e idempotente:

```json
{
  "schema_version": 1,
  "publication_id": "sha256-do-conteudo",
  "session": {
    "source_id": "AY2M6WBqKgq9",
    "played_at": "2026-07-25",
    "title": "a confirmar"
  },
  "recap": {
    "short": "texto aprovado",
    "full": "texto aprovado"
  },
  "approved_entries": [],
  "open_threads": [],
  "source_manifest": {
    "transcript_sha256": "hash",
    "local_only": true
  }
}
```

O endpoint na nuvem valida tamanho, versão, usuário, campanha e
`publication_id`. Reenviar o mesmo pacote não cria duplicatas.

## Papel do GPT

O GPT deixa de transcrever áudio. Ele recebe texto já produzido localmente e
executa tarefas de alto valor:

- sugerir três títulos para a sessão;
- separar a sessão em atos e cenas;
- gerar resumo curto e completo;
- listar NPCs, locais, itens e mudanças de estado;
- levantar pontas abertas;
- propor candidatos de canon;
- indicar incertezas com timestamps de evidência.

Fluxo econômico:

```txt
transcrição local
  -> blocos por cena ou janela de tempo
  -> extração estruturada por bloco
  -> consolidação final
  -> revisão humana
  -> publicação
```

Cada execução deve guardar:

- hash do texto de entrada;
- versão do prompt;
- modelo;
- parâmetros;
- uso e custo;
- resultado;
- decisão humana.

Se entrada, prompt e modelo não mudaram, o resultado é reutilizado. Para
trabalho assíncrono sem urgência, a Batch API pode ser avaliada; ela oferece
desconto, mas não é necessária para a primeira integração.

## Supabase depois da reformulação

Supabase continua útil, mas deixa de ser motor de processamento e depósito de
artefatos pesados.

Manter na nuvem:

- Auth e perfis;
- campanhas e membros;
- catálogo pequeno de sessões;
- publicações aprovadas;
- canon consolidado;
- permissões e auditoria de publicação.

Retirar do fluxo normal:

- polling de jobs locais;
- download de áudio pelo site;
- respostas com `input`, `output`, erro e steps completos;
- consultas globais de todas as sessões;
- recarga de campanha em `TOKEN_REFRESHED`;
- assinatura Realtime sem uma necessidade concreta.

O incidente anterior foi de egress, não de capacidade: 13,10 GB de 5 GB de
egress sem cache, com banco em aproximadamente 55,69 MB de 500 MB. Os
principais sinais foram consultas repetidas e payloads grandes. A primeira
proteção já aumentou o polling de 2,5 s para 30 s, limitou ciclos e reduziu o
payload medido em cerca de 63%, mas o desenho local-first elimina a própria
necessidade desse polling na nuvem.

## Orçamento técnico de nuvem

Metas iniciais, a validar com telemetria:

- zero áudio bruto servido por Supabase ou Vercel;
- zero polling de job local via Supabase;
- tela inicial comprimida até 50 KiB;
- detalhe publicado de sessão comprimido até 100 KiB;
- consultas sempre com colunas explícitas, filtro e limite;
- egress sem cache abaixo de 250 MiB/mês;
- alerta humano em 500 MiB e bloqueio de regressão em 1 GiB/mês;
- nenhuma tela baixa transcrição completa sem ação explícita.

Esses valores são guardrails de engenharia, não limites do provedor.

## Alternativas consideradas

### Tudo no navegador com acesso à pasta

`showDirectoryPicker()` permite escolher uma pasta após gesto do usuário, mas
não substitui o backend Python/CUDA e tem compatibilidade e permissões
dependentes do navegador. Pode ser um seletor conveniente no futuro, não a
base do processamento.

### Manter R2 para todo áudio

R2 pode continuar como backup opcional escolhido pelo operador. Não deve ser
requisito do fluxo normal, pois o objetivo agora é que o áudio não precise
subir nem descer da nuvem.

### Expor o PC publicamente

Rejeitado para o MVP. Aumenta superfície de ataque, exige disponibilidade da
máquina e transforma um aplicativo pessoal em serviço público.

### Migrar tudo para Supabase local

É possível, mas adiciona Docker, manutenção e complexidade desnecessária.
SQLite + arquivos cobrem o catálogo e a fila local; Supabase hospedado continua
somente no papel pequeno e compartilhável.

## Referências

- Supabase, gerenciamento de egress:
  https://supabase.com/docs/guides/platform/manage-your-usage/egress
- Chrome, Local Network Access:
  https://developer.chrome.com/blog/local-network-access
- MDN, `showDirectoryPicker()`:
  https://developer.mozilla.org/en-US/docs/Web/API/Window/showDirectoryPicker
- Tailscale Serve:
  https://tailscale.com/docs/features/tailscale-serve
- OpenAI Batch API:
  https://platform.openai.com/docs/api-reference/batch/object?api-mode=responses
