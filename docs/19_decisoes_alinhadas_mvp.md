# 19 — Decisões Alinhadas do MVP

Este arquivo registra as decisões atuais do projeto após alinhamento inicial.

## Papel do DM

O DM é o guardião da lore e precisa ter acesso completo ao material da campanha.

Na prática:

- o DM pode ver diários pessoais, segredos, bastidores, transcrições e fontes;
- outros jogadores não veem diário pessoal de outro jogador;
- diário pessoal continua não sendo canon automaticamente;
- diário pessoal só entra em canon, recap ou consequência narrativa depois de validação do DM.

No modelo de permissões, `owner_only` significa:

```txt
visível para o dono entre jogadores
visível também para o DM/lore admin
não visível para outros jogadores
```

## Canon

O DM bate o martelo final sobre canon.

Jogadores podem propor canon, marcar o que entendem como canon do próprio personagem, revisar falas e intenções, pedir correções, sugerir interpretação, gancho ou bastidor.

O DM pode aprovar, rejeitar, alterar, manter a decisão sugerida, marcar como interpretação, canon privado, gancho ou retcon pendente.

## Bastidores

Bastidores ficam guardados, pesquisáveis e acessíveis, mas sempre marcados como bastidor.

Regra:

```txt
bastidor não é canon
bastidor deve ser claramente identificado
publicação externa, se existir no futuro, exige revisão/aprovação
```

## Áudio e Escopo Inicial

O MVP deve testar com áudio real do Craig.

Craig entrega um ZIP com faixas separadas em FLAC. O pipeline inicial deve:

1. localizar o ZIP;
2. listar faixas;
3. extrair para uma pasta temporária/processada;
4. identificar duração e metadados com `ffprobe`;
5. normalizar/splitar com `ffmpeg`;
6. preparar chunks para transcrição.

## Histórico Antigo

Não importar o histórico em Markdown agora.

Foco atual:

- próximas sessões;
- captura;
- automação do pipeline;
- transcrição;
- revisão;
- publicação.

Histórico antigo entra depois, quando o pipeline novo estiver estável.

## Roll20

Prefixo oficial:

```txt
!dnd
```

Marcador estruturado oficial:

```txt
[DND_EVENT]
```
