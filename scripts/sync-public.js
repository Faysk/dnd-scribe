const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const sourceDir = path.join(root, "web");
const integrationsDir = path.join(root, "integrations");
const outputDir = path.join(root, "public");
const requiredSource = path.join(sourceDir, "index.html");
const requiredOutput = path.join(outputDir, "index.html");
const isVercelDeployment = process.env.VERCEL === "1";
const browserVendors = [
  {
    source: path.join(root, "node_modules", "marked", "lib", "marked.umd.js"),
    target: path.join(outputDir, "vendor", "marked.umd.js"),
  },
  {
    source: path.join(root, "node_modules", "dompurify", "dist", "purify.min.js"),
    target: path.join(outputDir, "vendor", "purify.min.js"),
  },
];

function fail(message) {
  console.error(`sync-public: ${message}`);
  process.exit(1);
}

function copyDirectory(source, target) {
  fs.mkdirSync(target, { recursive: true });

  for (const entry of fs.readdirSync(source, { withFileTypes: true })) {
    const sourcePath = path.join(source, entry.name);
    const targetPath = path.join(target, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile()) {
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function countFiles(dir) {
  let total = 0;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += countFiles(entryPath);
    } else if (entry.isFile()) {
      total += 1;
    }
  }

  return total;
}

if (!fs.existsSync(sourceDir)) {
  fail(`source directory not found: ${sourceDir}`);
}

if (!fs.existsSync(requiredSource)) {
  fail(`required frontend entry not found: ${requiredSource}`);
}

fs.rmSync(outputDir, { recursive: true, force: true });
copyDirectory(sourceDir, outputDir);
if (fs.existsSync(integrationsDir)) {
  copyDirectory(integrationsDir, path.join(outputDir, "integrations"));
}
for (const vendor of browserVendors) {
  if (!fs.existsSync(vendor.source)) {
    fail(`browser dependency not found: ${vendor.source}`);
  }
  fs.mkdirSync(path.dirname(vendor.target), { recursive: true });
  fs.copyFileSync(vendor.source, vendor.target);
}

// Após o cutover, o projeto legado continua hospedando API, Edit, jobs e assets,
// mas não deve mais competir com a Home moderna no domínio público. Em Vercel,
// remover somente o index legado deixa a rewrite de "/" assumir o tráfego sem
// desmontar as superfícies operacionais que ainda vivem neste projeto.
if (isVercelDeployment) {
  fs.rmSync(requiredOutput, { force: true });
}

if (!isVercelDeployment && !fs.existsSync(requiredOutput)) {
  fail(`public output is missing index.html after sync: ${requiredOutput}`);
}

const copiedFiles = countFiles(outputDir);
if (copiedFiles === 0) {
  fail(`public output is empty after sync: ${outputDir}`);
}

console.log(`Synced ${sourceDir} -> ${outputDir} (${copiedFiles} files${isVercelDeployment ? "; legacy index omitted for cutover" : ""})`);
