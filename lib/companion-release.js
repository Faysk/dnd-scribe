const crypto = require('node:crypto');
const { createClient } = require('@supabase/supabase-js');

const BUCKET = 'companion-releases';
const LEGACY_OBJECT = 'windows/DnDScribeCompanionSetup.exe';
const MAX_BYTES = 10 * 1024 * 1024;

function requireCronAuth(req) {
  const secret = process.env.CRON_SECRET || process.env.DND_CRON_SECRET || '';
  if (!secret) throw Object.assign(new Error('CRON_SECRET nao configurado.'), { statusCode: 503 });
  const header = req.headers?.authorization || req.headers?.Authorization || '';
  if (header !== `Bearer ${secret}`) {
    throw Object.assign(new Error('Release nao autorizado.'), { statusCode: 401 });
  }
}

function cleanVersion(value) {
  const version = String(value || '').trim();
  if (!/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version)) {
    throw Object.assign(new Error('X-Companion-Version invalido.'), { statusCode: 400 });
  }
  return version;
}

function cleanSha(value) {
  const sha = String(value || '').trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(sha)) {
    throw Object.assign(new Error('X-Companion-Sha256 invalido.'), { statusCode: 400 });
  }
  return sha;
}

function readBinary(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (req.body instanceof Uint8Array) return Promise.resolve(Buffer.from(req.body));
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body, 'binary'));
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      const buffer = Buffer.from(chunk);
      total += buffer.length;
      if (total > MAX_BYTES) {
        reject(Object.assign(new Error('Instalador excede 10 MB.'), { statusCode: 413 }));
        req.destroy();
        return;
      }
      chunks.push(buffer);
    });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const secret = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!url || !secret) {
    throw Object.assign(new Error('Supabase Storage nao configurado.'), { statusCode: 503 });
  }
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

async function uploadVerified(storage, objectPath, bytes, sha256, cacheControl) {
  const { error: uploadError } = await storage.upload(objectPath, bytes, {
    contentType: 'application/vnd.microsoft.portable-executable',
    cacheControl,
    upsert: true,
    metadata: { sha256 }
  });
  if (uploadError) throw uploadError;
  const { data: signed, error: signedError } = await storage.createSignedUrl(objectPath, 60, {
    download: 'DnDScribeCompanionSetup.exe'
  });
  if (signedError || !signed?.signedUrl) throw signedError || new Error('URL de verificacao ausente.');
  const response = await fetch(signed.signedUrl, { cache: 'no-store' });
  if (!response.ok) throw new Error(`Verificacao privada falhou: HTTP ${response.status}`);
  const downloaded = Buffer.from(await response.arrayBuffer());
  const downloadedSha = crypto.createHash('sha256').update(downloaded).digest('hex');
  if (downloadedSha !== sha256) throw new Error(`SHA-256 divergente em ${objectPath}.`);
}

async function handleCompanionRelease(req) {
  requireCronAuth(req);
  const version = cleanVersion(req.headers['x-companion-version']);
  const expectedSha = cleanSha(req.headers['x-companion-sha256']);
  const bytes = await readBinary(req);
  if (!bytes.length) throw Object.assign(new Error('Instalador vazio.'), { statusCode: 400 });
  if (bytes.length > MAX_BYTES) throw Object.assign(new Error('Instalador excede 10 MB.'), { statusCode: 413 });
  const actualSha = crypto.createHash('sha256').update(bytes).digest('hex');
  if (actualSha !== expectedSha) {
    throw Object.assign(new Error('SHA-256 recebido nao confere com o arquivo.'), { statusCode: 400 });
  }

  const storage = supabaseAdmin().storage.from(BUCKET);
  const versionedObject = `windows/${version}/DnDScribeCompanionSetup.exe`;
  await uploadVerified(storage, versionedObject, bytes, actualSha, '31536000');
  await uploadVerified(storage, LEGACY_OBJECT, bytes, actualSha, '60');

  const manifest = Buffer.from(JSON.stringify({
    version,
    sha256: actualSha,
    bytes: bytes.length,
    objectPath: versionedObject,
    legacyObjectPath: LEGACY_OBJECT,
    publishedAt: new Date().toISOString()
  }, null, 2));
  const { error: manifestError } = await storage.upload('windows/release.json', manifest, {
    contentType: 'application/json',
    cacheControl: '60',
    upsert: true
  });
  if (manifestError) throw manifestError;

  return {
    ok: true,
    bucket: BUCKET,
    version,
    sha256: actualSha,
    bytes: bytes.length,
    objectPath: versionedObject,
    legacyObjectPath: LEGACY_OBJECT
  };
}

module.exports = { handleCompanionRelease };
