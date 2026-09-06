# Qualidade, segurança e operação

> Status: plano documentado; implementação pendente. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

## Matriz de validação
| Área | Evidência requerida |
| --- | --- |
| Dependências | Fontes oficiais, versões registradas, lockfile e instalação limpa |
| Código | Tipos, lint e testes das regras/contratos afetados |
| Build | Build de produção e análise de saída/bundle |
| Público | Home, arquivo, resumo real, erros e links |
| Visual | Claro/escuro, mobile/desktop, textos extremos e arte |
| Acessibilidade | Teclado, foco, nomes, hierarquia, contraste e movimento reduzido |
| Auth | Visitante, permitido, negado, revogado e sessão expirada |
| Dados | Restauração, reconciliação e preservação da proveniência |
| Local | Instalação limpa, upgrade, GPU/CPU, interrupção e comparação de qualidade/desempenho com o fluxo atual |
| Fronteira local/cloud | Site/Edit com PC desligado sobre conteúdo sincronizado; transcrição com PC ligado, envio retomável e sem duplicação |
| Deploy | SHA/ref/ambiente, deployment terminal e smoke no domínio |

Testes devem provar comportamentos; não adicionar testes que apenas repetem constantes de implementação. Testes ignorados devem ter motivo e impacto explícitos.

## Segurança na fronteira de conteúdo
HTML/Markdown e anexos são dados não confiáveis. Sanitizar renderização, limitar protocolos de links, validar tamanho/tipo de uploads e não executar conteúdo enviado. Resumo público não autoriza transcrição pública. Evitar consultas excessivas que retornem dados privados ao cliente para depois esconder na interface.

## Autorização e banco
Inventariar RLS, políticas, roles e funções antes de migrar. Classificar tabelas em client-access, server-only e deny-by-default. RLS habilitado não prova uma política correta; ausência de política pode ser intencional. Chaves privilegiadas nunca entram em bundle/HTML/logs.

Testar acesso horizontal entre recursos e vertical entre capacidades. Rever segurança de conexões, certificados, SQL parametrizado, funções privilegiadas e armazenamento de credenciais como parte da implementação, sem tratar esse documento como auditoria concluída.

## Operação e observabilidade
Health público informa apenas metadados seguros de app/deploy; readiness não é prova de toda a campanha funcionando. Logs usam IDs de correlação e não gravam transcrição completa, tokens ou URLs assinadas. Jobs expõem etapa real, erro recuperável e ação seguinte.

Definir em R0/R1: responsável operacional, retenção de logs, destino de alertas, limites de uso e custos. Monitorar erros, latência, tráfego/egress e falhas de jobs. Alertas ficam como tarefa a configurar; nenhuma automação foi criada por esta documentação.

## Performance e custos
Usar paginação, payloads limitados e cache adequado à visibilidade. Não fazer polling agressivo sem limites/backoff. Medir Home, arquivo e resumo com corpus controlado e repetir em produção. Não transportar áudio/transcrição integral para a Home.

Definir budgets numéricos de bundle, latência, egress e processamento após baseline R0/R1; não inventar metas já aprovadas. Toda medição registra dispositivo/rede/dado/versão para permitir comparação.

## Evidência por entrega
Usar [template de evidência](templates/evidencia.md). Identificar SHA exato, ambiente, testes, contagens, skips, screenshots e limitações. “Código existe”, “CI passou”, “publicado” e “confirmado pelo usuário” são estados diferentes.

## Condições para não promover
Perda de dados inexplicada, exposição de conteúdo privado, auth inconsistente, falha de fluxo essencial, versão antiga sem decisão registrada, SHA desconhecido, ausência de recuperação praticável ou build Preview diferente estruturalmente do de produção.
