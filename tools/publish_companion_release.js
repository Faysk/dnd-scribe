const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { createClient } = require('@supabase/supabase-js');

const bucket = 'companion-releases';
const objectPath = 'windows/DnDScribeCompanionSetup.exe';
const executablePath = path.resolve(
  process.argv[2] || path.join('dist', 'companion-installer', 'DnDScribeCompanionSetup.exe')
);
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !secretKey) throw new Error('Supabase Storage não configurado.');
if (!fs.existsSync(executablePath)) throw new Error(`Instalador não encontrado: ${executablePath}`);

async function main() {
  const bytes = fs.readFileSync(executablePath);
  if (bytes.length > 10 * 1024 * 1024) throw new Error('O bootstrap excedeu o limite de 10 MB.');
  const sha256 = crypto.createHash('sha256').update(bytes).digest('hex');
  const client = createClient(supabaseUrl, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const storage = client.storage.from(bucket);
  const { error: uploadError } = await storage.upload(objectPath, bytes, {
    contentType: 'application/vnd.microsoft.portable-executable',
    cacheControl: '300',
    upsert: true
  });
  if (uploadError) throw uploadError;

  const { data: signed, error: signedError } = await storage.createSignedUrl(objectPath, 60, {
    download: 'DnDScribeCompanionSetup.exe'
  });
  if (signedError || !signed?.signedUrl) throw signedError || new Error('URL assinada ausente.');
  const response = await fetch(signed.signedUrl);
  if (!response.ok) throw new Error(`Leitura privada falhou: HTTP ${response.status}`);
  if (!String(response.headers.get('content-disposition') || '').includes('DnDScribeCompanionSetup.exe')) {
    throw new Error('O download privado não retornou o nome oficial do instalador.');
  }
  const downloaded = Buffer.from(await response.arrayBuffer());
  const downloadedHash = crypto.createHash('sha256').update(downloaded).digest('hex');
  if (downloadedHash !== sha256) throw new Error('O arquivo publicado não passou na verificação SHA-256.');

  console.log(JSON.stringify({
    ok: true,
    bucket,
    objectPath,
    bytes: bytes.length,
    sha256
  }, null, 2));
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exitCode = 1;
});
