# 140 - Production monitoring console

Data: 2026-06-29

## Objetivo

Ter uma central tecnica no site para acompanhar saude, falhas, tokens,
consumo, storage e status operacional do projeto sem abrir codigo, Vercel,
Supabase ou Cloudflare.

## Primeira versao

A tela deve reunir:

- Vercel: ultimo deploy, ambiente, logs recentes com erro/warning/fatal.
- Supabase: conexao DB, Auth, tabelas principais, contagem de sessoes/jobs.
- Discord: bot token configurado, canal DnD legivel, webhook configurado.
- Roll20 bridge: token configurado, ultimo evento recebido, falhas recentes.
- R2: total armazenado, total por sessao, objetos brutos, objetos derivados.
- OpenAI: modelo configurado, custo estimado por sessao, gasto estimado por job.
- Pipeline: jobs pendentes, rodando, falhos, recuperaveis e concluidos.

## UX esperada

Resumo superior:

- `online`
- `atenção`
- `critico`
- `standby`

Cada card deve abrir detalhe com:

- ultima checagem;
- evidencias;
- erro bruto quando existir;
- proxima acao recomendada;
- link para area relacionada do site.

## Alertas iniciais

- Job falhou e tem etapa recuperavel.
- Sessao tem ZIP/FLAC bruto grande sem politica de limpeza.
- OpenAI estimado acima do limite definido.
- Discord sem conteudo visivel.
- Roll20 bridge sem evento recente durante janela ativa de sessao.
- R2 crescendo acima do esperado por sessao.

## Dados que devem aparecer sem vazar segredo

Pode mostrar:

- `configured: true/false`;
- ultimos 4 caracteres de IDs nao sensiveis;
- validade/expiracao quando existir;
- status HTTP;
- latencia;
- contagens.

Nao pode mostrar:

- tokens completos;
- service role;
- OpenAI key;
- Discord bot token;
- Roll20 bridge token.

## Proximas tarefas de implementacao

1. Expandir `lib/monitoring.js` com checks de Roll20 bridge e R2 por sessao.
2. Expor payload detalhado em `/api/monitoring?deep=1`.
3. Melhorar a aba Operacao para cards clicaveis.
4. Criar historico leve de snapshots em banco.
5. Criar severidade padronizada por check.

