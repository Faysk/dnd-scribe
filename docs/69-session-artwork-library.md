# Artes das sessões

## Objetivo

Manter capa e destaque de cada sessão com URLs públicas estáveis, sem publicar
os PNG originais pesados no build de produção.

## Organização

- originais verticais:
  `lore/06_referencias_visuais/sessoes/verticais`;
- originais horizontais:
  `lore/06_referencias_visuais/sessoes/horizontais`;
- relação entre sessão, data e arquivos:
  `config/session_artwork.json`;
- arquivos públicos:
  `web/assets/sessions/AAAA-MM-DD/card.webp` e
  `web/assets/sessions/AAAA-MM-DD/hero.webp`.

Os originais ficam no lore local. Somente as versões WebP otimizadas entram no
GitHub e no deploy.

## Preparação

Com Pillow instalado:

```powershell
python tools/prepare_session_artwork.py
```

O script:

1. valida a existência dos dois originais;
2. corrige orientação EXIF;
3. limita a capa a 900 × 1350;
4. limita o destaque a 1800 × 1013;
5. gera WebP com qualidade 88 usando troca atômica;
6. informa tamanho original, tamanho público e redução total.

## Publicação

Para cada entrada do manifesto, gravar no `metadata` da sessão:

```text
coverImageUrl = https://dnd.faysk.dev/assets/sessions/AAAA-MM-DD/card.webp
heroImageUrl  = https://dnd.faysk.dev/assets/sessions/AAAA-MM-DD/hero.webp
```

O vínculo deve usar `sourceSessionId`, nunca apenas título ou posição na lista.
Depois do deploy, validar `200 OK` e `Content-Type: image/webp` nas duas URLs de
cada sessão.

## Validação local de 29/07/2026

- 6 sessões com capa e destaque;
- 12 arquivos públicos inspecionados visualmente;
- originais: 37.940.949 bytes;
- WebP públicos: 3.170.464 bytes;
- redução total: 91,6%;
- manifesto validado com 6 `sourceSessionId` únicos;
- `npm run check`, `npm run build` e `git diff --check` aprovados.
