(function () {
  'use strict';

  const VERSION = 'chrome-extension-1.0.0';
  const MARKER = 'DND_SCRIBE_EVENT:';
  const STORAGE_KEY = 'dndScribeRoll20Bridge';
  const QUEUE_KEY = 'dndScribeRoll20BridgeQueue';
  const SEEN_KEY = 'dndScribeRoll20BridgeSeen';

  let config = null;
  let queue = [];
  let seen = new Set();
  let enabled = true;
  let flushing = false;
  let flushTimer = null;
  let lastResult = 'aguardando';

  const storageGet = keys => new Promise(resolve => chrome.storage.local.get(keys, resolve));
  const storageSet = values => new Promise(resolve => chrome.storage.local.set(values, resolve));

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function packetId(packet) {
    return String(packet.sourceEventId || packet.id || packet.seq || packet.emittedAt || JSON.stringify(packet).slice(0, 120));
  }

  async function saveQueue() { await storageSet({ [QUEUE_KEY]: queue.slice(-500) }); }
  async function saveSeen() { await storageSet({ [SEEN_KEY]: Array.from(seen).slice(-800) }); }
  async function saveConfig() { await storageSet({ [STORAGE_KEY]: config }); }

  async function askConfig() {
    const apiBase = window.prompt('DnD Scribe URL', config?.apiBase || 'https://dnd.faysk.dev');
    if (!apiBase) return;
    const campaignSlug = window.prompt('Campaign slug', config?.campaignSlug || 'yuhara-main');
    if (!campaignSlug) return;
    const sourceSessionId = window.prompt('Source session id da sessao atual', config?.sourceSessionId || '');
    if (!sourceSessionId) return;
    const token = window.prompt('Token da ponte Roll20', config?.token || '');
    if (!token) return;

    config = { apiBase: apiBase.replace(/\/+$/, ''), campaignSlug, sourceSessionId, token };
    await saveConfig();
    render();
    scheduleFlush(200);
  }

  function extractPacketsFromText(text) {
    const packets = [];
    const regex = /DND_SCRIBE_EVENT:([^\s<]+)/g;
    let match;
    while ((match = regex.exec(text || ''))) {
      try { packets.push(JSON.parse(decodeURIComponent(match[1]))); }
      catch (error) { lastResult = `pacote invalido: ${error.message}`; }
    }
    return packets;
  }

  async function enqueue(packet) {
    const id = packetId(packet);
    if (seen.has(id)) return;
    seen.add(id);
    packet.bridgeReceivedAt = new Date().toISOString();
    packet.bridgeVersion = VERSION;
    queue.push(packet);
    await saveQueue();
    await saveSeen();
    scheduleFlush(300);
    render();
  }

  function scanNode(node) {
    if (!node || node.nodeType !== 1 || node.dataset.dndScribeRead === '1') return;
    const text = node.textContent || '';
    if (text.indexOf(MARKER) === -1) return;
    node.dataset.dndScribeRead = '1';
    node.style.display = 'none';
    extractPacketsFromText(text).forEach(packet => enqueue(packet));
  }

  function scanTree(root) {
    scanNode(root);
    if (!root || !root.querySelectorAll) return;
    root.querySelectorAll('*').forEach(scanNode);
  }

  function scheduleFlush(delay) {
    if (!enabled) return;
    window.clearTimeout(flushTimer);
    flushTimer = window.setTimeout(flush, delay || 1000);
  }

  function runtimeSend(message) {
    return new Promise(resolve => chrome.runtime.sendMessage(message, resolve));
  }

  async function flush() {
    if (!enabled || flushing || !queue.length) { render(); return; }
    if (!config?.token || !config?.sourceSessionId) {
      lastResult = 'configure sourceSessionId e token';
      render();
      return;
    }

    flushing = true;
    render();

    const batch = queue.slice(0, 30);
    try {
      const result = await runtimeSend({ type: 'dnd-scribe-flush', config, events: batch });
      if (!result?.ok) throw new Error(result?.error || 'falha ao enviar');
      queue = queue.slice(batch.length);
      await saveQueue();
      const persisted = result.payload?.persisted?.persisted ?? batch.length;
      const updated = result.payload?.persisted?.updated ?? 0;
      lastResult = `ok: ${persisted} novos, ${updated} atualizados`;
    } catch (error) {
      lastResult = `erro: ${error.message || String(error)}`;
    } finally {
      flushing = false;
      render();
      if (queue.length) scheduleFlush(3000);
    }
  }

  function panel() {
    let el = document.getElementById('dnd-scribe-roll20-extension');
    if (el) return el;
    el = document.createElement('div');
    el.id = 'dnd-scribe-roll20-extension';
    el.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#101418;color:#f5f7fb;border:1px solid #3a4652;border-radius:8px;box-shadow:0 12px 36px rgba(0,0,0,.35);font:12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;padding:10px;width:280px';
    document.body.appendChild(el);
    return el;
  }

  function render() {
    const el = panel();
    el.innerHTML = [
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px">',
      '<strong>DnD Scribe</strong>',
      '<span style="color:' + (enabled ? '#6ee7a8' : '#f7c76a') + '">' + (enabled ? 'ligado' : 'pausado') + '</span>',
      '</div>',
      '<div>Sessao: <strong>' + escapeHtml(config?.sourceSessionId || 'sem sessao') + '</strong></div>',
      '<div>Fila: <strong>' + queue.length + '</strong> | Seen: ' + seen.size + '</div>',
      '<div style="margin:6px 0;color:#b8c2cc">' + escapeHtml(lastResult) + '</div>',
      '<div style="display:flex;gap:6px;flex-wrap:wrap">',
      '<button type="button" data-action="toggle">' + (enabled ? 'Pausar' : 'Ligar') + '</button>',
      '<button type="button" data-action="flush">Enviar</button>',
      '<button type="button" data-action="config">Config</button>',
      '</div>'
    ].join('');

    el.querySelector('[data-action="toggle"]').onclick = () => {
      enabled = !enabled;
      if (enabled) scheduleFlush(100);
      render();
    };
    el.querySelector('[data-action="flush"]').onclick = () => flush();
    el.querySelector('[data-action="config"]').onclick = () => askConfig();
  }

  async function boot() {
    const stored = await storageGet([STORAGE_KEY, QUEUE_KEY, SEEN_KEY]);
    config = stored[STORAGE_KEY] || null;
    queue = Array.isArray(stored[QUEUE_KEY]) ? stored[QUEUE_KEY] : [];
    seen = new Set(Array.isArray(stored[SEEN_KEY]) ? stored[SEEN_KEY] : []);

    render();
    if (!config?.token || !config?.sourceSessionId) {
      lastResult = 'clique em Config para ligar';
      render();
    }

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => mutation.addedNodes.forEach(scanTree));
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scanTree(document.body);
    scheduleFlush(600);
  }

  boot();
}());
