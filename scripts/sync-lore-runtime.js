const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceRoot = path.join(root, "lore");
const outputRoot = path.join(root, "lore-runtime");
const files = [
  "00_indice/canon_e_continuidade.md",
  "00_indice/mapa_da_lore.md",
  "01_campanha/revisao_canon_dnd_scribe.md",
  "01_campanha/timeline.md",
  "02_personagens/dandelion/biblia.md",
  "02_personagens/sinais_por_personagem_dnd_scribe.md",
  "02_personagens/trio/lore_bible_dandelion_astel_screaky.md",
  "04_euclix/plano_contra_ivory.md",
  "04_euclix/profecia_e_cancoes_dandelion.md",
  "05_musicas/catalogo_youtube.md",
  "05_musicas/letras/dialogos_para_musicas_dnd_scribe.md",
  "05_musicas/suno/guia_suno.md",
  "06_referencias_visuais/ferramentas/suno_workspace_baile_dandelion.png",
  "06_referencias_visuais/mapas/faerun_mapa_atual_com_marcadores.png",
  "06_referencias_visuais/mapas/refugio_localizacao_atual.png",
  "06_referencias_visuais/personagens/dandelion_atual.png",
  "08_fichas/ficha_atual/ficha_atual.md",
];

fs.rmSync(outputRoot, { recursive: true, force: true });

let totalBytes = 0;
for (const relative of files) {
  const source = path.join(sourceRoot, relative);
  const target = path.join(outputRoot, relative);
  if (!fs.existsSync(source)) {
    throw new Error(`Arquivo de lore necessário ausente: ${relative}`);
  }
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  totalBytes += fs.statSync(target).size;
}

console.log(
  `Lore runtime sincronizada: ${files.length} arquivos, ${totalBytes} bytes`,
);
