/*
 * DnD Logger — Roll20 Mod Script MVP
 *
 * Objetivo:
 * Registrar eventos estruturados no chat do Roll20 para export posterior.
 *
 * Uso:
 * !ys start 2026-06-27_sessao-XX
 * !ys scene Praça do Duelo
 * !ys canon Ivory aceitou duelo público contra Screaky
 * !ys quote Dandelion: esquecer não é o mesmo que matar
 * !ys ooc piada boa da mesa
 * !ys combat start
 * !ys combat end
 * !ys sync Sessão iniciada oficialmente
 */

const DnD = {
  stateKey: 'DnDLogger',
  prefix: '!ys',
  marker: '[DnD_EVENT]'
};

on('ready', () => {
  state[DnD.stateKey] = state[DnD.stateKey] || {
    sessionId: null,
    startedAt: null,
    eventCount: 0
  };
  log('DnD Logger loaded. Use !ys help');
});

function emitDnDEvent(type, msg, payload = {}) {
  const st = state[DnD.stateKey];
  st.eventCount += 1;

  const event = {
    v: 1,
    n: st.eventCount,
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
  !ys start &lt;session_id&gt;<br>
  !ys end<br>
  !ys sync &lt;text&gt;<br>
  !ys scene &lt;name&gt;<br>
  !ys canon &lt;text&gt;<br>
  !ys quote &lt;character&gt;: &lt;text&gt;<br>
  !ys ooc &lt;text&gt;<br>
  !ys cut &lt;text&gt;<br>
  !ys doubt &lt;text&gt;<br>
  !ys npc &lt;name&gt; &lt;note&gt;<br>
  !ys item &lt;name&gt; &lt;note&gt;<br>
  !ys hook &lt;text&gt;<br>
  !ys combat start|end<br>
  !ys break<br>
  !ys back`);
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
      else sendChat('DnD Logger', '/w gm Use: !ys combat start ou !ys combat end');
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
