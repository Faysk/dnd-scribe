(function () {
  'use strict';

  var VERSION = '1.0.0';
  var MARKER = 'DND_SCRIBE_EVENT:';
  var STORE_KEY = 'dndScribeRoll20Bridge';
  var QUEUE_KEY = 'dndScribeRoll20BridgeQueue';
  var SEEN_KEY = 'dndScribeRoll20BridgeSeen';

  if (window.__DND_SCRIBE_ROLL20_BRIDGE__) {
    window.__DND_SCRIBE_ROLL20_BRIDGE__.show();
    return;
  }

  function readJson(key, fallback) {
    try {
      var text = window.localStorage.getItem(key);
      return text ? JSON.parse(text) : fallback;
    } catch (_error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch (_error) {}
  }

  function askConfig() {
    var existing = readJson(STORE_KEY, {});
    var apiBase = window.prompt('DnD Scribe URL', existing.apiBase || 'https://dnd.faysk.dev');
    if (!apiBase) return null;
    var campaignSlug = window.prompt('Campaign slug', existing.campaignSlug || 'yuhara-main');
    if (!campaignSlug) return null;
    var sourceSessionId = window.prompt('Source session id da sessao atual', existing.sourceSessionId || '');
    if (!sourceSessionId) return null;
    var token = window.prompt('Token da ponte Roll20', existing.token || '');
    if (!token) return null;
    var config = {
      apiBase: apiBase.replace(/\/+$/, ''),
      campaignSlug: campaignSlug,
      sourceSessionId: sourceSessionId,
      token: token
    };
    writeJson(STORE_KEY, config);
    return config;
  }

  var config = readJson(STORE_KEY, null) || askConfig();
  if (!config) return;

  var queue = readJson(QUEUE_KEY, []);
  var seen = new Set(readJson(SEEN_KEY, []));
  var enabled = true;
  var flushing = false;
  var flushTimer = null;
  var lastResult = 'aguardando';

  function saveQueue() {
    writeJson(QUEUE_KEY, queue.slice(-500));
  }

  function saveSeen() {
    writeJson(SEEN_KEY, Array.from(seen).slice(-800));
  }

  function packetId(packet) {
    return String(packet.sourceEventId || packet.id || packet.seq || packet.emittedAt || JSON.stringify(packet).slice(0, 120));
  }

  function enqueue(packet) {
    var id = packetId(packet);
    if (seen.has(id)) return;
    seen.add(id);
    packet.bridgeReceivedAt = new Date().toISOString();
    queue.push(packet);
    saveQueue();
    saveSeen();
    scheduleFlush(350);
    render();
  }

  function extractPacketsFromText(text) {
    var packets = [];
    var regex = /DND_SCRIBE_EVENT:([^\s<]+)/g;
    var match;
    while ((match = regex.exec(text || ''))) {
      try {
        packets.push(JSON.parse(decodeURIComponent(match[1])));
      } catch (error) {
        lastResult = 'pacote invalido: ' + error.message;
      }
    }
    return packets;
  }

  function scanNode(node) {
    if (!node || node.nodeType !== 1 || node.dataset.dndScribeRead === '1') return;
    var text = node.textContent || '';
    if (text.indexOf(MARKER) === -1) return;
    node.dataset.dndScribeRead = '1';
    extractPacketsFromText(text).forEach(enqueue);
    node.style.display = 'none';
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

  async function flush() {
    if (!enabled || flushing || !queue.length) {
      render();
      return;
    }
    flushing = true;
    render();
    var batch = queue.slice(0, 30);
    try {
      var response = await window.fetch(config.apiBase + '/api/roll20-bridge?campaignSlug=' + encodeURIComponent(config.campaignSlug), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer ' + config.token
        },
        body: JSON.stringify({
          version: VERSION,
          sourceSessionId: config.sourceSessionId,
          batchId: 'roll20-bridge-' + Date.now(),
          events: batch
        })
      });
      var payload = await response.json().catch(function () { return {}; });
      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || ('HTTP ' + response.status));
      }
      queue = queue.slice(batch.length);
      saveQueue();
      lastResult = 'ok: ' + (payload.persisted ? payload.persisted.persisted : batch.length) + ' eventos';
    } catch (error) {
      lastResult = 'erro: ' + error.message;
    } finally {
      flushing = false;
      render();
      if (queue.length) scheduleFlush(3000);
    }
  }

  function panel() {
    var existing = document.getElementById('dnd-scribe-roll20-bridge');
    if (existing) return existing;
    var el = document.createElement('div');
    el.id = 'dnd-scribe-roll20-bridge';
    el.style.cssText = [
      'position:fixed',
      'right:14px',
      'bottom:14px',
      'z-index:2147483647',
      'background:#101418',
      'color:#f5f7fb',
      'border:1px solid #3a4652',
      'border-radius:8px',
      'box-shadow:0 12px 36px rgba(0,0,0,.35)',
      'font:12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif',
      'padding:10px',
      'width:270px'
    ].join(';');
    document.body.appendChild(el);
    return el;
  }

  function render() {
    var el = panel();
    el.innerHTML = [
      '<div style="display:flex;justify-content:space-between;gap:8px;align-items:center;margin-bottom:6px">',
      '<strong>DnD Scribe</strong>',
      '<span style="color:' + (enabled ? '#6ee7a8' : '#f7c76a') + '">' + (enabled ? 'ligado' : 'pausado') + '</span>',
      '</div>',
      '<div>Sessao: <strong>' + escapeHtml(config.sourceSessionId) + '</strong></div>',
      '<div>Fila: <strong>' + queue.length + '</strong> | Seen: ' + seen.size + '</div>',
      '<div style="margin:6px 0;color:#b8c2cc">' + escapeHtml(lastResult) + '</div>',
      '<div style="display:flex;gap:6px;flex-wrap:wrap">',
      '<button data-action="toggle">' + (enabled ? 'Pausar' : 'Ligar') + '</button>',
      '<button data-action="flush">Enviar</button>',
      '<button data-action="config">Config</button>',
      '</div>'
    ].join('');
    el.querySelector('[data-action="toggle"]').onclick = function () {
      enabled = !enabled;
      if (enabled) scheduleFlush(100);
      render();
    };
    el.querySelector('[data-action="flush"]').onclick = function () { flush(); };
    el.querySelector('[data-action="config"]').onclick = function () {
      var next = askConfig();
      if (next) {
        config = next;
        scheduleFlush(100);
      }
      render();
    };
  }

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, function (char) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char];
    });
  }

  var observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(scanTree);
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  scanTree(document.body);
  scheduleFlush(500);
  render();

  window.__DND_SCRIBE_ROLL20_BRIDGE__ = {
    version: VERSION,
    show: render,
    flush: flush,
    config: function () { return config; },
    queue: function () { return queue.slice(); }
  };
}());
