const DEFAULT_USERNAME = 'DnD Scribe';
const DISCORD_API = 'https://discord.com/api/v10';
const MAX_CONTENT_LENGTH = 1800;
const MAX_FIELD_LENGTH = 1000;

function webhookUrl() {
  return process.env.DND_DISCORD_WEBHOOK_URL || process.env.DISCORD_WEBHOOK_URL || '';
}

function botToken() {
  return process.env.DISCORD_BOT_TOKEN || '';
}

function cleanText(value, max = MAX_FIELD_LENGTH) {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? text.slice(0, Math.max(0, max - 3)) + '...' : text;
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
  if (session) pieces.push('sessao: ' + session);
  if (status) pieces.push('status: ' + status);
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
  if (event.costUsd !== undefined) fields.push({ name: 'custo OpenAI', value: '$' + Number(event.costUsd || 0).toFixed(4), inline: true });
  return fields.slice(0, 10);
}

function messagePayload(event, { webhook = false } = {}) {
  const payload = {
    content: eventContent(event),
    embeds: [{
      title: cleanText(event.title || 'DnD Scribe', 240),
      description: cleanText(event.description || '', 3500),
      color: event.color || eventColor(event.status),
      fields: eventFields(event),
      timestamp: new Date().toISOString()
    }],
    allowed_mentions: { parse: [] }
  };
  if (webhook) payload.username = process.env.DND_DISCORD_WEBHOOK_NAME || DEFAULT_USERNAME;
  return payload;
}

function channelIdForTarget(target) {
  const normalized = String(target || '').trim().toLowerCase();
  if (normalized === 'recording' || normalized === 'recordings' || normalized === 'rec') {
    return process.env.DISCORD_RECORDINGS_CHANNEL_ID || '';
  }
  if (normalized === 'ops' || normalized === 'log' || normalized === 'logs' || normalized === 'admin') {
    return process.env.DISCORD_OPS_CHANNEL_ID || '';
  }
  if (normalized === 'dnd' || normalized === 'table' || normalized === 'mesa') {
    return process.env.DISCORD_DND_CHANNEL_ID || '';
  }
  return '';
}

function eventChannelId(event = {}) {
  return cleanText(
    event.channelId ||
    event.channel_id ||
    event.discordChannelId ||
    channelIdForTarget(event.channel || event.target || event.destination),
    80
  );
}

async function notifyDiscordChannel(event = {}, channelId = '') {
  const token = botToken();
  const targetChannelId = cleanText(channelId || eventChannelId(event), 80);
  if (!targetChannelId) return { sent: false, route: 'bot', reason: 'missing_channel' };
  if (!token) return { sent: false, route: 'bot', reason: 'missing_bot_token', channelId: targetChannelId };

  try {
    const response = await fetch(DISCORD_API + '/channels/' + targetChannelId + '/messages', {
      method: 'POST',
      headers: {
        Authorization: 'Bot ' + token,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(messagePayload(event))
    });
    const body = await response.text().catch(() => '');
    if (!response.ok) {
      throw new Error('Discord bot ' + response.status + ': ' + body.slice(0, 200));
    }
    let parsed = null;
    try {
      parsed = body ? JSON.parse(body) : null;
    } catch (_error) {
      parsed = null;
    }
    return { sent: true, route: 'bot', channelId: targetChannelId, messageId: parsed?.id || null };
  } catch (error) {
    console.warn('discord_bot_message_failed', error.message || String(error));
    return { sent: false, route: 'bot', channelId: targetChannelId, error: error.message || String(error) };
  }
}

async function notifyDiscordWebhook(event = {}) {
  const url = webhookUrl();
  if (!url) return { sent: false, route: 'webhook', reason: 'missing_webhook' };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messagePayload(event, { webhook: true }))
    });
    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error('Discord webhook ' + response.status + ': ' + body.slice(0, 200));
    }
    return { sent: true, route: 'webhook' };
  } catch (error) {
    console.warn('discord_webhook_failed', error.message || String(error));
    return { sent: false, route: 'webhook', error: error.message || String(error) };
  }
}

async function notifyDiscord(event = {}) {
  const channelId = eventChannelId(event);
  if (channelId || event.delivery === 'bot') {
    const botResult = await notifyDiscordChannel(event, channelId);
    if (botResult.sent || event.fallbackWebhook === false) return botResult;
    const webhookResult = await notifyDiscordWebhook(event);
    return { ...webhookResult, fallbackFrom: botResult };
  }
  return notifyDiscordWebhook(event);
}

module.exports = { notifyDiscord, notifyDiscordChannel, notifyDiscordWebhook, eventChannelId };
