const DEFAULT_USERNAME = 'DnD Scribe';
const MAX_CONTENT_LENGTH = 1800;
const MAX_FIELD_LENGTH = 1000;

function webhookUrl() {
  return process.env.DND_DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || '';
}

function cleanText(value, max = MAX_FIELD_LENGTH) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, Math.max(0, max - 3))}...` : text;
}

function eventColor(status) {
  if (status === 'failed') return 0xc53030;
  if (status === 'warning' || status === 'partial') return 0xd69e2e;
  return 0x2f855a;
}

function eventContent(event) {
  const title = cleanText(event.title || 'DnD Scribe', 120);
  const session = cleanText(event.sourceSessionId || event.session || '', 180);
  const status = cleanText(event.status || '', 80);
  const pieces = [title];
  if (session) pieces.push(`sessao: ${session}`);
  if (status) pieces.push(`status: ${status}`);
  return cleanText(pieces.join(' | '), MAX_CONTENT_LENGTH);
}

function eventFields(event) {
  const fields = [];
  for (const item of event.fields || []) {
    const name = cleanText(item.name, 120);
    const value = cleanText(item.value, MAX_FIELD_LENGTH);
    if (name && value) fields.push({ name, value, inline: Boolean(item.inline) });
  }
  if (event.jobId) fields.push({ name: 'job', value: cleanText(event.jobId, 120), inline: true });
  if (event.costUsd !== undefined) fields.push({ name: 'custo OpenAI', value: `$${Number(event.costUsd || 0).toFixed(4)}`, inline: true });
  return fields.slice(0, 10);
}

async function notifyDiscord(event = {}) {
  const url = webhookUrl();
  if (!url) return { sent: false, reason: 'missing_webhook' };

  const payload = {
    username: process.env.DND_DISCORD_WEBHOOK_NAME || DEFAULT_USERNAME,
    content: eventContent(event),
    embeds: [{
      title: cleanText(event.title || 'DnD Scribe', 240),
      description: cleanText(event.description || '', 3500),
      color: event.color || eventColor(event.status),
      fields: eventFields(event),
      timestamp: new Date().toISOString()
    }]
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`Discord webhook ${response.status}: ${body.slice(0, 200)}`);
    }
    return { sent: true };
  } catch (error) {
    console.warn('discord_webhook_failed', error.message || String(error));
    return { sent: false, error: error.message || String(error) };
  }
}

module.exports = { notifyDiscord };
