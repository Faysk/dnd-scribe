# Funk Quack do Dandi - Producao Linha a Linha

Este pacote concentra a versao dinamica do video, com uma imagem por linha/beat da musica.

## Estrutura

- `docs/storyboard_linha_a_linha.csv`: storyboard completo com 147 beats.
- `docs/plano_geracao_4k.md`: estrategia de geracao em lotes e formatos.
- `imagens/brutas/16x9`: imagens horizontais brutas geradas pela IA.
- `imagens/brutas/9x16`: imagens verticais brutas geradas pela IA.
- `imagens/finais_4k/16x9`: exports finais para YouTube em 3840x2160.
- `imagens/finais_4k/9x16`: exports finais para Shorts/TikTok em 2160x3840.
- `imagens/alternativas`: imagens boas que nao entraram na sequencia principal.
- `revisao/folhas_contato`: folhas de contato por lote para revisar ordem e coerencia.

## Referencias

As referencias principais dos personagens ficam em:

`../dandi_dragoes_pacote_canal_youtube`

Personagens nomeados:

- Dandi: pato bardo branco com boina magenta e alaude.
- Astel: amigo de cabelo vermelho com capa de penas escuras.
- Hugin: corvo preto/roxo de Astel.
- Screaky: passaro vermelho com cachecol.
- Cuthbert: dragaozinho cinza-azulado com cristal azul.

Fantasminhas ainda sem nome: usar por cor/funcao por enquanto, como fantasminha azul/lilas, verde, roxo e amarelo do tamborzinho.

## Documentacao principal

- `docs/GUIA_PRODUCAO_REUTILIZAVEL.md`: esteira completa, auditoria, masters, cortes e ideias para proximas musicas.
- `docs/IDEIAS_PROXIMAS_CRIACOES.md`: roadmap nao canonico de musicas e series Kids.
- `docs/PLANO_EDICAO_DINAMICA.md`: gramatica de cortes, focos, velocidade, cor e transicoes.
- `docs/edit_map_funk_quack.csv`: tratamento exato das 147 cenas.
- `docs/beat_grid_funk_quack.csv`: grade de 136 BPM extraida do audio para impactos e cortes.
- `docs/cortes_short_funk_quack.csv`: plano de 12 cortes sociais sincronizados.
- `scripts/funk_quack_status.py`: relatorio de cobertura e ponto exato de retomada.
- `scripts/funk_quack_pipeline.ps1`: entrada unica nativa do Windows para status, watcher, QA, preflight e fechamento.

## Status Atual

- Imagens finais 16x9: completas de 001 a 147. Existe uma alternativa extra para a linha 078.
- Imagens finais 9x16: completas de 001 a 147.
- Videos animados 16x9: completos de 001 a 147.
- Videos animados 9x16: geracao retomavel em andamento, uma cena por vez.
- Masters estaticos sincronizados 16x9 e 9x16: prontos, ambos com 277 segundos.
- Masters animados 4K: gerados pelos scripts depois que os 147 clipes de cada formato passam na auditoria.

Consultar o estado real, sem depender deste texto:

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\funk_quack_status.py"
```
