// DnD Scribe Roll20 Logger v3 — exemplo conceitual
// Objetivo do MVP: escrever eventos estruturados no chat para importar depois.
// Uso: !dnd scene Praça do Duelo
//      !dnd canon-candidate O povo começou a cantar baixo
//      !dnd secret shared renan,fernanda Sinal secreto para iniciar performance
//      !dnd quote Dandelion: esquecer não é o mesmo que matar

on('chat:message', function(msg) {
  if (msg.type !== 'api') return;
  if (!msg.content.startsWith('!dnd')) return;

  const raw = msg.content.replace('!dnd', '').trim();
  const parts = raw.split(' ');
  const command = parts.shift() || 'note';
  const payload = parts.join(' ');

  const event = {
    source: 'roll20',
    command,
    payload,
    who: msg.who,
    playerid: msg.playerid,
    timestamp: Date.now(),
    note: 'Importar este JSON no DnD Scribe após a sessão.'
  };

  sendChat('DnD Scribe', '/w gm [DND_EVENT] ' + JSON.stringify(event));
});
