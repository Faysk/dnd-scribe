# TDA — Tem Dado Aqui

> [!WARNING]
> **REPOSITÓRIO LEGADO — SOMENTE REFERÊNCIA**
>
> Este repositório está descontinuado e é mantido exclusivamente como referência histórica/técnica.
> **Não usar como base de desenvolvimento, não publicar a partir daqui e não realizar novas atualizações.**
>
> O projeto ativo e canônico é: **`Faysk/tda`**.

Site, arquivo e ferramentas da campanha de D&D.

## Status do repositório

Este código representa uma geração anterior do TDA e não faz mais parte do fluxo ativo de desenvolvimento ou produção.

- Não abrir novas features aqui.
- Não corrigir bugs aqui.
- Não usar esta `main` como produção.
- Não usar este repositório como fonte canônica para novas mudanças.
- Consultar apenas quando for necessário recuperar contexto, decisões ou implementações antigas.

Para qualquer trabalho novo, usar **`Faysk/tda`**.

## Histórico preservado

O conteúdo abaixo permanece apenas para registrar como este repositório funcionava antes de ser aposentado.

---

## Reboot — direção vigente na época

O proprietário definiu um reboot por entregas, preservando os dados: primeiro Home, sessões e resumos; depois Edit integrado e operação completa; novas funcionalidades por último.

**Site e Edit em cloud; transcrição pesada no PC.** Modernizar o companion e o fluxo local que já funciona. O site opera com o PC desligado sobre conteúdo sincronizado; novas transcrições dependem dele ligado. [Divisão e aceite](docs/reboot/registros/operacao-cloud.md).

- [Documentação e índice do reboot](docs/reboot/README.md)
- [Roadmap e critérios de aceite](docs/reboot/10-roadmap-e-aceite.md)
- [Política de versões mais recentes](docs/reboot/03-stack-e-atualizacoes.md)
- [Estado, riscos e decisões abertas](docs/reboot/11-estado-riscos-e-decisoes.md)

As seções abaixo descrevem a estrutura histórica e regras anteriores. A fundação web usa Node 24 por exceção aceita para hospedagem gratuita e mantém contêiner de produção. Migração de dados e publicação integrada continuavam pendentes; veja [operação da base](docs/reboot/registros/fundacao-web.md).

## Estrutura histórica

```text
apps/web/           frontend público Next.js desta geração legada
api/                APIs e jobs de backend
lib/                domínio/backend compartilhado
web/central-local/  Edit/operador temporário
web/assets/sessions/arte histórica das sessões
local-companion/    companion de processamento local
integrations/       integrações externas
supabase/           migrations e configuração de dados
docs/               documentação histórica
```

## Observação final

Se você chegou aqui para implementar algo novo no TDA: **pare aqui e use `Faysk/tda`.**
