'use strict';

const DEFAULT_PREFIX = '!dnd';
const DEFAULT_CAMPAIGN = 'yuhara-main';
const KNOWN_COMMANDS = new Set(['sessao', 'acao', 'canon', 'dm', 'audio']);

function cleanText(value, max = 500) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
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

function parseRoll20CommandLine(line, options = {}) {
  const prefix = options.prefix || DEFAULT_PREFIX;
  const rawLine = String(line || '').replace(/\r?\n$/, '');
  if (!rawLine.includes(prefix)) return null;

  const { speaker, message } = splitRoll20Speaker(rawLine, prefix);
  const rawCommand = message.slice(message.indexOf(prefix) + prefix.length).trim();
  if (!rawCommand) {
    return {
      speaker,
      command: '',
      args: {},
      positional: [],
      rawCommand,
      rawLine,
      valid: false,
      error: 'missing command after prefix'
    };
  }

  try {
    const tokens = tokenizeCommand(rawCommand);
    if (!tokens.length) throw new Error('empty command');
    const { args, positional } = parseCommandArgs(tokens.slice(1));
    return {
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
    return {
      speaker,
      command: '',
      args: {},
      positional: [],
      rawCommand,
      rawLine,
      valid: false,
      error: error.message
    };
  }
}

function parseRoll20ChatText(text, options = {}) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line, index) => {
      const parsed = parseRoll20CommandLine(line, options);
      return parsed ? { lineNo: index + 1, ...parsed } : null;
    })
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

function normalizeRoll20Event(parsed, options = {}) {
  const command = cleanText(parsed?.command, 80).toLowerCase();
  const valid = Boolean(parsed?.valid);
  const known = KNOWN_COMMANDS.has(command);
  const campaignSlug = cleanText(options.campaignSlug, 120) || DEFAULT_CAMPAIGN;
  const receivedAt = options.receivedAt || new Date().toISOString();

  return {
    source: 'roll20',
    sourceKind: 'chat_command',
    campaignSlug,
    eventType: valid ? eventTypeForCommand(command) : 'invalid_roll20_command',
    command,
    knownCommand: known,
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
    error: parsed?.error || null,
    receivedAt
  };
}

function normalizeRoll20Events(events, options = {}) {
  return events.map(event => normalizeRoll20Event(event, options));
}

function summarizeRoll20Events(events) {
  const summary = {
    total: events.length,
    valid: 0,
    invalid: 0,
    byCommand: {},
    byEventType: {},
    byVisibility: {}
  };

  for (const event of events) {
    if (event.valid === false || event.status === 'invalid') summary.invalid += 1;
    else summary.valid += 1;

    const command = event.command || 'invalid';
    const eventType = event.eventType || eventTypeForCommand(command);
    const visibility = event.visibility || visibilityForCommand(command);
    summary.byCommand[command] = (summary.byCommand[command] || 0) + 1;
    summary.byEventType[eventType] = (summary.byEventType[eventType] || 0) + 1;
    summary.byVisibility[visibility] = (summary.byVisibility[visibility] || 0) + 1;
  }

  return summary;
}

module.exports = {
  DEFAULT_PREFIX,
  parseCommandArgs,
  parseRoll20ChatText,
  parseRoll20CommandLine,
  normalizeRoll20Event,
  normalizeRoll20Events,
  summarizeRoll20Events,
  splitRoll20Speaker,
  tokenizeCommand
};
