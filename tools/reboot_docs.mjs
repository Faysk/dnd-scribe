import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { resolve, dirname, relative, isAbsolute } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const base = resolve(root, 'docs/reboot');
const read = (file) => readFileSync(file, 'utf8').replace(/^\uFEFF/, '');
const catalog = JSON.parse(read(resolve(base, 'catalogo.json')));
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };
const index = [
  '# Reboot TDA — documentação e roadmap',
  '',
  '> Status: fundação web implementada; migração e novo hosting pendentes. Responsável: proprietário e implementador do TDA. Revisão: ' + catalog.reviewedAt + '.',
  '',
  'Este é o ponto de entrada vigente para o reboot. Consolida as decisões do proprietário e substitui a sequência dos planos antigos, preservados como histórico. Não declara migração, backup, configuração de ambientes ou deploy concluídos.',
  '',
  '**Direção:** transcrição como origem; dados preservados; toda tecnologia na última versão estável oficialmente verificada; main = Production; Preview = homologação; outras branches temporárias; Home/sessões/resumos antes do Edit integrado; novas funcionalidades depois da base completa.',
  '',
  '## Comece por aqui',
  '',
  '1. [Produto e escopo](01-produto-e-escopo.md).',
  '2. [Roadmap e critérios de aceite](10-roadmap-e-aceite.md).',
  '3. [Estado, riscos e decisões abertas](11-estado-riscos-e-decisoes.md).',
  '',
  '## Índice de módulos',
  '',
  '| Documento | Conteúdo |',
  '| --- | --- |',
  ...catalog.documents.map((doc, i) => '| ' + String(i + 1).padStart(2, '0') + ' | [' + doc.title + '](' + doc.file + ') |'),
  '',
  '## Registros e referências',
  '',
  '- [Registro de versões](registros/versoes.md).',
  '- [Inventário e paridade](registros/inventario.md).',
  '- [Evidência da entrega documental](registros/entrega-documental.md).',
  '- [Fundação web e hospedagem gratuita](registros/fundacao-web.md).',
  '- [Template de evidência](templates/evidencia.md).',
  '- [Template de decisão](templates/decisao.md).',
  '- [Pacotes oficiais e referências visuais](referencias/README.md).',
  '- [Índice geral da documentação](../README.md).',
  '',
  '## Próxima execução',
  '',
  'Iniciar R0: inventário de dados e fluxos, consulta de versões oficiais, backup/restauração isolada e configuração de Preview. A localização de lore/pipipi permanece pendente para sua publicação auxiliar.',
  '',
  '## Manutenção',
  '',
  'Índice gerado de catalogo.json por node tools/reboot_docs.mjs --write. Verificar com node tools/reboot_docs.mjs --check e git diff --check. Editar os módulos e o catálogo; não editar este índice manualmente.',
  '',
].join('\n');

const mode = process.argv[2];
if (!['--write', '--check'].includes(mode)) {
  process.stderr.write('Use --write ou --check.\n');
  process.exit(2);
}
if (mode === '--write') writeFileSync(resolve(base, 'README.md'), index);
check(read(resolve(base, 'README.md')).replace(/\r\n/g, '\n') === index, 'Índice desatualizado');
const files = [];
function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = resolve(dir, entry.name);
    if (entry.isDirectory()) walk(path);
    else files.push(path);
  }
}
walk(base);
const catalogNames = catalog.documents.map((doc) => doc.file);
check(new Set(catalogNames).size === catalogNames.length, 'Catálogo duplicado');
for (const doc of catalog.documents) {
  const path = resolve(base, doc.file);
  check(existsSync(path), 'Documento ausente: ' + doc.file);
  if (existsSync(path)) check(read(path).split(/\r?\n/)[0] === '# ' + doc.title, 'Título divergente: ' + doc.file);
}
for (const file of files.filter((path) => path.endsWith('.md'))) {
  const body = read(file);
  check(body.includes('Responsável:') && body.includes('Revisão:'), 'Metadados ausentes: ' + relative(base, file));
  if (/^\d{2}-/.test(relative(base, file))) check(catalogNames.includes(relative(base, file)), 'Módulo fora do catálogo: ' + file);
  for (const match of body.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
    const target = match[1];
    if (/^(https?:|mailto:|#)/i.test(target)) continue;
    const pathPart = decodeURIComponent(target.split('#')[0]);
    if (!pathPart) continue;
    const path = resolve(dirname(file), pathPart);
    const rel = relative(root, path);
    check(!rel.startsWith('..') && !isAbsolute(rel), 'Link fora do projeto: ' + target);
    check(existsSync(path), 'Link quebrado em ' + relative(base, file) + ': ' + target);
  }
}
const manifest = JSON.parse(read(resolve(base, 'referencias/manifesto.json')));
for (const asset of manifest.files) {
  const file = resolve(base, 'referencias', asset.file);
  check(existsSync(file), 'Referência ausente: ' + asset.file);
  if (!existsSync(file)) continue;
  const bytes = readFileSync(file);
  check(bytes.length === asset.bytes, 'Tamanho divergente: ' + asset.file);
  check(createHash('sha256').update(bytes).digest('hex') === asset.sha256, 'Hash divergente: ' + asset.file);
}
if (errors.length) {
  process.stderr.write(errors.join('\n') + '\n');
  process.exit(1);
}
process.stdout.write('REBOOT_DOCS_OK: ' + catalog.documents.length + ' módulos; ' + files.filter((f) => f.endsWith('.md')).length + ' Markdown; ' + manifest.files.length + ' referências; índice, metadados, links locais e hashes válidos.\n');
