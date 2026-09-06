# Preservação dos dados, migração e recuperação

> Status: plano documentado; implementação pendente. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

## Regra
A reconstrução da aplicação não autoriza apagar dados. Manter fontes originais intactas até que a migração, a restauração e a nova operação estejam verificadas.

## Inventário obrigatório em R0
| Conjunto | Cobertura a levantar |
| --- | --- |
| Banco | Tabelas, linhas, PK/FK, índices, constraints, funções, permissões e migrations |
| Identidade | Usuários, associação à campanha, papéis, capacidades, OAuth e revogações |
| Conteúdo | Sessões, resumos, canon aprovado, rascunhos, revisões e proveniência |
| Transcrição | Original, revisões, segmentos, falantes, faixas, timestamps e versões |
| Arquivos | Áudio/ZIP/FLAC, imagens, documentos, músicas/referências e hashes |
| Storage remoto | Provider, bucket, chave, tamanho, visibilidade e links existentes |
| Operação local | SQLite/catálogos, jobs, artefatos, diretórios configurados e modelos |
| Publicação | URLs, slugs, IDs públicos, referências internas e redirecionamentos |

Inventário por provider/localização, com contagem, bytes, responsável, estratégia de cópia e lacunas. Segredos e conteúdo privado não são anexados ao repositório público. Credenciais entram por referência de configuração, nunca por valor.

## Backup verificável
Separar recuperação do site cloud e da operação local: dados necessários à web devem ser recuperáveis sem o PC; originais, modelos, configurações e trabalhos locais têm cópias e recuperação próprias. Não é obrigatório enviar todo áudio bruto para cloud. Resultado só é tratado como sincronizado após envio e reconciliação verificáveis.

1. Definir escopo e ponto de consistência do banco e arquivos.
2. Preservar cópia independente dos originais, com retenção e acesso definidos.
3. Gerar manifesto de arquivos (caminho lógico, bytes, hash) e relatório de banco.
4. Registrar itens faltantes ou inacessíveis; backup parcial não fecha o gate.
5. Restaurar em ambiente isolado.
6. Conferir PK/FK, contagens, hashes e amostras funcionais.
7. Registrar duração, evidência da restauração e responsável.

A existência de dump ou botão de backup não prova recuperação. Definir RPO/RTO com o proprietário em R0; ainda não há metas numéricas aprovadas.

## Estratégia preferida
Começar lendo dados existentes por contratos estreitos. Mudar esquema apenas quando a nova aplicação exigir e houver mapeamento claro. Preservar IDs/URLs ou fornecer tabela de equivalência e redirecionamentos.

Transformações são versionadas, idempotentes e testáveis com fixtures. Se dados legados não preencherem campos novos, registrar “origem não disponível” e uma ação de saneamento, sem inventar conteúdo.

Usar migrações aditivas antes de remover colunas/estruturas. Remover apenas quando não houver consumidores, existir backup restaurável e o período de compatibilidade tiver encerrado.

## Corte de dados
Escolher conforme fontes e volume: pequena janela de bloqueio de escrita com migração final, ou cópia inicial seguida de sincronização incremental verificada. Evitar duas aplicações escrevendo de forma independente nas mesmas regras editoriais.

O plano de corte registra: último checkpoint, gravações admitidas durante a troca, deduplicação, reconciliação, responsável, horário e condição de abortar.

## Reconciliação
- Mesmas sessões esperadas, com datas, IDs, títulos e relações preservados.
- Resumos e revisões preservados, salvo transformação explicitamente registrada.
- Segmentos e timestamps íntegros; diferenças justificadas por migração.
- Imagens/áudios localizáveis e hashes verificados.
- Contas e permissões equivalentes ou mudanças aprovadas individualmente.
- Nenhum material privado tornado público por valor padrão novo.
- Links antigos preservados ou redirecionados.

## Recuperação de incidente
Interromper novas escritas afetadas, registrar checkpoint e preservar evidências. Decidir rollback de código, correção adiante ou restauração de dados. Restaurar primeiro em isolamento, reconciliar alterações posteriores ao backup e só então reabrir escritas. Nunca restaurar cegamente sobre dados novos.

## Aceite
Inventário completo, cópia independente, restauração demonstrada, reconciliação sem perdas inexplicadas, recuperação ensaiada e identificação de quem executa. Todos estes itens estão pendentes; esta documentação não executou backup.
