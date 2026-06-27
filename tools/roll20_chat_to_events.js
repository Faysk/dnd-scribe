#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const {
  parseRoll20ChatText,
  normalizeRoll20Events,
  summarizeRoll20Events
} = require('../lib/roll20-commands');

function parseArgs(argv) {
  const args = {
    input: '',
    prefix: '!dnd',
    campaignSlug: 'yuhara-main',
    summary: false
  };

  for (let index = 2; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === '--summary') {
      args.summary = true;
      continue;
    }
    if (value === '--prefix') {
      args.prefix = argv[index + 1] || args.prefix;
      index += 1;
      continue;
    }
    if (value === '--campaign') {
      args.campaignSlug = argv[index + 1] || args.campaignSlug;
      index += 1;
      continue;
    }
    if (!args.input) args.input = value;
  }

  return args;
}

function readInput(input) {
  if (!input || input === '-') return fs.readFileSync(0, 'utf8');
  return fs.readFileSync(input, 'utf8');
}

function main() {
  const args = parseArgs(process.argv);
  const text = readInput(args.input);
  const parsed = parseRoll20ChatText(text, { prefix: args.prefix });
  const events = normalizeRoll20Events(parsed, { campaignSlug: args.campaignSlug });
  const payload = args.summary ? summarizeRoll20Events(events) : events;
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main();
