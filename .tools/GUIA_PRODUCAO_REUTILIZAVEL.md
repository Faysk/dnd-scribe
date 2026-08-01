# Guia de producao reutilizavel - Dandi e Dragoes Kids

Data de referencia: 2026-07-10.

Este guia organiza a producao de musicas, videoclipes, Shorts, TikTok e Reels. A campanha original de D&D serve somente como referencia de historia. Todo material Kids, scripts, imagens, videos e documentos deve permanecer em `D:\Projects\Dandi e Dragoes`.

## Principio central

Cada informacao tem uma unica fonte de verdade:

| Informacao | Fonte |
|---|---|
| identidade dos personagens | `dandi_dragoes_pacote_canal_youtube` |
| ordem narrativa e prompt por cena | `docs/storyboard_linha_a_linha.csv` |
| inicio, fim e duracao real de cada cena | `docs/sync_linha_a_linha_whisper.csv` |
| arquivos realmente prontos ou faltando | `scripts/funk_quack_status.py` |
| clipes rejeitados preservados | pastas terminadas em `_revisar` |
| cortes sociais aprovados | `docs/cortes_short_funk_quack.csv` |
| ritmo, foco e transicoes por cena | `docs/edit_map_funk_quack.csv` |
| pulso musical e intensidade das batidas | `docs/beat_grid_funk_quack.csv` |

Nunca usar a duracao estimada do storyboard para montar o video. Para Funk Quack, ela soma 232,6 segundos, enquanto o audio real possui 277 segundos. A montagem deve sempre usar a timeline Whisper.

## Estado em um comando

Depois de iniciar ou reiniciar o PC:

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\funk_quack_status.py"
```

O relatorio mostra cobertura de imagens e videos nos dois formatos, IDs ausentes ou duplicados, arquivos em revisao e masters prontos.

Atalho nativo do Windows:

```powershell
& "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\funk_quack_pipeline.ps1" -Stage status
```

## Esteira padrao

1. Fechar letra e audio.
2. Transcrever e alinhar o audio para gerar a timeline real.
3. Criar storyboard por trecho com sujeito, acao, camera e movimento.
4. Gerar imagens em blocos e auditar identidade, ordem e leitura no celular.
5. Animar uma imagem por vez no ComfyUI, com prompt-enhance desligado.
6. Auditar cada clipe em 17%, 50% e 83% da duracao.
7. Preservar rejeitados em `_revisar`; nunca apagar material potencialmente reutilizavel.
8. Montar os masters animados usando a timeline real.
9. Gerar cortes sociais automaticamente.
10. Publicar variantes controladas e registrar resultados.

## ComfyUI seguro

O ComfyUI gera somente videos. As imagens finais continuam vindo da esteira de imagens.

Regras:

- um job por vez;
- fila pendente vazia enquanto a GPU processa;
- 5 segundos por clipe;
- prompt positivo proprio para cada linha;
- prompt-enhance desabilitado;
- audio interno do modelo descartado;
- nenhum clipe aprovado e sobrescrito sem backup;
- close de maos, pes ou objetos recebe prompt que proibe revelar rosto ou corpo novo.

Comando vertical:

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\comfy_ltx23_watch_strict.py" --orientation vertical --start-id 1 --end-id 147 --output-set prompt_direto_v4_sem_audio --poll-interval 15 --idle-interval 20
```

## Auditoria visual automatizada

Cada linha aparece em tres momentos na folha de contato. Isso detecta transformacoes tardias, texto aleatorio e mudanca de especie que um unico frame central pode esconder.

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\make_funk_quack_video_contact_sheets.py" --orientation vertical --start-id 70 --end-id 80
```

Checklist visual:

- personagem continua da mesma especie e com a mesma roupa;
- quantidade de personagens permanece estavel;
- rosto, maos, patas, asas e instrumentos nao se deformam;
- nenhum texto, letra, placa, legenda ou marca aparece;
- acao corresponde ao trecho da musica;
- enquadramento preserva a leitura 9:16 ou 16:9;
- inicio, meio e final do clipe continuam utilizaveis.

## Masters animados 4K

O montador trabalha em quadros inteiros a 30 fps. Para Funk Quack, sao 8.310 quadros e exatamente 277 segundos. Cada cena vira um segmento retomavel; uma interrupcao nao obriga a recomecar do zero.

O estilo padrao e `dynamic`, guiado por `docs/edit_map_funk_quack.csv`. O racional completo esta em `docs/PLANO_EDICAO_DINAMICA.md`. Use `--style clean` para gerar uma versao de controle com o mesmo sincronismo, sem os tratamentos adicionais.

Preflight:

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\build_funk_quack_animated_master.py" --orientation horizontal --validate-only
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\build_funk_quack_animated_master.py" --orientation vertical --validate-only
```

Render:

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\build_funk_quack_animated_master.py" --orientation horizontal
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\build_funk_quack_animated_master.py" --orientation vertical
```

O caminho preferencial usa `scale_cuda` para o upscale Lanczos e `h264_nvenc` para codificacao. Rodar os masters depois que o ComfyUI terminar, pois as duas etapas usam a mesma GPU. Se houver incompatibilidade, usar `--scaler cpu` ou `--encoder libx264`. O master horizontal sai em 3840x2160; o vertical em 2160x3840.

Quando os 147 videos dos dois formatos estiverem aprovados, o fechamento completo pode ser retomado com um comando. Ele verifica lacunas, confirma que o ComfyUI esta ocioso, gera folhas de contato, monta os dois masters dinamicos, cria os cortes sociais e mostra o status final:

```powershell
& "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\funk_quack_pipeline.ps1" -Stage finish
```

Politica de corte temporal:

- cenas lentas e fades usam o inicio do clipe;
- impactos e trechos menores que um segundo usam a parte central, onde a acao ja apareceu;
- trechos maiores que o clipe recebem hold do ultimo quadro;
- cortes permanecem secos e alinhados a musica, sem transicao generica cobrindo a batida.

## Pacote de cortes sociais

O plano atual possui 12 cortes de 8 a 55 segundos. Ele cobre apresentacao, desafio de danca, refrao, personagens, comedia, inclusao e final.

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\build_funk_quack_social_cuts.py" --validate-only
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\build_funk_quack_social_cuts.py"
```

O padrao de entrega social e 1080x1920, derivado do master 4K. Para preservar cortes em 4K:

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\build_funk_quack_social_cuts.py" --profile master4k
```

O YouTube aceita Shorts quadrados ou verticais de ate tres minutos. Mesmo assim, o pacote padrao fica abaixo de 60 segundos: facilita testes de retencao e evita o bloqueio descrito pelo YouTube para Shorts acima de um minuto que tenham uma reivindicacao ativa de Content ID. Referencias oficiais: [upload de Shorts](https://support.google.com/youtube/answer/12779649?hl=pt-BR) e [Shorts de tres minutos](https://support.google.com/youtube/answer/15424877?hl=pt-BR).

## Ideias de series recorrentes

O roadmap detalhado de conceitos, prioridades e adaptacoes da campanha esta em `docs/IDEIAS_PROXIMAS_CRIACOES.md`. Todas as propostas desse arquivo sao nao canonicas ate aprovacao.

### Portal da Cancao

Cada musica comeca com um portal diferente. Em 10 a 20 segundos, o portal abre, o personagem musical aparece e o primeiro som magico entra. Cria identidade para o canal sem repetir a mesma cena.

### Passinho do personagem

Um gesto simples por personagem: palmas do Dandi, volta do Cuthbert, coro dos fantasminhas, pose seria do Astel e falsa resistencia do Screaky. O gesto precisa funcionar sem instrucao falada e caber em loop de 8 a 15 segundos.

### Quem fez esse som?

Comeca com instrumento ou efeito em close; revela o personagem depois de dois ou tres segundos. Exemplos: alaude `plim-plim`, trompetao do fantasminha, risada do dragao e tamborzinho amarelo.

### Mini-historias do reino

Adaptar uma unica ideia da campanha para um arco Kids de 20 a 45 segundos: problema visual simples, tentativa divertida e resolucao musical. A campanha e referencia, mas a historia Kids precisa ser entendida sem conhecer o D&D original.

### Dandi chama, turma responde

Call and response com resposta corporal: Dandi chama, a turma responde com `quack`, palmas, giro ou luz. Esse formato combina musica, personagem e participacao sem depender de comentarios.

### Nao era bagunca

Transformar o final `nao era bagunca, era ensaio` em piada recorrente. Cada episodio mostra uma confusao diferente e termina com uma nova explicacao inocente.

## Formato recomendado para proximas musicas

Para reduzir custo sem perder variedade:

- produzir uma versao principal de 2min20 a 2min50, que tambem cabe inteira em Shorts;
- colocar um sinal visual forte no primeiro segundo;
- apresentar o hook musical nos primeiros 8 segundos;
- chegar ao primeiro refrao em ate 25 segundos;
- trabalhar com um heroi, um coadjuvante e o grupo completo apenas nos refroes;
- criar 50 a 70 clipes animados principais e transformar detalhes, reacoes, crops e reprises em cortes adicionais;
- reservar geracao exclusiva para hero shots, personagens novos e mudancas de cenario.

O projeto Funk Quack continua com 147 cenas porque ja foi concebido linha a linha. A reducao vale para novas producoes.

## Testes que realmente ensinam

Alterar uma variavel por publicacao:

| Teste | Manter igual | Variavel |
|---|---|---|
| estatico x animado | audio, corte, titulo e capa | movimento |
| 8 s x 15 s x 30 s | hook e abertura | duracao |
| limpo x karaoke | video e audio | legenda intencional |
| Dandi x grupo | trecho e duracao | primeiro frame |
| historia x passinho | personagem e identidade visual | estrutura |

Registrar no minimo: data, plataforma, variante, duracao, visualizacoes, retencao media, percentual assistido, repeticoes, compartilhamentos e salvamentos. Decidir a proxima rodada pelo conjunto, nao por uma unica visualizacao isolada.

## Organizacao para novas producoes

Manter o padrao atual em uma pasta por musica:

```text
producao_<slug>_linha_a_linha/
  audio/
  docs/
    storyboard_linha_a_linha.csv
    sync_linha_a_linha.csv
    cortes_sociais.csv
  imagens/
    brutas/16x9
    brutas/9x16
    finais_4k/16x9
    finais_4k/9x16
  videos_animados/
  videos/
  revisao/
    folhas_contato
  scripts/
```

Usar nomes imutaveis com ID de tres digitos. Versoes alternativas recebem sufixo, mas somente um arquivo por ID entra na pasta final canonica.

## Proximas automacoes

1. Gerar legendas karaoke a partir da timeline, respeitando safe areas de Shorts e TikTok.
2. Detectar texto acidental por OCR nos tres frames de auditoria.
3. Comparar primeiro frame do video com a imagem de origem para detectar entrada errada.
4. Gerar capas 16:9 e 9:16 a partir dos hero shots aprovados.
5. Importar resultados das plataformas para um CSV de experimentos e recomendar os proximos cortes.
