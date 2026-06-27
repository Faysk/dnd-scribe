const DISCORD_API = 'https://discord.com/api/v10';

const TYPE = {
  SUB_COMMAND: 1,
  STRING: 3,
  BOOLEAN: 5,
  MESSAGE_COMMAND: 3
};

const noteTypeChoices = [
  ['Nota', 'note'],
  ['Canon candidato', 'canon'],
  ['NPC', 'npc'],
  ['Local', 'location'],
  ['Item', 'item'],
  ['Bastidor', 'backstage'],
  ['Fala', 'quote'],
  ['Pergunta', 'question']
].map(([name, value]) => ({ name, value }));

const visibilityChoices = [
  ['Review do DM', 'dm_review'],
  ['Privado da mesa', 'table_private'],
  ['Visivel para players', 'player_visible'],
  ['Candidato publico', 'public_candidate']
].map(([name, value]) => ({ name, value }));

function commands() {
  return [
    {
      name: 'dnd',
      description: 'Comandos da mesa no DnD Scribe',
      type: 1,
      dm_permission: false,
      options: [
        {
          type: TYPE.SUB_COMMAND,
          name: 'status',
          description: 'Mostra o status da sessao mais recente no DnD Scribe'
        },
        {
          type: TYPE.SUB_COMMAND,
          name: 'nota',
          description: 'Salva uma nota da mesa para review do DM',
          options: [
            {
              type: TYPE.STRING,
              name: 'texto',
              description: 'Texto da nota, ideia, NPC, fala ou canon candidato',
              required: true,
              max_length: 1800
            },
            {
              type: TYPE.STRING,
              name: 'tipo',
              description: 'Como classificar esta nota',
              required: false,
              choices: noteTypeChoices
            },
            {
              type: TYPE.STRING,
              name: 'visibilidade',
              description: 'Quem deve ver depois do review',
              required: false,
              choices: visibilityChoices
            },
            {
              type: TYPE.STRING,
              name: 'sessao',
              description: 'Source ID da sessao, se quiser apontar uma sessao especifica',
              required: false,
              max_length: 180
            }
          ]
        },
        {
          type: TYPE.SUB_COMMAND,
          name: 'vincular',
          description: 'Mostra seu Discord ID e o fluxo para vincular ao perfil da mesa'
        }
      ]
    },
    {
      name: 'Salvar no DnD Scribe',
      type: TYPE.MESSAGE_COMMAND,
      dm_permission: false
    }
  ];
}

async function main() {
  const applicationId = process.env.DISCORD_APPLICATION_ID || process.env.DISCORD_CLIENT_ID;
  const guildId = process.env.DISCORD_GUILD_ID;
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!applicationId || !guildId || !token) {
    throw new Error('Configure DISCORD_APPLICATION_ID, DISCORD_GUILD_ID e DISCORD_BOT_TOKEN.');
  }

  const url = `${DISCORD_API}/applications/${applicationId}/guilds/${guildId}/commands`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands())
  });
  const body = await response.json().catch(async () => ({ raw: await response.text() }));
  if (!response.ok) {
    throw new Error(`Discord command registration failed (${response.status}): ${JSON.stringify(body)}`);
  }
  console.log(JSON.stringify({ ok: true, registered: body.length, commands: body.map(item => item.name) }, null, 2));
}

main().catch(error => {
  console.error(error.message || String(error));
  process.exit(1);
});
