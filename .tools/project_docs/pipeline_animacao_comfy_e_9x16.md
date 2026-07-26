# Pipeline Funk Quack - 9x16 e ComfyUI

Data de referencia: 2026-07-10.

## Estado atual

- Imagens finais 16x9: completas de 001 a 147 em `imagens/finais_4k/16x9`.
- Existe 1 imagem extra antiga no 16x9: `linha_078_funk_quack_1.png`. Ela nao deve entrar na sequencia canonica sem revisao.
- Imagens finais 9x16: completas de 001 a 147 em `imagens/finais_4k/9x16`.
- Videos animados 16x9: completos de 001 a 147 na pasta `16x9_1280x720_prompt_direto_v4_sem_audio`.
- Videos animados 9x16: geracao retomavel em andamento, sempre uma cena por vez.
- Video estatico sincronizado com audio: `videos/16x9/funk_quack_do_dandi_16x9_4k_sync.mp4`.
- Video estatico vertical sincronizado: `videos/9x16/funk_quack_do_dandi_9x16_4k_sync_nvenc.mp4`.
- Timeline de sincronismo: `docs/sync_linha_a_linha_whisper.csv`.
- Guia atual: `docs/GUIA_PRODUCAO_REUTILIZAVEL.md`.
- Estado real: executar `python scripts/funk_quack_status.py`.

## Separacao das duas esteiras

### Esteira A - imagens 9x16

Objetivo: continuar gerando imagens novas em formato vertical, seguindo a mesma qualidade e coerencia narrativa usada nas imagens 16x9.

- Geracao: feita pelo gerador de imagem do Codex, fora da GPU local.
- Nao usar ComfyUI para criar imagens 9x16.
- Fonte de verdade narrativa: `docs/storyboard_linha_a_linha.csv`.
- Referencias visuais: pacote do canal em `../dandi_dragoes_pacote_canal_youtube`.
- Referencia de continuidade por linha: imagem 16x9 correspondente ja aprovada.
- Imagem anterior 9x16 deve ser consultada para manter ritmo visual e continuidade.
- Saida bruta: `imagens/brutas/9x16`.
- Saida final: `imagens/finais_4k/9x16`.
- Resolucao final: `2160x3840`.
- Regra importante: a imagem 9x16 nao deve ser apenas crop da 16x9. Ela deve ser recomposta para celular, com personagens grandes e leitura clara.

Prompt base:

```text
Polished high-end 3D children's animation still for Dandi e Dragoes.
Keep Dandi consistent: cute white duckling bard, oversized blue eyes, orange beak, magenta velvet beret with feather, ornate magenta-and-gold bard outfit, decorated wooden lute/alaude with gold filigree.
Keep the baby dragon cute and friendly: blue-gray scales, orange wings, big expressive eyes, blue gem, non-scary.
Keep ghosts rounded, pastel, translucent, smiling, non-scary.
Keep Astel as a small red-haired elf/fantasy child in dark feathered outfit.
Keep Screaky as a red bird/kenku companion with red scarf and adventurer outfit.
Whimsical magical fantasy kingdom, warm gold, purple, turquoise, coral red, soft blue ghost glow.
Vertical 9:16 portrait composition, intended for Shorts/TikTok.
Characters should read large on a phone screen.
Stack action vertically: foreground, middle subject, upper magical movement.
Leave safe top and bottom margins for platform UI.
No text, no logo, no letters, no captions, no watermark, no scary tone, no adult club vibe, no weapons.
```

### Esteira B - videos pelo ComfyUI

Objetivo: transformar as imagens ja geradas em clipes animados curtos para teste de publico e edicao manual posterior.

- O ComfyUI e dedicado somente aos videos.
- Nao usar esta esteira para gerar ou substituir imagens finais.
- ComfyUI API: `http://127.0.0.1:8188`.
- Workflow API: `Confyui/video_ltx2_3_i2v (1).json`.
- Imagens de entrada atuais: `imagens/finais_4k/16x9`.
- Resolucao para clipes horizontais: `1280x720`.
- Duracao: `5` segundos. Nao mudar.
- FPS: `25`.
- O preset do workflow deve ser preservado.
- Alterar por linha apenas:
  - imagem de entrada;
  - prompt positivo;
  - nome de saida;
  - seed deterministica, se necessario para organizar lote.
- Saida sugerida: `videos_animados_ltx23/16x9_1280x720`.
- Logs sugeridos: `videos_animados_ltx23/logs`.
- Script de lote: `scripts/comfy_ltx23_batch.py`.
- Script de fila viva: `scripts/comfy_ltx23_watch.py`.
- Remake dos videos 16x9: usar a saida nova `videos_animados_ltx23/16x9_1280x720_prompt_direto_v4_sem_audio`.
- Motivo do remake: o node `320:328` do workflow estava com prompt-enhance ligado. O enhancer reescrevia o prompt por conta propria e podia injetar narrativa errada, como cena de mulher falando numa mesa com cafe. A correcao nos scripts forca `320:328 = false`, usando somente o prompt direto cena-a-cena criado a partir do storyboard.
- Nao apagar a pasta antiga `videos_animados_ltx23/16x9_1280x720`; ela fica como backup.
- Nao usar recuperacao de historico no remake limpo. A recuperacao pode copiar videos antigos do ComfyUI em vez de renderizar do zero.
- O MP4 final do remake deve ficar sem faixa de audio. O ComfyUI pode gerar audio interno, mas o script remove a faixa de audio ao baixar o resultado. O audio real da musica entra depois na edicao/sincronizacao.

Comando recomendado para manter o ComfyUI alimentado sempre que a fila ficar vazia:

```powershell
python "D:\Projects\Dandi e Dragoes\producao_funk_quack_linha_a_linha\scripts\comfy_ltx23_watch_strict.py" --orientation vertical --start-id 1 --end-id 147 --output-set prompt_direto_v4_sem_audio --poll-interval 15 --idle-interval 20
```

Esse vigia espera a fila do ComfyUI esvaziar antes de enviar o proximo job. Ele usa prompt direto por cena, prompt negativo estrito e preserva os clipes finais sem faixa de audio.

Observacao de resolucao:

- `1280x720` e horizontal 16x9.
- `720x1280` e vertical 9x16.
- Quando as imagens 9x16 estiverem completas, repetir a esteira B com entrada `imagens/finais_4k/9x16` e resolucao `720x1280`.

## Ordem segura de trabalho

1. Consultar `scripts/funk_quack_status.py` para descobrir a primeira lacuna real.
2. Rodar o watcher estrito em fila unica, um job por vez.
3. Revisar cada bloco vertical em tres pontos de cada video:
   - 055-076
   - 077-100
   - 101-113
   - 114-136
   - 137-147
4. Preservar videos rejeitados na pasta `_revisar` e colocar fallback ou nova tentativa na pasta canonica.
5. Depois dos 147 clipes, validar e montar os masters com `scripts/build_funk_quack_animated_master.py`.
6. Gerar as derivacoes sociais com `scripts/build_funk_quack_social_cuts.py`.

## Cuidados

- Nao rodar varios jobs de video simultaneos no ComfyUI com a RTX 4070 de 8 GB VRAM.
- A geracao de imagens 9x16 pode acontecer em paralelo porque usa outro servico.
- Nao sobrescrever imagens finais ja aprovadas sem fazer backup ou usar versao alternativa.
- Usar `docs/sync_linha_a_linha_whisper.csv` apenas para o video estatico sincronizado; os clipes do ComfyUI sao fontes de 5 segundos para edicao posterior.
