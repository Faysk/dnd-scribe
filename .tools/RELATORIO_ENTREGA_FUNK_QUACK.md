# Relatorio de entrega - Funk Quack do Dandi

Data: 2026-07-10

## Estado final

- Storyboard: 147 linhas.
- Imagens 16:9: 147 IDs completos. Existe uma copia extra conhecida do ID 078.
- Imagens 9:16: 147 IDs completos.
- Videos animados 16:9: 147 IDs completos.
- Videos animados 9:16: 147 IDs completos.
- Masters animados sincronizados: prontos nos dois formatos.
- Cortes sociais: 12 arquivos prontos.

## Masters

### Horizontal

- Arquivo: `videos/16x9/animado_sync/funk_quack_do_dandi_16x9_4k_animado_sync.mp4`
- Resolucao: 3840x2160.
- Frame rate: 30 fps.
- Duracao: 277,000 s.
- Video: H.264.
- Audio: AAC, presente e sincronizado com a timeline.
- Tamanho verificado: aproximadamente 3,24 GB.

### Vertical

- Arquivo: `videos/9x16/animado_sync/funk_quack_do_dandi_9x16_4k_animado_sync.mp4`
- Resolucao: 2160x3840.
- Frame rate: 30 fps.
- Duracao: 277,000 s.
- Video: H.264.
- Audio: AAC, presente e sincronizado com a timeline.
- Tamanho verificado: aproximadamente 3,14 GB.

Os masters 4K sao arquivos de edicao/arquivo. Os cortes sociais abaixo ja usam resolucao de entrega mais leve.

## Cortes sociais

Pasta: `videos/9x16/cortes_sociais_delivery1080`

Todos os 12 arquivos foram verificados em 1080x1920, com audio e sem arquivos temporarios pendentes:

1. `01_portal_da_cancao.mp4` - 20,47 s
2. `02_magia_pelo_ar.mp4` - 28,10 s
3. `03_desafio_bate_palma.mp4` - 15,60 s
4. `04_refrao_funk_quack.mp4` - 14,67 s
5. `05_som_ate_euclix.mp4` - 10,00 s
6. `06_ninguem_fica_pra_tras.mp4` - 11,00 s
7. `07_astel_screaky_resistem.mp4` - 16,57 s
8. `08_fantasminha_trompetao.mp4` - 16,13 s
9. `09_grande_final.mp4` - 30,33 s
10. `10_nao_era_bagunca.mp4` - 20,44 s
11. `11_aventura_final_55s.mp4` - 55,13 s
12. `12_quack_loop_8s.mp4` - 8,13 s

O plano editavel esta em `docs/cortes_short_funk_quack.csv`.

## Edicao aplicada

- Duracao de cada plano calculada pela timeline real da musica, em frames inteiros.
- Cortes secos usados como base para preservar leitura e ritmo.
- Apenas 11 transicoes especiais nas 147 cenas: flashes curtos, pausas em preto e brilho de portal.
- Enfase de camera e escala por secao, com mais energia nos refroes e desaceleracao no outro.
- Fade final aplicado ao encerramento.
- Mapa completo em `docs/edit_map_funk_quack.csv`.
- Grade de batidas em `docs/beat_grid_funk_quack.csv`.

## Auditoria visual

Foram geradas 25 folhas de contato para cada orientacao em:

- `revisao/folhas_contato/videos_horizontal`
- `revisao/folhas_contato/videos_vertical`

Os efeitos foram amostrados no instante de entrada e logo depois. Eles aparecem como acentos curtos e recuperam contraste e cor normais rapidamente.

Clipes verticais rejeitados foram preservados, nunca apagados, em `videos_animados_ltx23/9x16_720x1280_prompt_direto_v4_sem_audio_revisar`:

- IDs 002, 031, 035, 073, 131, 136, 138, 143 e 144.

Os arquivos canonicos desses IDs usam versoes estaveis e coerentes com as imagens originais.

## Automacao

Entrada principal: `scripts/funk_quack_pipeline.ps1`

Comandos uteis:

```powershell
& .\scripts\funk_quack_pipeline.ps1 -Stage status
& .\scripts\funk_quack_pipeline.ps1 -Stage preflight
& .\scripts\funk_quack_pipeline.ps1 -Stage finish
```

O preflight valida o plano social mesmo quando o master ainda nao existe. O `finish` exige os 147 videos nas duas orientacoes e o ComfyUI ocioso antes de renderizar.

## Proximos testes editoriais

- Publicar primeiro os cortes 01, 04, 09 e 12 como quatro tipos de gancho: historia, refrao, final coletivo e loop curto.
- Comparar retencao nos primeiros 1, 3 e 10 segundos.
- Produzir uma versao limpa dos masters com `--style clean` somente se o teste A/B justificar.
- Reaproveitar o mesmo fluxo para a proxima musica, mantendo prompts por cena e auditoria em folhas de contato.
