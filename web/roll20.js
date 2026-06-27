const DEFAULT_PREFIX = '!dnd';
const KNOWN_COMMANDS = new Set(['sessao', 'acao', 'canon', 'dm', 'audio']);
const SAMPLE_CHAT = `
[21:04] Dandelion: !dnd sessao estado:inicio titulo:"Estradas de Cinza"
[21:18] Astel: !dnd acao personagem:"Astel" texto:"Investigou o simbolo no altar"
[21:31] GM: !dnd canon tipo:npc texto:"O ferreiro reconhece o selo antigo"
[22:02] GM: !dnd dm tipo:gancho texto:"A testemunha sabe mais do que contou"
[22:40] Dandelion: conversa comum sem comando
[23:05] Feh: !dnd audio prioridade:alta motivo:"Cena importante"
`.trim();

const state = {
  payload: {
    campaignSlug: 'yuhara-main',
    sourceSessionId: '',
    source: 'roll20-copy-paste',
    prefix: DEFAULT_PREFIX,
    summary: { total: 0, valid: 0, invalid: 0, byCommand: {}, byEventType: {}, byVisibility: {} },
    events: []
  }
};

function $(selector) {
  return document.querySelector(selector);
}

function escapeHtml(value = '') {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function cleanText(value, max = 500) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
}

function toast(message) {
  const el = $('#toast');
  el.textContent = message;
  el.classList.remove('hidden');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => el.classList.add('hidden'), 3000);
}

function badge(text, color = '') {
  return `<span class="badge ${color}">${escapeHtml(text)}</span>`;
}

function splitRoll20Speaker(line, prefix = DEFAULT_PREFIX) {
  const rawLine = String(line || '').trimEnd();
  const prefixIndex = rawLine.indexOf(prefix);
  if (prefixIndex < 0) return { speaker: null, message: rawLine };

  const beforePrefix = rawLine.slice(0, prefixIndex).trim();
  const message = rawLine.slice(prefixIndex).trim();
  const speaker = beforePrefix
    .replace(/^\[[^\]]+\]\s*/, '')
    .replace(/:\s*$/, '')
    .trim();

  return {
    speaker: speaker && speaker.length <= 80 ? speaker : null,
    message
  };
}

function tokenizeCommand(value) {
  const input = String(value || '');
  const tokens = [];
  let token = '';
  let quote = '';
  let escaped = false;

  for (const char of input) {
    if (escaped) {
      token += char;
      escaped = false;
      continue;
    }

    if (quote) {
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === quote) {
        quote = '';
        continue;
      }
      token += char;
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (token) {
        tokens.push(token);
        token = '';
      }
      continue;
    }

    token += char;
  }

  if (escaped) token += '\\';
  if (quote) throw new Error(`unterminated ${quote} quote`);
  if (token) tokens.push(token);
  return tokens;
}

function parseCommandArgs(tokens) {
  const args = {};
  const positional = [];

  for (const token of tokens) {
    const separator = token.indexOf(':');
    if (separator <= 0) {
      positional.push(cleanText(token, 240));
      continue;
    }

    const key = token.slice(0, separator).trim();
    const value = token.slice(separator + 1).trim();
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{0,40}$/.test(key)) {
      positional.push(cleanText(token, 240));
      continue;
    }

    args[key] = cleanText(value, 1000);
  }

  return { args, positional: positional.filter(Boolean) };
}

function parseRoll20CommandLine(line, lineNo, prefix = DEFAULT_PREFIX) {
  const rawLine = String(line || '').replace(/\r?\n$/, '');
  if (!rawLine.includes(prefix)) return null;

  const { speaker, message } = splitRoll20Speaker(rawLine, prefix);
  const rawCommand = message.slice(message.indexOf(prefix) + prefix.length).trim();
  if (!rawCommand) {
    return { lineNo, speaker, command: '', args: {}, positional: [], rawCommand, rawLine, valid: false, error: 'missing command after prefix' };
  }

  try {
    const tokens = tokenizeCommand(rawCommand);
    if (!tokens.length) throw new Error('empty command');
    const { args, positional } = parseCommandArgs(tokens.slice(1));
    return {
      lineNo,
      speaker,
      command: cleanText(tokens[0], 80).toLowerCase(),
      args,
      positional,
      rawCommand,
      rawLine,
      valid: true,
      error: null
    };
  } catch (error) {
    return { lineNo, speaker, command: '', args: {}, positional: [], rawCommand, rawLine, valid: false, error: error.message };
  }
}

function parseRoll20ChatText(text, prefix = DEFAULT_PREFIX) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line, index) => parseRoll20CommandLine(line, index + 1, prefix))
    .filter(Boolean);
}

function eventTypeForCommand(command) {
  if (command === 'sessao') return 'session_marker';
  if (command === 'acao') return 'character_action_candidate';
  if (command === 'canon') return 'canon_candidate';
  if (command === 'dm') return 'dm_backstage_note';
  if (command === 'audio') return 'audio_processing_hint';
  return 'raw_roll20_note';
}

function visibilityForCommand(command) {
  if (command === 'dm') return 'dm_only';
  if (command === 'canon') return 'dm_review';
  if (command === 'audio') return 'dm_review';
  return 'table_review';
}

function normalizeRoll20Event(parsed, campaignSlug) {
  const command = cleanText(parsed?.command, 80).toLowerCase();
  const valid = Boolean(parsed?.valid);

  return {
    source: 'roll20',
    sourceKind: 'chat_command',
    campaignSlug,
    eventType: valid ? eventTypeForCommand(command) : 'invalid_roll20_command',
    command,
    knownCommand: KNOWN_COMMANDS.has(command),
    status: valid ? 'pending_review' : 'invalid',
    visibility: valid ? visibilityForCommand(command) : 'dm_review',
    needsDmReview: true,
    lineNo: parsed?.lineNo || null,
    speaker: cleanText(parsed?.speaker, 120) || null,
    args: parsed?.args || {},
    positional: Array.isArray(parsed?.positional) ? parsed.positional : [],
    text: cleanText(parsed?.args?.texto || parsed?.args?.text || parsed?.args?.descricao || '', 2000),
    targetCharacter: cleanText(parsed?.args?.personagem || parsed?.args?.character || '', 180) || null,
    noteType: cleanText(parsed?.args?.tipo || parsed?.args?.type || '', 80) || null,
    markerState: cleanText(parsed?.args?.estado || parsed?.args?.state || '', 80) || null,
    priority: cleanText(parsed?.args?.prioridade || parsed?.args?.priority || '', 40) || null,
    rawCommand: cleanText(parsed?.rawCommand, 2000),
    rawLine: cleanText(parsed?.rawLine, 3000),
    error: parsed?.error || null
  };
}

function summarizeEvents(events) {
  const summary = { total: events.length, valid: 0, invalid: 0, byCommand: {}, byEventType: {}, byVisibility: {} };

  for (const event of events) {
    if (event.status === 'invalid') summary.invalid += 1;
    else summary.valid += 1;
    summary.byCommand[event.command || 'invalid'] = (summary.byCommand[event.command || 'invalid'] || 0) + 1;
    summary.byEventType[event.eventType] = (summary.byEventType[event.eventType] || 0) + 1;
    summary.byVisibility[event.visibility] = (summary.byVisibility[event.visibility] || 0) + 1;
  }

  return summary;
}

function parseForm() {
  const campaignSlug = cleanText($('#campaignSlug').value, 120) || 'yuhara-main';
  const sourceSessionId = cleanText($('#sourceSessionId').value, 180);
  const prefix = cleanText($('#commandPrefix').value, 20) || DEFAULT_PREFIX;
  const parsed = parseRoll20ChatText($('#chatInput').value, prefix);
  const events = parsed.map(event => normalizeRoll20Event(event, campaignSlug));
  state.payload = {
    campaignSlug,
    sourceSessionId: sourceSessionId || null,
    source: 'roll20-copy-paste',
    prefix,
    dryRun: true,
    generatedAt: new Date().toISOString(),
    summary: summarizeEvents(events),
    events
  };
  render();
}

function metric(value, label) {
  return `<div class="metric"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderSummary() {
  const summary = state.payload.summary;
  const commands = Object.entries(summary.byCommand || {})
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, count]) => badge(`${name}: ${count}`, name === 'dm' ? 'gold' : 'blue'))
    .join('');

  $('#summaryPanel').innerHTML = `
    <div class="roll20-metrics">
      ${metric(summary.total, 'eventos')}
      ${metric(summary.valid, 'validos')}
      ${metric(summary.invalid, 'invalidos')}
    </div>
    <div class="roll20-summary-block">
      <span class="label">Comandos</span>
      <div class="badges">${commands || badge('nenhum', 'orange')}</div>
    </div>
    <div class="roll20-summary-block">
      <span class="label">Regra</span>
      <p>O preview nao grava nada. Canon e bastidores continuam dependendo do DM.</p>
    </div>
  `;
}

function renderEvent(event) {
  const title = event.text || event.args?.motivo || event.args?.titulo || event.rawCommand || event.command || 'Comando Roll20';
  const classes = ['roll20-event'];
  if (event.visibility === 'dm_only') classes.push('private');
  if (event.status === 'invalid') classes.push('invalid');

  return `
    <article class="${classes.join(' ')}">
      <div class="roll20-event-main">
        <div>
          <span class="label">Linha ${escapeHtml(event.lineNo || '-')}</span>
          <h3>${escapeHtml(title)}</h3>
        </div>
        <div class="badges">
          ${badge(event.command || 'invalid', event.status === 'invalid' ? 'red' : 'blue')}
          ${badge(event.eventType, event.visibility === 'dm_only' ? 'gold' : 'green')}
          ${badge(event.visibility, event.visibility === 'dm_only' ? 'gold' : 'violet')}
        </div>
      </div>
      <dl>
        <div><dt>Speaker</dt><dd>${escapeHtml(event.speaker || '-')}</dd></div>
        <div><dt>Personagem</dt><dd>${escapeHtml(event.targetCharacter || '-')}</dd></div>
        <div><dt>Tipo</dt><dd>${escapeHtml(event.noteType || event.markerState || event.priority || '-')}</dd></div>
      </dl>
      ${event.error ? `<p class="roll20-error">${escapeHtml(event.error)}</p>` : ''}
      <code>${escapeHtml(event.rawLine)}</code>
    </article>
  `;
}

function renderEvents() {
  $('#resultCount').textContent = `${state.payload.events.length} eventos`;
  $('#eventsList').innerHTML = state.payload.events.map(renderEvent).join('') || '<div class="empty">Nenhum comando encontrado.</div>';
}

function renderJson() {
  $('#jsonOutput').textContent = JSON.stringify(state.payload, null, 2);
}

function render() {
  renderSummary();
  renderEvents();
  renderJson();
}

function copyJson() {
  const text = JSON.stringify(state.payload, null, 2);
  if (navigator.clipboard?.writeText) {
    navigator.clipboard.writeText(text).then(() => toast('JSON copiado.')).catch(() => toast('Nao consegui copiar.'));
    return;
  }
  toast('Clipboard indisponivel neste navegador.');
}

function downloadJson() {
  const blob = new Blob([JSON.stringify(state.payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const session = state.payload.sourceSessionId || 'sem-sessao';
  a.href = url;
  a.download = `roll20-events-${session}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function clearForm() {
  $('#chatInput').value = '';
  state.payload = { ...state.payload, summary: summarizeEvents([]), events: [] };
  render();
}

function boot() {
  $('#roll20Form').addEventListener('submit', event => {
    event.preventDefault();
    parseForm();
  });
  $('#parseBtn').addEventListener('click', parseForm);
  $('#copyJsonBtn').addEventListener('click', copyJson);
  $('#downloadJsonBtn').addEventListener('click', downloadJson);
  $('#clearBtn').addEventListener('click', clearForm);
  $('#sampleBtn').addEventListener('click', () => {
    $('#chatInput').value = SAMPLE_CHAT;
    parseForm();
  });
  render();
}

boot();
