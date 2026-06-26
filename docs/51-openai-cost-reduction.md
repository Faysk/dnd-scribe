# Etapa 51 - Reducao significativa de custo OpenAI

## Objetivo

Diminuir o custo da OpenAI antes de ligar a transcricao e a analise em volume. A regra de ouro agora e:

> Nada chama IA paga sem estimativa, cache e motivo claro.

O projeto ainda nao tem chamada OpenAI ativa no runtime publicado. A ingestao Craig atual extrai ZIP, identifica faixas e gera chunks locais. Isso e bom: podemos colocar o freio de custo antes de criar a primeira rotina paga.

## Fontes oficiais a conferir sempre

- Precos OpenAI: https://openai.com/api/pricing/
- Batch API: https://platform.openai.com/docs/guides/batch
- Prompt caching: https://platform.openai.com/docs/guides/prompt-caching

Os valores em dolar nao ficam fixos no repo publico. Quando formos executar jobs pagos, copiamos os precos atuais para config local/privada ou variaveis de ambiente.

## Estrategia de economia

1. Ingestao continua local e gratuita: unzip, ffprobe, chunk, manifest e mapeamento Craig.
2. Antes de transcrever, gerar uma estimativa por sessao: minutos de audio, chunks, faixas, possivel custo e limite de budget.
3. Transcrever por chunk, nao por sessao inteira.
4. Remover ou pular chunks silenciosos antes de chamar modelo.
5. Guardar hash SHA-256 de cada chunk e nunca retranscrever audio identico.
6. Usar modelo barato como padrao para transcricao, com modelo melhor apenas em trechos falhos/ruidosos/importantes.
7. Separar tarefas: transcricao, classificacao, canon, resumo e escrita final nao devem usar o mesmo modelo.
8. Classificacao e candidatos devem ir primeiro por heuristica/local ou modelo nano/barato.
9. Resumos e escrita narrativa usam modelo melhor so no material ja filtrado.
10. Jobs que podem esperar devem ir por Batch API quando o fluxo estiver pronto.

## Politica aplicada

Criado `config/ai_cost_policy.json` com:

- modo `economy_first`;
- modelo barato por padrao para transcricao;
- upgrade de qualidade apenas para chunks problemáticos;
- aprovacao explicita para modelo premium;
- limite por job e por mes;
- deduplicacao por hash;
- reuso de transcript;
- chunk padrao menor, de 5 minutos;
- estimativa obrigatoria antes de rodar.

## Mudanca de arquitetura

Antes:

```text
Audio grande -> IA -> transcript -> classificacao -> review
```

Agora:

```text
Audio Craig -> manifest local -> estimativa -> chunks filtrados -> cache/hash
            -> transcricao barata -> classificacao barata/local -> review DM
            -> upgrade pontual so onde precisar -> publicacao
```

## Como isso reduz custo

- Evita retranscrever o mesmo audio.
- Evita pagar por silencio.
- Evita mandar contexto gigante para classificacoes pequenas.
- Evita usar modelo caro para tarefas simples.
- Usa Batch para trabalho assíncrono.
- Mantem o DM decidindo quando qualidade extra vale dinheiro.

## Proximas 10 etapas

1. Criar estimador de custo por manifest Craig.
2. Exibir estimativa na aba Operacao antes de qualquer transcricao.
3. Adicionar hashes SHA-256 aos chunks gerados.
4. Criar tabela/cache de transcricoes por hash de audio.
5. Implementar detector simples de silencio/voz antes da transcricao.
6. Criar roteador de modelos baseado em `config/ai_cost_policy.json`.
7. Implementar transcricao economy-first em lote pequeno de teste.
8. Implementar retry/upgrade apenas para chunks com baixa confianca ou erro.
9. Criar ledger de custos estimados e reais por job/sessao/modelo.
10. Migrar classificacao/canon para Batch API quando o fluxo estiver estavel.

## Criterio de pronto

Considerar esta frente pronta quando uma sessao Craig real puder passar por:

```text
ingestao -> estimativa -> aprovacao -> transcricao com cache -> review -> relatorio de custo
```

sem chamar modelo caro por padrao e sem retranscrever chunks ja processados.
