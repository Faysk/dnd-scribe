# Plano de edicao dinamica - Funk Quack

Data de referencia: 2026-07-10.

Objetivo: sincronizar os 147 clipes com a musica e acrescentar energia, foco e transicoes sem esconder os personagens ou transformar o video em uma sequencia de efeitos aleatorios.

## Regra principal

Corte seco no beat e o padrao. Efeito e pontuacao.

Se todos os cortes tiverem flash, zoom, giro e transicao, nenhum momento parece importante. O plano reserva os efeitos mais visiveis para entradas de refrão, portal, `tum-tum`, `Vai!`, piada final e fade-out.

O arquivo `docs/edit_map_funk_quack.csv` define o tratamento de cada linha. Ele e gerado por `scripts/make_funk_quack_edit_map.py` e consumido pelo montador 4K.

O audio tambem possui uma grade musical em `docs/beat_grid_funk_quack.csv`: aproximadamente 136 BPM, 619 pulsos e 154 compassos estimados. A timeline Whisper continua mandando na entrada das letras; a grade de beats serve para posicionar impactos e conferir se o efeito cai no pulso certo.

## Camadas da edicao

1. **Sincronismo:** cada cena ocupa exatamente os quadros definidos pela timeline Whisper.
2. **Selecao temporal:** o corte usa a parte do clipe onde a acao esta legivel.
3. **Ritmo:** impactos curtos usam uma aceleracao suave; pausas comicas e outro desaceleram.
4. **Enfase:** punch-in de 2% a 6% em palavras e batidas importantes.
5. **Cor:** refrões ganham um pouco de saturacao e contraste; outro fica mais macio.
6. **Transicao:** flashes ou dips aparecem apenas nos pontos estruturais.
7. **Texto opcional:** uma segunda versao pode usar letra intencional; o master limpo permanece sem texto.

## Gramatica por secao

| Secao | Corte e camera | Tratamento |
|---|---|---|
| intro falada | planos mais longos, portal e revelacoes | flashes curtos em `Atencao` e `todo mundo no quack` |
| intro cantada | alternancia de medio, aberto e detalhe | push suave, cor normal |
| versos | corte na entrada de cada frase | movimento moderado e variedade de planos |
| pre-refrao | palmas, pes, giro e alaude | cortes aceleram progressivamente |
| refrão | chamada e resposta em cortes secos | punch-in nos `quack`, cor mais viva |
| instrumental | instrumentos, notas e dragon flight | arcos, pans e cortes de detalhe |
| ponte | primeiro desacelera, depois cresce | portal, pausa comica e impacto no `tum-tum` |
| `Vai!` | quadro curtissimo de impacto | flash de um quadro e crop de 6% |
| verso 3 | nova sala, trompetao e voo | reentrada suave e crescimento continuo |
| refrão final | maior energia visual | cor mais viva, hero shots e impactos seletivos |
| outro | planos mais estaveis | movimento e cor diminuem gradualmente |
| fala final | close do Dandi | pausa, pequeno punch na piada |
| fade | ultimo quadro sustentado | fade de dois segundos para preto |

## Momentos de assinatura

- `00:00.392` - `Atencao, atencao`: flash curto e aproximação.
- `00:06.200` - Dandi chega: match cut do portal para o personagem.
- `01:23.560` - primeiro refrão: flash branco de tres quadros e corte para grupo.
- `01:38.200` - instrumental: troca de foco para instrumentos e notas.
- `02:36.706` - segundo refrão: repetir a assinatura com enquadramento diferente.
- `02:51.902` - ponte: reduzir energia e deixar o portal dominar o quadro.
- `02:52.128` - `Segura`: pausa visual antes do portal acelerar.
- `03:02.560` - `tum-tum`: impacto no tambor antes do payoff.
- `03:07.752` - `Vai!`: flash de um quadro e maior punch-in do video.
- `03:08.445` - verso 3: dip curto para apresentar o salao.
- `03:33.245` - refrão final: maior impacto de cor e grupo.
- `04:03.560` - outro: desacelerar e reduzir contraste de cortes.
- `04:16.560` - Dandi falando: segurar close e evitar efeitos concorrentes.
- `04:20.503` - `Era ensaio`: punch-in pequeno, sem flash.
- `04:31.585` - end card visual: sustentar e apagar suavemente.

## Transicoes que combinam

### Corte seco no beat

Usar em quase todas as trocas de linha. Ele preserva a precisão musical e funciona melhor que uma transicao longa nos `Funk quack` e `Quack quack`.

Os pequenos quadros de cabecalho do refrão funcionam como preparacao. O flash entra no primeiro `Funk quack` cantado: linha 036 no primeiro refrão, 078 no segundo e 115 no final. Esses pontos ficam a menos de 90 ms do pulso detectado.

### Flash luminoso

Um quadro branco e dois quadros de retorno para a imagem. Usar apenas em entradas de refrão, `Atencao`, `Vai!` e grandes impactos. Nunca criar uma sequencia de flashes repetidos.

### Portal glow

Entrada branca um pouco mais lenta, de quatro quadros, nas cenas em que o portal reaparece. O brilho da propria imagem faz a transicao parecer parte do mundo.

### Dip para preto

Tres a seis quadros apenas em mudanca real de ambiente: entrada do salao, outro e fala final. Nao usar entre falas do mesmo cenario.

### Match cut

Alinhar formas e direcoes entre duas imagens:

- portal circular para circulo de danca;
- boca do alaude para espiral de notas;
- palmas para patas/asas batendo;
- voo do dragao para arco luminoso;
- estrela para cristal azul.

O match cut pode ser apenas uma escolha de frames; nao precisa de plugin.

## Enfase e foco

- `Quack quack`: crop aproximado de 2% em closes e 3,5% em planos medios.
- entradas de refrão: crop de 4,5% a 5%.
- `Vai!`: crop de 6%, o maior do video.
- pausas de Astel e Screaky: desacelerar para 94% e evitar zoom forte.
- piada `Era ensaio`: crop de 3,5% depois da pausa.
- final: reduzir a velocidade para 88% e sustentar o ultimo quadro.

O foco permanece no centro porque as imagens finais ja foram compostas para cada formato. Nao usar rastreamento automatico que possa cortar chapeu, asas, alaude ou fantasmas nas bordas.

## Velocidade

Os clipes curtos de impacto usam de 112% a 128% da velocidade. Isso permite mostrar mais acao dentro de frases de 0,7 a 1,5 segundo. Arcos e giros ficam entre 104% e 110%. Pausas, outro e fade ficam entre 88% e 94%.

Nao aplicar speed ramp continuo em todo clipe. A mudanca de velocidade existe entre cenas e acompanha a estrutura musical.

## Cor e legibilidade

- versos: saturacao em torno de 102%;
- pre-refrao e instrumental: 105%;
- refrões: 108%;
- refrão final: 111%;
- outro: 97%, com contraste ligeiramente mais macio.

As mudancas sao pequenas porque as imagens ja sao coloridas. Saturacao excessiva estoura fantasmas, luzes magicas e pele dos personagens.

## Versao limpa e versao dinamica

Montagem principal dinamica:

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\build_funk_quack_animated_master.py" --orientation horizontal --style dynamic
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\build_funk_quack_animated_master.py" --orientation vertical --style dynamic
```

Versao de controle, sem tratamento adicional:

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\build_funk_quack_animated_master.py" --orientation vertical --style clean
```

A versao limpa serve para comparar se a edicao dinamica realmente aumenta retencao. Audio, timing e ordem permanecem iguais.

O montador usa CUDA e NVENC automaticamente quando disponiveis. Para testar ou refazer somente uma cena, sem montar o master inteiro:

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\build_funk_quack_animated_master.py" --orientation horizontal --style dynamic --only 036 --force
```

Para recalcular a grade de beats depois de trocar o audio:

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\analyze_funk_quack_beats.py"
```

## Legendas intencionais

Para Shorts, testar uma variante karaoke sem alterar o master:

- no maximo duas linhas;
- palavras grandes no centro seguro inferior, acima da interface da plataforma;
- destacar somente `Funk quack`, `Quack quack`, `Bate palma` e a piada final;
- usar contorno forte e cores associadas aos personagens;
- nunca cobrir olhos, bico, instrumento ou gesto de mao.

Texto gerado dentro das imagens ou pelo modelo continua sendo defeito. A legenda e aplicada depois, com fonte real e ortografia revisada.

## Criterio de qualidade

A edicao esta boa quando o espectador sente a batida mesmo sem audio, mas ainda consegue entender a historia e reconhecer os personagens. Se o efeito chama mais atencao que Dandi, ele deve ser reduzido.
