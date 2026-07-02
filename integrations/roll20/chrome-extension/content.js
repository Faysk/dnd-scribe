(function () {
  'use strict';

  const VERSION = 'chrome-extension-1.1.0';
  const MARKER = 'DND_SCRIBE_EVENT:';
  const STORAGE_KEY = 'dndScribeRoll20Bridge';
  const QUEUE_KEY = 'dndScribeRoll20BridgeQueue';
  const SEEN_KEY = 'dndScribeRoll20BridgeSeen';
  const PANEL_ID = 'dnd-scribe-roll20-extension';
  const MESSAGE_SELECTOR = [
    '.message',
    '.chatmessage',
    '#textchat .message',
    '.textchatcontainer .message',
    '[data-messageid]',
    '[data-message-id]',
    '.sheet-rolltemplate-default',
    '.sheet-rolltemplate-spell',
    '.sheet-rolltemplate-atkdmg',
    '.sheet-rolltemplate-npc'
  ].join(',');

  let config = null;
  let queue = [];
  let seen = new Set();
  let enabled = true;
  let flushing = false;
  let flushTimer = null;
  let directSeq = 0;
  let lastResult = 'aguardando';
  let markerCaptured = 0;
  let domCaptured = 0;

  const storageGet = keys => new Promise(resolve => chrome.storage.local.get(keys, resolve));
  const storageSet = values => new Promise(resolve => chrome.storage.local.set(values, resolve));

  function escapeHtml(value) {
    return String(value || '').replace(/[&<>"']/g, char => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
  }

  function cleanText(value, max = 4000) {
    const text = String(value || '')
      .replace(/\u00a0/g, ' ')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{4,}/g, '\n\n\n')
      .trim();
    return text.length > max ? text.slice(0, max) : text;
  }

  function compactSpaces(value, max = 4000) {
    const text = String(value || '').replace(/\s+/g, ' ').trim();
    return text.length > max ? text.slice(0, max) : text;
  }

  function packetId(packet) {
    return String(packet.sourceEventId || packet.id || packet.seq || packet.emittedAt || JSON.stringify(packet).slice(0, 120));
  }

  function hashText(value) {
    let hash = 2166136261;
    const text = String(value || '');
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  async function saveQueue() { await storageSet({ [QUEUE_KEY]: queue.slice(-500) }); }
  async function saveSeen() { await storageSet({ [SEEN_KEY]: Array.from(seen).slice(-1200) }); }
  async function saveConfig() { await storageSet({ [STORAGE_KEY]: config }); }

  function domCaptureEnabled() {
    return config?.captureDom !== false;
  }

  function isConfigured() {
    return Boolean(config?.token && config?.sourceSessionId);
  }

  async function askConfig() {
    const apiBase = window.prompt('DnD Scribe URL', config?.apiBase || 'https://dnd.faysk.dev');
    if (!apiBase) return;
    const campaignSlug = window.prompt('Campaign slug', config?.campaignSlug || 'yuhara-main');
    if (!campaignSlug) return;
    const sourceSessionId = window.prompt('Source session id da sessao atual', config?.sourceSessionId || '');
    if (!sourceSessionId) return;
    const token = window.prompt('Token da ponte Roll20', config?.token || '');
    if (!token) return;

    config = {
      apiBase: apiBase.replace(/\/+$/, ''),
      campaignSlug,
      sourceSessionId,
      token,
      captureDom: config?.captureDom !== false
    };
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

  async function enqueue(packet, source = 'unknown') {
    if (!enabled) return;
    const id = packetId(packet);
    if (seen.has(id)) return;
    seen.add(id);
    packet.bridgeReceivedAt = new Date().toISOString();
    packet.bridgeVersion = VERSION;
    queue.push(packet);
    if (source === 'dom') domCaptured += 1;
    if (source === 'marker') markerCaptured += 1;
    await saveQueue();
    await saveSeen();
    scheduleFlush(300);
    render();
  }

  function packetCarrier(element) {
    if (!element || !element.closest) return element;
    const carrier = element.closest(
      '.message, .chatmessage, .textchatcontainer .message, [class*="message"], li, code, pre'
    ) || element;
    if (!carrier || carrier === document.body || carrier === document.documentElement) return element;
    return carrier;
  }

  function hidePacketTextNode(textNode) {
    const parent = textNode?.parentElement;
    if (!parent) return;
    const target = packetCarrier(parent);
    if (target.dataset) target.dataset.dndScribeRead = '1';
    target.classList?.add('dnd-scribe-hidden-packet');
    target.style.display = 'none';
  }

  function scanTextNode(textNode) {
    const text = textNode?.nodeValue || '';
    if (text.indexOf(MARKER) === -1) return;
    const parent = textNode.parentElement;
    if (parent?.dataset?.dndScribeRead === '1') return;
    hidePacketTextNode(textNode);
    extractPacketsFromText(text).forEach(packet => enqueue(packet, 'marker'));
  }

  function scanMarkerTree(root) {
    if (!root) return;
    if (root.nodeType === 3) {
      scanTextNode(root);
      return;
    }
    if (root.nodeType !== 1) return;
    if (root.dataset?.dndScribeRead === '1') return;
    if (root.matches?.('script, style, textarea, input')) return;

    const text = root.textContent || '';
    if (text.indexOf(MARKER) === -1) return;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return (node.nodeValue || '').indexOf(MARKER) === -1
          ? NodeFilter.FILTER_REJECT
          : NodeFilter.FILTER_ACCEPT;
      }
    });
    let node;
    while ((node = walker.nextNode())) scanTextNode(node);
  }

  function isOwnPanel(element) {
    return Boolean(element?.closest?.(`#${PANEL_ID}`));
  }

  function directCarrierFromNode(node) {
    if (!node) return null;
    if (node.nodeType === 3) return node.parentElement?.closest?.(MESSAGE_SELECTOR) || null;
    if (node.nodeType !== 1) return null;
    if (node.matches?.(MESSAGE_SELECTOR)) return node;
    return null;
  }

  function directCandidates(root) {
    const candidates = new Set();
    const carrier = directCarrierFromNode(root);
    if (carrier) candidates.add(carrier);
    if (root?.nodeType === 1 && root.querySelectorAll) {
      root.querySelectorAll(MESSAGE_SELECTOR).forEach(element => candidates.add(element));
    }
    return Array.from(candidates);
  }

  function isLikelyChatMessage(element, text) {
    if (!element || isOwnPanel(element)) return false;
    if (element.dataset?.dndScribeDomRead === '1') return false;
    if (element.closest?.('[data-dnd-scribe-dom-read="1"]') && element.closest('[data-dnd-scribe-dom-read="1"]') !== element) return false;
    if (!text || text.length < 2 || text.length > 12000) return false;
    if (text.indexOf(MARKER) !== -1) return false;
    if (/^Ponte Roll20\b/i.test(text)) return false;
    const className = String(element.className || '').toLowerCase();
    const container = element.closest?.('#textchat, .textchatcontainer, [id*="textchat"], [class*="textchat"], [class*="chatlog"], [id*="chat"]');
    return Boolean(container || className.indexOf('message') !== -1 || className.indexOf('rolltemplate') !== -1);
  }

  function extractSpeaker(element, text) {
    const selectors = ['.by', '.who', '.spacer .by', '.message-header', '[class*="speaker"]', '[class*="username"]'];
    for (const selector of selectors) {
      const found = element.querySelector?.(selector);
      const value = compactSpaces(found?.textContent || '', 160).replace(/:$/, '');
      if (value && value.length <= 160) return value;
    }
    const firstLine = cleanText(text, 260).split('\n')[0] || '';
    const colon = firstLine.indexOf(':');
    if (colon > 0 && colon <= 80) return compactSpaces(firstLine.slice(0, colon), 160);
    return null;
  }

  function stripSpeakerFromText(text, speaker) {
    const value = cleanText(text, 5000);
    const name = compactSpaces(speaker || '', 160);
    if (!name) return value;
    const lines = value.split('\n');
    const first = compactSpaces(lines[0] || '', 260).replace(/:$/, '');
    if (first === name) return cleanText(lines.slice(1).join('\n'), 5000);
    if (value.indexOf(`${name}:`) === 0) return cleanText(value.slice(name.length + 1), 5000);
    return value;
  }

  function detectRoll20Type(element, text) {
    const className = String(element.className || '').toLowerCase();
    const lower = String(text || '').toLowerCase();
    if (className.indexOf('gm') !== -1 && className.indexOf('roll') !== -1) return 'gmrollresult';
    if (className.indexOf('roll') !== -1 || /\b\d+d\d+\b|\[\[/.test(text) || lower.indexOf('rolling ') !== -1) {
      return 'rollresult';
    }
    return 'general';
  }

  function extractRollTemplate(element) {
    const className = String(element.className || '');
    const match = className.match(/sheet-rolltemplate-([a-z0-9_-]+)/i);
    return match ? match[1] : '';
  }

  function directEventId(element, text) {
    const explicit = element.getAttribute?.('data-messageid')
      || element.getAttribute?.('data-message-id')
      || element.id
      || '';
    if (explicit) return `roll20-dom-${explicit}`;
    directSeq += 1;
    return `roll20-dom-${Date.now()}-${directSeq}-${hashText(text)}`;
  }

  function packetFromDomElement(element) {
    const text = cleanText(element.innerText || element.textContent || '', 5000);
    if (!isLikelyChatMessage(element, text)) return null;
    const speaker = extractSpeaker(element, text);
    const content = cleanText(stripSpeakerFromText(text, speaker), 3500);
    if (!content) return null;
    const type = detectRoll20Type(element, content || text);
    return {
      version: VERSION,
      sourceEventId: directEventId(element, content),
      emittedAt: new Date().toISOString(),
      source: 'roll20-dom',
      rawLine: speaker ? `${speaker}: ${content}` : content,
      message: {
        who: speaker || '',
        playerid: '',
        type,
        content,
        rolltemplate: extractRollTemplate(element),
        inlinerolls: []
      },
      dom: {
        capture: 'direct',
        className: compactSpaces(element.className || '', 240)
      }
    };
  }

  function processDirectElement(element) {
    if (!enabled || !domCaptureEnabled() || !isConfigured()) return;
    if (!element || element.dataset?.dndScribeDomRead === '1') return;
    if (element.dataset) delete element.dataset.dndScribeDomPending;
    const packet = packetFromDomElement(element);
    if (!packet) return;
    if (element.dataset) element.dataset.dndScribeDomRead = '1';
    enqueue(packet, 'dom');
  }

  function scheduleDirectElement(element) {
    if (!enabled || !domCaptureEnabled() || !isConfigured()) return;
    if (!element || element.dataset?.dndScribeDomRead === '1' || element.dataset?.dndScribeDomPending === '1') return;
    if (isOwnPanel(element)) return;
    if (element.dataset) element.dataset.dndScribeDomPending = '1';
    window.setTimeout(() => processDirectElement(element), 140);
  }

  function scanDirectTree(root) {
    if (!domCaptureEnabled() || !isConfigured()) return;
    directCandidates(root).forEach(scheduleDirectElement);
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

  function injectStyles() {
    if (document.getElementById('dnd-scribe-roll20-style')) return;
    const style = document.createElement('style');
    style.id = 'dnd-scribe-roll20-style';
    style.textContent = '.dnd-scribe-hidden-packet{display:none!important}';
    document.documentElement.appendChild(style);
  }

  function panel() {
    let el = document.getElementById(PANEL_ID);
    if (el) return el;
    el = document.createElement('div');
    el.id = PANEL_ID;
    el.style.cssText = 'position:fixed;right:14px;bottom:14px;z-index:2147483647;background:#101418;color:#f5f7fb;border:1px solid #3a4652;border-radius:8px;box-shadow:0 12px 36px rgba(0,0,0,.35);font:12px/1.35 system-ui,-apple-system,Segoe UI,sans-serif;padding:10px;width:300px';
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
      '<div>Captura: <strong>' + escapeHtml(domCaptureEnabled() ? 'DOM direto' : 'legado Mod') + '</strong></div>',
      '<div>Fila: <strong>' + queue.length + '</strong> | Seen: ' + seen.size + '</div>',
      '<div>DOM: ' + domCaptured + ' | Legado: ' + markerCaptured + '</div>',
      '<div style="margin:6px 0;color:#b8c2cc">' + escapeHtml(lastResult) + '</div>',
      '<div style="display:flex;gap:6px;flex-wrap:wrap">',
      '<button type="button" data-action="toggle">' + (enabled ? 'Pausar' : 'Ligar') + '</button>',
      '<button type="button" data-action="flush">Enviar</button>',
      '<button type="button" data-action="config">Config</button>',
      '<button type="button" data-action="capture">' + (domCaptureEnabled() ? 'DOM on' : 'DOM off') + '</button>',
      '</div>'
    ].join('');

    el.querySelector('[data-action="toggle"]').onclick = () => {
      enabled = !enabled;
      if (enabled) scheduleFlush(100);
      render();
    };
    el.querySelector('[data-action="flush"]').onclick = () => flush();
    el.querySelector('[data-action="config"]').onclick = () => askConfig();
    el.querySelector('[data-action="capture"]').onclick = async () => {
      config = {
        ...(config || {}),
        apiBase: config?.apiBase || 'https://dnd.faysk.dev',
        campaignSlug: config?.campaignSlug || 'yuhara-main',
        captureDom: !domCaptureEnabled()
      };
      await saveConfig();
      render();
    };
  }

  async function boot() {
    const stored = await storageGet([STORAGE_KEY, QUEUE_KEY, SEEN_KEY]);
    config = stored[STORAGE_KEY] || null;
    queue = Array.isArray(stored[QUEUE_KEY]) ? stored[QUEUE_KEY] : [];
    seen = new Set(Array.isArray(stored[SEEN_KEY]) ? stored[SEEN_KEY] : []);

    injectStyles();
    render();
    if (!config?.token || !config?.sourceSessionId) {
      lastResult = 'clique em Config para ligar';
      render();
    }

    const observer = new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          scanMarkerTree(node);
          scanDirectTree(node);
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
    scanMarkerTree(document.body);
    scheduleFlush(600);
  }

  boot();
}());
