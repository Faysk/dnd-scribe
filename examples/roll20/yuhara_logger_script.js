/*
 * DnD Logger — Roll20 Mod Script MVP
 *
 * Objetivo:
 * Registrar eventos estruturados no chat do Roll20 para export posterior.
 *
 * Uso:
 * !dnd start 2026-06-27_sessao-XX
 * !dnd scene Praça do Duelo
 * !dnd canon Ivory aceitou duelo público contra Screaky
 * !dnd quote Dandelion: esquecer não é o mesmo que matar
 * !dnd ooc piada boa da mesa
 * !dnd combat start
 * !dnd combat end
 * !dnd sync Sessão iniciada oficialmente
 */

const DnD = {
  stateKey: 'DnDLogger',
  prefix: '!dnd',
  marker: '[DND_EVENT]'
};

on('ready', () => {
  state[DnD.stateKey] = state[DnD.stateKey] || {
    sessionId: null,
    startedAt: null,
    eventCount: 0
  };
  log('DnD Logger loaded. Use !dnd help');
});

function emitDnDEvent(type, msg, payload = {}) {
  const st = state[DnD.stateKey];
  st.eventCount += 1;

  const event = {
    v: 1,
    n: st.eventCount,
    source_system: 'roll20',
    source_event_id: `${st.sessionId || 'no-session'}:${st.eventCount}`,
    session_id: st.sessionId,
    type,
    who: msg.who,
    playerid: msg.playerid,
    content: payload.text || '',
    payload,
    created_at_roll20: new Date().toISOString()
  };

  sendChat('DnD Logger', `/w gm ${DnD.marker} ${JSON.stringify(event)}`);
}

function help() {
  sendChat('DnD Logger', `/w gm <b>DnD Logger</b><br>
  !dnd start &lt;session_id&gt;<br>
  !dnd end<br>
  !dnd sync &lt;text&gt;<br>
  !dnd scene &lt;name&gt;<br>
  !dnd canon &lt;text&gt;<br>
  !dnd quote &lt;character&gt;: &lt;text&gt;<br>
  !dnd ooc &lt;text&gt;<br>
  !dnd cut &lt;text&gt;<br>
  !dnd doubt &lt;text&gt;<br>
  !dnd npc &lt;name&gt; &lt;note&gt;<br>
  !dnd item &lt;name&gt; &lt;note&gt;<br>
  !dnd hook &lt;text&gt;<br>
  !dnd combat start|end<br>
  !dnd break<br>
  !dnd back`);
}

on('chat:message', (msg) => {
  if (msg.type !== 'api') return;
  if (!msg.content.startsWith(DnD.prefix)) return;

  const args = msg.content.split(' ');
  const command = args[1];
  const rest = args.slice(2).join(' ').trim();
  const st = state[DnD.stateKey];

  switch (command) {
    case 'help':
      help();
      break;

    case 'start':
      st.sessionId = rest || null;
      st.startedAt = new Date().toISOString();
      emitDnDEvent('session_start', msg, { text: rest });
      break;

    case 'end':
      emitDnDEvent('session_end', msg, { text: rest });
      break;

    case 'sync':
      emitDnDEvent('sync', msg, { text: rest });
      break;

    case 'scene':
      emitDnDEvent('scene', msg, { text: rest, label: rest });
      break;

    case 'canon':
      emitDnDEvent('canon_marker', msg, { text: rest });
      break;

    case 'quote':
      emitDnDEvent('quote_marker', msg, { text: rest });
      break;

    case 'ooc':
      emitDnDEvent('ooc_marker', msg, { text: rest });
      break;

    case 'cut':
      emitDnDEvent('cut_marker', msg, { text: rest });
      break;

    case 'doubt':
      emitDnDEvent('doubt_marker', msg, { text: rest });
      break;

    case 'npc':
      emitDnDEvent('npc_marker', msg, { text: rest });
      break;

    case 'item':
      emitDnDEvent('item_marker', msg, { text: rest });
      break;

    case 'hook':
      emitDnDEvent('hook_marker', msg, { text: rest });
      break;

    case 'combat':
      if (rest === 'start') emitDnDEvent('combat_start', msg, { text: rest });
      else if (rest === 'end') emitDnDEvent('combat_end', msg, { text: rest });
      else sendChat('DnD Logger', '/w gm Use: !dnd combat start ou !dnd combat end');
      break;

    case 'break':
      emitDnDEvent('break', msg, { text: rest });
      break;

    case 'back':
      emitDnDEvent('back', msg, { text: rest });
      break;

    default:
      help();
      break;
  }
});

// Captura rolagens gerais como evidência adicional.
on('chat:message', (msg) => {
  if (msg.type === 'rollresult' || msg.type === 'gmrollresult') {
    let parsed = null;
    try { parsed = JSON.parse(msg.content); } catch (e) {}
    emitDnDEvent('roll_result', msg, {
      text: msg.content,
      roll: parsed
    });
  }
});
