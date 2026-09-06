# Site em cloud, transcrição pesada no PC

> Status: direção esclarecida e aprovada; modernização local pendente. Responsável: proprietário e implementador. Revisão: 2026-09-06.

## Correção de escopo

“Site 100% em cloud” não significa mover a transcrição pesada para cloud. A interpretação anterior foi excessiva e está substituída por este registro. O proprietário confirmou que o processamento local é rápido e o fluxo atual funciona; a intenção é modernizar sua tecnologia, preservando essa capacidade.

| Parte | Destino e comportamento |
| --- | --- |
| Home, sessões, resumos, login e permissões | Cloud; disponíveis com o PC desligado |
| Edit, revisão e publicação de conteúdo sincronizado | Mesma aplicação cloud, sem segundo site/cadastro/editor |
| Dados necessários ao site | Banco/storage cloud, com visibilidade e recuperação independentes do PC |
| Transcrição pesada, modelos, GPU/CPU e arquivos de trabalho | PC/companion local; exige a máquina ligada para executar |
| Envio de resultados | Integração autenticada local -> cloud; retomável e sem duplicação |
| Migrações, saneamento e outros lotes auxiliares | Apoio local temporário quando útil |

O companion permanece como componente especializado do produto. Não será retirado por ser local nem substituído por worker cloud obrigatório. Apoio temporário a outras tarefas não deve ser confundido com essa capacidade permanente de transcrição local.

## Com o PC desligado

O site permite ler, revisar e publicar conteúdo que já está em cloud. Novas transcrições locais ficam indisponíveis ou aguardam o executor, com estado claro; não há promessa de processamento offline nem fallback pago automático em cloud. Resultados ainda não enviados e áudio somente local não são apresentados como conteúdo cloud pronto.

## Modernizar preservando o que funciona

Registrar a instalação, modelo, parâmetros, diretórios e integrações atuais como baseline. Levantar versões recentes de Python, motor, bibliotecas e componentes CPU/GPU, validar compatibilidade e atualizar em ambiente isolado. Preservar originais, configurações e resultados anteriores recuperáveis.

Comparar o mesmo corpus autorizado antes/depois: qualidade, falantes/timestamps, tempo, memória e estabilidade. Validar interrupção, retomada, cancelamento, reenvio e integração com o Edit. O funcionamento atual é confirmado pelo proprietário; a versão modernizada exige teste prático próprio. Não trocar motor ou reinventar o pipeline apenas por ser reboot.

## Dados, custo e encerramento

Dados necessários ao site ficam em cloud e têm recuperação independente do PC. Originais, modelos e trabalho pesado podem permanecer locais, com preservação e backup próprios. A política de áudio bruto cloud depende de necessidade, permissões e volume; esta decisão não exige upload de todo o acervo nem autoriza apagar fontes.

Gratuidade e a exceção [Node 24](node24-gratuito.md) continuam válidas. Não há requisito de contratar transcrição cloud. Build/deploy podem usar CI cloud e apoio WSL temporário; isso é separado do companion permanente de transcrição.

R4 exige duas provas: **site/Edit operando com o PC desligado** sobre conteúdo sincronizado; e **transcrição modernizada no PC ligado**, seguida de envio verificável e revisão/publicação cloud. A sequência Home/sessões/resumos -> Edit -> operação completa -> novas features permanece.
