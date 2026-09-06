# Stack e política de versões mais recentes

> Status: plano documentado; implementação pendente. Responsável: proprietário e implementador do TDA. Revisão: 2026-09-06.

## Requisito central
Toda tecnologia adotada ou atualizada deve usar a versão estável mais recente publicada oficialmente na data da decisão. Isso abrange linguagens, runtimes, frameworks, SDKs, bibliotecas, ferramentas de build/teste, drivers e serviços na medida em que suas versões sejam controláveis.

“Compatível” não é uma autorização silenciosa para usar versão antiga. Se a mais recente não funcionar, registrar o bloqueio, investigar alternativas e obter uma decisão explícita antes de aceitar exceção.

## Última estável não é sinônimo de última LTS
Uma versão estável mais nova pode existir fora da linha LTS. Não manter automaticamente uma LTS antiga por conveniência. Comparar a versão estável oficial com o suporte do hosting, da GPU e das dependências. Se a plataforma só aceitar uma versão anterior, a combinação não atende ao requisito sem decisão registrada.

Beta, RC, nightly e experimental ficam fora da proposta padrão. O usuário pode decidir incluí-las; registrar os riscos e os testes nesse caso.

## Seleção inicial: pendente de R0
| Camada | Candidato baseado no projeto existente | Verificação necessária |
| --- | --- | --- |
| Linguagem web | TypeScript | Release estável oficial, suporte do framework e ferramentas |
| Runtime web | Node.js | Release estável oficial e disponibilidade no hosting |
| Aplicação | Next.js + React | Releases oficiais e compatibilidade conjunta |
| Estilos | CSS + Tailwind, se justificar | Release oficial e aplicação dos tokens TDA |
| Dependências | pnpm com lockfile único | Versão oficial e instalação reproduzível |
| Banco/Auth/Storage | Supabase/PostgreSQL existentes | Versão oferecida pelo serviço e estratégia de atualização |
| Processamento local | Python + FastAPI + motor de transcrição existente | Últimas estáveis, instalação Windows, GPU e CPU |
| Instalador | Implementação a avaliar | SDK/runtime, upgrade e preservação de diretórios |
| Qualidade | Ferramentas de lint, tipos, unitários e navegador | Últimas estáveis com cobertura útil |
| Infraestrutura | Projeto web com Production e Preview | Suporte aos runtimes selecionados, limites e custos |

Nenhum número deste documento é uma versão atual certificada. Versões presentes no código ou nos ZIPs são snapshots, não escolhas automáticas para o reboot. Selecionar primeiro as necessidades, depois o menor conjunto de tecnologias que as atende.

## Registro obrigatório de versão
Usar [registro de versões](registros/versoes.md). Por componente:
- versão oficial mais recente e URL da release;
- data/hora UTC da consulta;
- versão escolhida e fixada;
- ambiente/provider que a suporta;
- resultado de instalação, tipos, testes e build;
- resultado do deploy Preview quando aplicável;
- incompatibilidade, responsável e próximo passo;
- decisão explícita se houver exceção.

Não usar `latest` flutuante como substituto da verificação. Versões exatas e lockfile preservam o build que passou; nova release entra como atualização explícita.

## Rotina a implementar
1. Consultar fontes oficiais ao iniciar cada fase e antes da promoção.
2. Configurar descoberta automática diária de atualizações, sem afirmar que ela já está ativa.
3. Abrir alterações temporárias, revisar changelog e breaking changes.
4. Executar validações proporcionais ao componente; para transcrição, incluir qualidade/tempo/memória.
5. Homologar em Preview e registrar a decisão.
6. Promover o código validado e remover a branch temporária após integração.
7. Se surgir versão nova durante a homologação, atualizar e repetir os gates afetados; adiar a adoção exige exceção explícita.

Patches/minors não são dispensados de validação. Majors não entram automaticamente. Nenhuma atualização de banco, driver ou modelo ocorre apenas porque o scanner encontrou uma versão nova.

## Serviços gerenciados
Registrar separadamente “última release upstream” e “última versão disponibilizada pelo provedor”. Não declarar conformidade com a mais recente quando o serviço ainda não a oferece. Avaliar aguardar, trocar a combinação tecnológica ou aprovar exceção; documentar a escolha.

## Aceite
Inventário completo de tecnologias, fontes e datas; nenhuma versão escolhida por memória; nenhum bloqueio oculto; instalação reproduzível; integração validada; mecanismo de atualizações testado e dono definido.
