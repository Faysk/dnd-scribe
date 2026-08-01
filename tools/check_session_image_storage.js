const { createClient } = require('@supabase/supabase-js');
const crypto = require('node:crypto');

const bucket = 'session-images';
const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !secretKey) {
  throw new Error('SUPABASE_URL e SUPABASE_SECRET_KEY são obrigatórias.');
}

const client = createClient(supabaseUrl, secretKey, {
  auth: { persistSession: false, autoRefreshToken: false }
});
const objectPath = `smoke/${Date.now()}-${crypto.randomUUID()}.webp`;
const webp = Buffer.from(
  'UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AA/vuUAAA=',
  'base64'
);

async function run() {
  try {
    const { data: signed, error: signError } = await client.storage
      .from(bucket)
      .createSignedUploadUrl(objectPath);
    if (signError || !signed?.token) throw signError || new Error('Token de upload ausente.');

    const { error: uploadError } = await client.storage
      .from(bucket)
      .uploadToSignedUrl(objectPath, signed.token, webp, {
        contentType: 'image/webp',
        cacheControl: '31536000'
      });
    if (uploadError) throw uploadError;

    const { data: publicAsset } = client.storage.from(bucket).getPublicUrl(objectPath);
    const response = await fetch(publicAsset.publicUrl, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Leitura pública falhou com HTTP ${response.status}.`);
    if (!String(response.headers.get('content-type')).startsWith('image/webp')) {
      throw new Error(`Content-Type inesperado: ${response.headers.get('content-type')}`);
    }
    console.log('Session image storage OK: signed upload, public read and cleanup.');
  } finally {
    const { error } = await client.storage.from(bucket).remove([objectPath]);
    if (error) console.warn(`Cleanup warning: ${error.message}`);
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
