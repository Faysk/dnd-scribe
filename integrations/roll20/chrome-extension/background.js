const DEFAULT_API_BASE = 'https://dnd.faysk.dev';

async function postEvents(config, events) {
  const apiBase = String(config.apiBase || DEFAULT_API_BASE).replace(/\/+$/, '');
  const campaignSlug = encodeURIComponent(config.campaignSlug || 'yuhara-main');

  const response = await fetch(`${apiBase}/api/roll20-bridge?campaignSlug=${campaignSlug}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${config.token || ''}`
    },
    body: JSON.stringify({
      version: 'chrome-extension-1.1.0',
      sourceSessionId: config.sourceSessionId || '',
      batchId: `roll20-extension-${Date.now()}`,
      events
    })
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.ok === false) {
    throw new Error(payload.error || `HTTP ${response.status}`);
  }
  return payload;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (!message || message.type !== 'dnd-scribe-flush') return false;

  postEvents(message.config || {}, message.events || [])
    .then(payload => sendResponse({ ok: true, payload }))
    .catch(error => sendResponse({ ok: false, error: error.message || String(error) }));

  return true;
});
