'use strict';

const DEFAULT_PREFIX = '!dnd';
const DEFAULT_CAMPAIGN = 'yuhara-main';
const KNOWN_COMMANDS = new Set(['sessao', 'acao', 'canon', 'dm', 'audio', 'chat', 'roll']);

function cleanText(value, max = 500) {
  const text = String(value || '').trim();
  return text ? text.slice(0, max) : '';
}

function parseClockSeconds(value) {
  const text = cleanText(value, 40);
  const match = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3] || 0);
  if (hours > 23 || minutes > 59 || seconds > 59) return null;
  return hours * 3600 + minutes * 60 + seconds;
}

function parseOffsetMs(value) {
  const text = cleanText(value, 80).toLowerCase();
  if (!text) return null;
  const clock = parseClockSeconds(text);
  if (clock !== null) return clock * 1000;
  const match = text.match(/^(\d+(?:[.,]\d+)?)(ms|s|m|h)?$/);
  if (!match) return null;
  const amount = Number(match[1].replace(',', '.'));
  const unit = match[2] || 's';
  if (!Number.isFinite(amount)) return null;
  if (unit === 'ms') return Math.round(amount);
  if (unit === 's') return Math.round(amount * 1000);
  if (unit === 'm') return Math.round(amount * 60 * 1000);
  if (unit === 'h') return Math.round(amount * 60 * 60 * 1000);
  return null;
}

function parseLeadingClock(rawLine) {
  const raw = String(rawLine || '');
  const match = raw.match(/^\s*\[?(\d{1,2}:\d{2}(?::\d{2})?)\]?\s+/);
  if (!match) return { rawLine: raw, lineClock: null, lineClockSeconds: null, lineWithoutClock: raw.trimStart() };
  const lineClock = match[1];
  return {
    rawLine: raw,
    lineClock,
    lineClockSeconds: parseClockSeconds(lineClock),
    lineWithoutClock: raw.slice(match[0].length)
  };
}

function clockDeltaMs(lineClockSeconds, syncStartClock) {
  const startSeconds = parseClockSeconds(syncStartClock);
  if (lineClockSeconds === null || startSeconds === null) return null;
  let delta = lineClockSeconds - startSeconds;
  if (delta < 0) delta += 24 * 60 * 60;
  return delta * 1000;
}

function splitRoll20Speaker(line, prefix = DEFAULT_PREFIX) {
  const rawLine = String(line || '').trimEnd();
  const clock = parseLeadingClock(rawLine);
  const body = clock.lineWithoutClock;
  const prefixIndex = body.indexOf(prefix);
  const beforePrefix = prefixIndex >= 0 ? body.slice(0, prefixIndex).trim() : body;
  const colon = beforePrefix.indexOf(':');
  const speakerSource = colon >= 0 && colon <= 120 ? beforePrefix.slice(0, colon) : beforePrefix;
  const message = prefixIndex >= 0
    ? body.slice(prefixIndex).trim()
    : (colon >= 0 && colon <= 120 ? body.slice(colon + 1).trim() : body.trim());
  const speaker = speakerSource.replace(/:\s*$/, '').trim();

  return {
    speaker: speaker && speaker.length <= 80 ? speaker : null,
    message,
    lineClock: clock.lineClock,
    lineClockSeconds: clock.lineClockSeconds
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

  const { speaker, message, lineClock, lineClockSeconds } = splitRoll20Speaker(rawLine, prefix);
  const rawCommand = message.slice(message.indexOf(prefix) + prefix.length).trim();
  if (!rawCommand) {
    return {
      sourceKind: 'chat_command',
      speaker,
      command: '',
      args: {},
      positional: [],
      rawCommand,
      rawLine,
      lineClock,
      lineClockSeconds,
      approxStartMs: clockDeltaMs(lineClockSeconds, options.syncStartClock),
      valid: false,
      error: 'missing command after prefix'
    };
  }

  try {
    const tokens = tokenizeCommand(rawCommand);
    if (!tokens.length) throw new Error('empty command');
    const { args, positional } = parseCommandArgs(tokens.slice(1));
    const explicitOffset = parseOffsetMs(args.t || args.time || args.tempo || args.offset || args.timestamp);
    return {
      sourceKind: 'chat_command',
      speaker,
      command: cleanText(tokens[0], 80).toLowerCase(),
      args,
      positional,
      rawCommand,
      rawLine,
      lineClock,
      lineClockSeconds,
      approxStartMs: explicitOffset ?? clockDeltaMs(lineClockSeconds, options.syncStartClock),
      valid: true,
      error: null
    };
  } catch (error) {
    return {
      sourceKind: 'chat_command',
      speaker,
      command: '',
      args: {},
      positional: [],
      rawCommand,
      rawLine,
      lineClock,
      lineClockSeconds,
      approxStartMs: clockDeltaMs(lineClockSeconds, options.syncStartClock),
      valid: false,
      error: error.message
    };
  }
}

function looksLikeRoll20Roll(message) {
  const text = String(message || '').toLowerCase();
  return /\b\d+d\d+\b/.test(text)
    || text.includes('[[')
    || /\b(roll|rolling|rolled|rolagem|rola|dado|dados|dice|resultado)\b/.test(text);
}

function parseRoll20DiceRoll(message) {
  const raw = cleanText(message, 2000);
  if (!raw) return null;
  const inline = [...raw.matchAll(/\[\[([^\]]{1,240})\]\]/g)]
    .map(match => cleanText(match[1], 240))
    .filter(Boolean);
  const formulaMatch = raw.match(/\b(\d+d\d+(?:\s*(?:kh|kl|dh|dl|ro|r)?[<>=]?\d+)?(?:\s*[+\-*/]\s*(?:\d+d\d+|\d+))*)\b/i);
  const formula = inline[0] || cleanText(formulaMatch?.[1] || '', 240);
  const equalsMatch = raw.match(/(?:=|resultado(?:\s+final)?|result|total|rolled|rolou|rola(?:gem)?)[^\d-]*(-?\d+)\b/i);
  const trailingNumber = formula ? null : raw.match(/(-?\d+)\s*$/);
  const result = equalsMatch ? Number(equalsMatch[1]) : (trailingNumber ? Number(trailingNumber[1]) : null);
  const diceTerms = [...raw.matchAll(/\b(\d+)d(\d+)\b/gi)].map(match => ({
    count: Number(match[1]),
    sides: Number(match[2]),
    notation: `${match[1]}d${match[2]}`
  }));
  if (!formula && !diceTerms.length && result === null) return null;
  const d20 = diceTerms.find(term => term.sides === 20);
  return {
    raw,
    formula: formula || null,
    result: Number.isFinite(result) ? result : null,
    dice: diceTerms,
    hasD20: Boolean(d20),
    criticalHint: d20 && Number.isFinite(result) && (result === 20 || result === 1)
      ? (result === 20 ? 'possible_critical_success' : 'possible_critical_failure')
      : null
  };
}

function parseRoll20PlainLine(line, options = {}) {
  const rawLine = String(line || '').replace(/\r?\n$/, '');
  if (!rawLine.trim()) return null;
  const { speaker, message, lineClock, lineClockSeconds } = splitRoll20Speaker(rawLine, options.prefix || DEFAULT_PREFIX);
  const isRoll = looksLikeRoll20Roll(message);
  if (!options.includePlain && !(options.includeRolls && isRoll)) return null;
  return {
    sourceKind: isRoll ? 'dice_roll' : 'chat_message',
    speaker,
    command: isRoll ? 'roll' : 'chat',
    args: {},
    positional: [],
    rawCommand: '',
    rawLine,
    rawMessage: message,
    lineClock,
    lineClockSeconds,
    approxStartMs: clockDeltaMs(lineClockSeconds, options.syncStartClock),
    diceRoll: isRoll ? parseRoll20DiceRoll(message) : null,
    valid: true,
    error: null
  };
}

function parseRoll20ChatText(text, options = {}) {
  return String(text || '')
    .split(/\r?\n/)
    .map((line, index) => {
      const parsed = parseRoll20CommandLine(line, options) || parseRoll20PlainLine(line, options);
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
  if (command === 'chat' || command === 'roll') return 'table_private';
  return 'table_review';
}

function normalizeRoll20Event(parsed, options = {}) {
  const command = cleanText(parsed?.command, 80).toLowerCase();
  const valid = Boolean(parsed?.valid);
  const known = KNOWN_COMMANDS.has(command);
  const campaignSlug = cleanText(options.campaignSlug, 120) || DEFAULT_CAMPAIGN;
  const receivedAt = options.receivedAt || new Date().toISOString();
  const sourceKind = parsed?.sourceKind || 'chat_command';
  const eventType = sourceKind === 'chat_message'
    ? 'roll20_chat_message'
    : (sourceKind === 'dice_roll' ? 'roll20_dice_roll' : (valid ? eventTypeForCommand(command) : 'invalid_roll20_command'));

  return {
    source: 'roll20',
    sourceKind,
    campaignSlug,
    eventType,
    command,
    knownCommand: known,
    status: valid ? 'pending_review' : 'invalid',
    visibility: valid ? visibilityForCommand(command) : 'dm_review',
    needsDmReview: sourceKind !== 'chat_message',
    lineNo: parsed?.lineNo || null,
    speaker: cleanText(parsed?.speaker, 120) || null,
    args: parsed?.args || {},
    positional: Array.isArray(parsed?.positional) ? parsed.positional : [],
    text: cleanText(parsed?.args?.texto || parsed?.args?.text || parsed?.args?.descricao || parsed?.rawMessage || '', 2000),
    targetCharacter: cleanText(parsed?.args?.personagem || parsed?.args?.character || '', 180) || null,
    noteType: cleanText(parsed?.args?.tipo || parsed?.args?.type || '', 80) || null,
    markerState: cleanText(parsed?.args?.estado || parsed?.args?.state || '', 80) || null,
    priority: cleanText(parsed?.args?.prioridade || parsed?.args?.priority || '', 40) || null,
    diceRoll: parsed?.diceRoll || (sourceKind === 'dice_roll' ? parseRoll20DiceRoll(parsed?.rawMessage || parsed?.rawLine || '') : null),
    lineClock: parsed?.lineClock || null,
    lineClockSeconds: parsed?.lineClockSeconds ?? null,
    approxStartMs: parsed?.approxStartMs ?? null,
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
    diceRolls: 0,
    byCommand: {},
    byEventType: {},
    byVisibility: {}
  };

  for (const event of events) {
    if (event.valid === false || event.status === 'invalid') summary.invalid += 1;
    else summary.valid += 1;
    if (event.diceRoll) summary.diceRolls += 1;

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
  parseClockSeconds,
  parseCommandArgs,
  parseOffsetMs,
  parseRoll20ChatText,
  parseRoll20CommandLine,
  parseRoll20DiceRoll,
  normalizeRoll20Event,
  normalizeRoll20Events,
  summarizeRoll20Events,
  splitRoll20Speaker,
  tokenizeCommand
};
