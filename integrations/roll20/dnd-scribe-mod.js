// DnD Scribe Roll20 Mod bridge
// Install in Roll20: Game page -> Settings -> Mod (API) Scripts -> New Script.
// The Chrome extension is the primary silent capture path.
// This Mod keeps a legacy chat-packet transport for debugging only.

var DndScribeBridge = DndScribeBridge || (function () {
  'use strict';

  var VERSION = '1.1.0';
  var MARKER = 'DND_SCRIBE_EVENT:';
  var COMMAND = '!dndscribe';
  var MAX_CONTENT = 3500;

  function ensureState() {
    state.DndScribeBridge = state.DndScribeBridge || {
      enabled: false,
      chatTransport: false,
      seq: 0,
      startedAt: new Date().toISOString(),
      version: VERSION
    };
    if (typeof state.DndScribeBridge.enabled !== 'boolean') state.DndScribeBridge.enabled = false;
    if (typeof state.DndScribeBridge.chatTransport !== 'boolean') state.DndScribeBridge.chatTransport = false;
    if (typeof state.DndScribeBridge.seq !== 'number') state.DndScribeBridge.seq = 0;
    state.DndScribeBridge.version = VERSION;
    return state.DndScribeBridge;
  }

  function trim(value, max) {
    var text = String(value || '');
    return text.length > max ? text.slice(0, max) : text;
  }

  function compactInlineRoll(roll) {
    if (!roll) return null;
    return {
      expression: trim(roll.expression || '', 240),
      results: roll.results ? { total: roll.results.total, type: roll.results.type } : null
    };
  }

  function compactMessage(msg) {
    return {
      who: trim(msg.who || '', 180),
      playerid: trim(msg.playerid || '', 80),
      type: trim(msg.type || '', 40),
      content: trim(msg.content || '', MAX_CONTENT),
      origRoll: trim(msg.origRoll || '', 500),
      rolltemplate: trim(msg.rolltemplate || '', 120),
      target: trim(msg.target || '', 120),
      target_name: trim(msg.target_name || '', 180),
      inlinerolls: (msg.inlinerolls || []).slice(0, 8).map(compactInlineRoll)
    };
  }

  function whisperPacket(packet) {
    var data = ensureState();
    if (!data.enabled || !data.chatTransport) return;
    var encoded = encodeURIComponent(JSON.stringify(packet));
    sendChat(
      'DnD Scribe',
      '/w gm <span style="display:none" data-dnd-scribe-packet="1">' + MARKER + encoded + '</span>',
      null,
      { noarchive: true }
    );
  }

  function status() {
    var data = ensureState();
    sendChat(
      'DnD Scribe',
      '/w gm Ponte Roll20 Mod ' + (data.enabled ? 'ligado' : 'pausado')
        + '. Transporte legado por chat ' + (data.chatTransport ? 'ligado' : 'desligado')
        + '. Seq=' + data.seq + '. Versao=' + VERSION
        + '. Captura principal: extensao Chrome DOM.',
      null,
      { noarchive: true }
    );
  }

  function logState(reason) {
    var data = ensureState();
    log(
      'DnD Scribe Roll20 bridge ' + reason
      + ' | mod=' + (data.enabled ? 'on' : 'off')
      + ' | legacy_chat_transport=' + (data.chatTransport ? 'on' : 'off')
      + ' | seq=' + data.seq
      + ' | v=' + VERSION
    );
  }

  function handleCommand(msg) {
    var content = String(msg.content || '').trim().toLowerCase();
    var data = ensureState();
    if (content === COMMAND || content === COMMAND + ' status') {
      status();
      return true;
    }
    if (content === COMMAND + ' on' || content === COMMAND + ' ligar') {
      data.enabled = true;
      logState('enabled');
      return true;
    }
    if (content === COMMAND + ' off' || content === COMMAND + ' pausar') {
      data.enabled = false;
      data.chatTransport = false;
      logState('disabled');
      return true;
    }
    if (content === COMMAND + ' transport on' || content === COMMAND + ' legacy on') {
      data.enabled = true;
      data.chatTransport = true;
      status();
      return true;
    }
    if (content === COMMAND + ' transport off' || content === COMMAND + ' legacy off') {
      data.chatTransport = false;
      logState('legacy transport disabled');
      return true;
    }
    if (content === COMMAND + ' reset') {
      data.enabled = false;
      data.chatTransport = false;
      data.seq = 0;
      data.startedAt = new Date().toISOString();
      logState('reset');
      return true;
    }
    return false;
  }

  function handleMessage(msg) {
    var data = ensureState();
    if (msg.type === 'api' && String(msg.content || '').indexOf(COMMAND) === 0) {
      handleCommand(msg);
      return;
    }
    if (!data.enabled || !data.chatTransport) return;
    if (msg.who === 'DnD Scribe') return;
    if (String(msg.content || '').indexOf(MARKER) !== -1) return;

    data.seq += 1;
    whisperPacket({
      version: VERSION,
      sourceEventId: 'roll20-mod-' + data.seq,
      seq: data.seq,
      emittedAt: new Date().toISOString(),
      message: compactMessage(msg)
    });
  }

  on('ready', function () {
    ensureState();
    logState('ready');
  });

  on('chat:message', handleMessage);

  return {
    version: VERSION,
    status: status
  };
}());
