const {
  handleDiscordInteraction,
  verifyDiscordSignature,
  httpError
} = require('../../lib/discord-interactions');

function sendJson(res, status, value) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(value));
}

function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return Promise.resolve(req.body);
  if (typeof req.body === 'string') return Promise.resolve(Buffer.from(req.body, 'utf8'));
  if (req.body && typeof req.body === 'object') {
    return Promise.resolve(Buffer.from(JSON.stringify(req.body), 'utf8'));
  }
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(Buffer.from(chunk)));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

module.exports = async function handler(req, res) {
  try {
    if (req.method === 'GET') {
      return sendJson(res, 200, {
        ok: true,
        app: 'dnd-scribe-discord-interactions',
        configured: Boolean(process.env.DISCORD_PUBLIC_KEY),
        commands: ['/dnd status', '/dnd nota', '/dnd vincular', 'Salvar no DnD Scribe']
      });
    }
    if (req.method !== 'POST') return sendJson(res, 405, { ok: false, error: 'Method not allowed' });

    const rawBody = await readRawBody(req);
    const signature = req.headers['x-signature-ed25519'];
    const timestamp = req.headers['x-signature-timestamp'];
    const verified = verifyDiscordSignature({ signature, timestamp, rawBody });
    if (!verified) return sendJson(res, 401, { ok: false, error: 'Invalid Discord signature' });

    const payload = JSON.parse(rawBody.toString('utf8') || '{}');
    const response = await handleDiscordInteraction(payload);
    return sendJson(res, 200, response);
  } catch (error) {
    const status = error.statusCode || 500;
    const message = error.message || String(error);
    if (status >= 500) console.error('discord_interaction_failed', message);
    return sendJson(res, status, { ok: false, error: message });
  }
};

module.exports.config = {
  maxDuration: 10
};
