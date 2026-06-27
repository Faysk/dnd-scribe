const fs = require('fs');
const path = require('path');

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

function stripBom(value) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function parseEnvValue(rawValue) {
  const value = rawValue.trim();
  const quote = value[0];
  if ((quote === '"' || quote === "'") && value.endsWith(quote)) {
    const unquoted = value.slice(1, -1);
    if (quote === '"') {
      return unquoted
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
    }
    return unquoted;
  }
  return value;
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const raw = stripBom(fs.readFileSync(filePath, 'utf8'));
  for (const line of raw.split(/\r?\n/)) {
    const cleaned = line.trim();
    if (!cleaned || cleaned.startsWith('#')) continue;
    const match = cleaned.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (process.env[key] !== undefined) continue;
    process.env[key] = parseEnvValue(rawValue);
  }
  return true;
}

function loadLocalEnv() {
  const root = path.resolve(__dirname, '..');
  return ['.env.local', '.env']
    .map(fileName => path.join(root, fileName))
    .filter(loadEnvFile)
    .map(filePath => path.basename(filePath));
}

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

function requiredEnv() {
  return {
    DISCORD_APPLICATION_ID: process.env.DISCORD_APPLICATION_ID || process.env.DISCORD_CLIENT_ID,
    DISCORD_GUILD_ID: process.env.DISCORD_GUILD_ID,
    DISCORD_BOT_TOKEN: process.env.DISCORD_BOT_TOKEN
  };
}

async function main() {
  const loadedEnvFiles = loadLocalEnv();
  const env = requiredEnv();
  const missing = Object.entries(env)
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length) {
    const loaded = loadedEnvFiles.length ? loadedEnvFiles.join(', ') : 'nenhum arquivo local encontrado';
    throw new Error(
      `Configure ${missing.join(', ')}. O script tentou ler .env.local e .env (${loaded}).`
    );
  }

  const url = `${DISCORD_API}/applications/${env.DISCORD_APPLICATION_ID}/guilds/${env.DISCORD_GUILD_ID}/commands`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bot ${env.DISCORD_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(commands())
  });

  const rawBody = await response.text();
  const body = rawBody ? JSON.parse(rawBody) : [];
  if (!response.ok) {
    throw new Error(`Discord command registration failed (${response.status}): ${JSON.stringify(body)}`);
  }
  console.log(JSON.stringify({ ok: true, registered: body.length, commands: body.map(item => item.name) }, null, 2));
}

main().catch(error => {
  console.error(error.message || String(error));
  process.exit(1);
});
