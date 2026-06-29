// DnD Scribe Roll20 Mod bridge
// Install in Roll20: Game page -> Settings -> Mod (API) Scripts -> New Script.
// It captures Roll20 chat events and whispers compact packets to the GM client.
// The browser bridge reads those packets and posts them to DnD Scribe.

var DndScribeBridge = DndScribeBridge || (function () {
  'use strict';

  var VERSION = '1.0.0';
  var MARKER = 'DND_SCRIBE_EVENT:';
  var COMMAND = '!dndscribe';
  var MAX_CONTENT = 3500;

  function ensureState() {
    state.DndScribeBridge = state.DndScribeBridge || {
      enabled: true,
      seq: 0,
      startedAt: new Date().toISOString()
    };
    if (typeof state.DndScribeBridge.enabled !== 'boolean') state.DndScribeBridge.enabled = true;
    if (typeof state.DndScribeBridge.seq !== 'number') state.DndScribeBridge.seq = 0;
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
    var encoded = encodeURIComponent(JSON.stringify(packet));
    sendChat(
      'DnD Scribe',
      '/w gm /direct <code>' + MARKER + encoded + '</code>',
      null,
      { noarchive: true }
    );
  }

  function status() {
    var data = ensureState();
    sendChat(
      'DnD Scribe',
      '/w gm Ponte Roll20 ' + (data.enabled ? 'ligada' : 'pausada') + '. Seq=' + data.seq + '. Versao=' + VERSION,
      null,
      { noarchive: true }
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
      status();
      return true;
    }
    if (content === COMMAND + ' off' || content === COMMAND + ' pausar') {
      data.enabled = false;
      status();
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
    if (!data.enabled) return;
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
    log('DnD Scribe Roll20 bridge ready v' + VERSION);
  });

  on('chat:message', handleMessage);

  return {
    version: VERSION,
    status: status
  };
}());
