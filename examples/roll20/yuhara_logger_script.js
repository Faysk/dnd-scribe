/*
 * Yuhara Logger — Roll20 Mod Script MVP
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

const YUHARA = {
  stateKey: 'YuharaLogger',
  prefix: '!ys',
  marker: '[YUHARA_EVENT]'
};

on('ready', () => {
  state[YUHARA.stateKey] = state[YUHARA.stateKey] || {
    sessionId: null,
    startedAt: null,
    eventCount: 0
  };
  log('Yuhara Logger loaded. Use !ys help');
});

function emitYuharaEvent(type, msg, payload = {}) {
  const st = state[YUHARA.stateKey];
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

  sendChat('Yuhara Logger', `/w gm ${YUHARA.marker} ${JSON.stringify(event)}`);
}

function help() {
  sendChat('Yuhara Logger', `/w gm <b>Yuhara Logger</b><br>
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
  if (!msg.content.startsWith(YUHARA.prefix)) return;

  const args = msg.content.split(' ');
  const command = args[1];
  const rest = args.slice(2).join(' ').trim();
  const st = state[YUHARA.stateKey];

  switch (command) {
    case 'help':
      help();
      break;

    case 'start':
      st.sessionId = rest || null;
      st.startedAt = new Date().toISOString();
      emitYuharaEvent('session_start', msg, { text: rest });
      break;

    case 'end':
      emitYuharaEvent('session_end', msg, { text: rest });
      break;

    case 'sync':
      emitYuharaEvent('sync', msg, { text: rest });
      break;

    case 'scene':
      emitYuharaEvent('scene', msg, { text: rest, label: rest });
      break;

    case 'canon':
      emitYuharaEvent('canon_marker', msg, { text: rest });
      break;

    case 'quote':
      emitYuharaEvent('quote_marker', msg, { text: rest });
      break;

    case 'ooc':
      emitYuharaEvent('ooc_marker', msg, { text: rest });
      break;

    case 'cut':
      emitYuharaEvent('cut_marker', msg, { text: rest });
      break;

    case 'doubt':
      emitYuharaEvent('doubt_marker', msg, { text: rest });
      break;

    case 'npc':
      emitYuharaEvent('npc_marker', msg, { text: rest });
      break;

    case 'item':
      emitYuharaEvent('item_marker', msg, { text: rest });
      break;

    case 'hook':
      emitYuharaEvent('hook_marker', msg, { text: rest });
      break;

    case 'combat':
      if (rest === 'start') emitYuharaEvent('combat_start', msg, { text: rest });
      else if (rest === 'end') emitYuharaEvent('combat_end', msg, { text: rest });
      else sendChat('Yuhara Logger', '/w gm Use: !ys combat start ou !ys combat end');
      break;

    case 'break':
      emitYuharaEvent('break', msg, { text: rest });
      break;

    case 'back':
      emitYuharaEvent('back', msg, { text: rest });
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
    emitYuharaEvent('roll_result', msg, {
      text: msg.content,
      roll: parsed
    });
  }
});
