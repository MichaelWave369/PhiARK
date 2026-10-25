#!/usr/bin/env node
import { inventory } from './kiwix.mjs';
import { planReader, runReader } from './reader.mjs';

const [action = 'help', ...args] = process.argv.slice(2);
const id = args[0];
const flags = new Map();
for (let i = 1; i < args.length; i++) {
  if (!args[i].startsWith('--')) throw new Error('Unexpected argument: ' + args[i]);
  const key = args[i].slice(2);
  if (!['binary','binary-sha256','port','i-approve-launch'].includes(key)) {
    throw new Error('Unrecognized flag: ' + key);
  }
  if (flags.has(key)) throw new Error('Duplicate flag: ' + key);
  if (key === 'i-approve-launch') flags.set(key, true);
  else {
    if (!args[i + 1] || args[i + 1].startsWith('--')) throw new Error('Flag requires a value: ' + key);
    flags.set(key, args[++i]);
  }
}
async function main() {
  if (action === 'help') {
    console.log([
      'PhiARK R0.5 Kiwix reader bridge: local loopback only',
      '',
      'npm run reader -- inventory',
      'npm run reader -- plan chemistry --binary /absolute/path/kiwix-serve --binary-sha256 <SHA256> --port 8181',
      'npm run reader -- start chemistry --binary /absolute/path/kiwix-serve --binary-sha256 <SHA256> --port 8181 --i-approve-launch',
      '',
      'Reader requires a real, previously verified Kiwix ZIM archive and an operator-supplied binary.',
      'Obtain kiwix-serve from a trusted release; verify its SHA-256 independently.',
      'The launcher does NOT download/install a binary, approve source content, open LAN, or grant PhiOS permissions.',
      'Start runs in FOREGROUND. Ctrl+C stops the reader process.',
      'Reader URL is loopback http://127.0.0.1:8181/ by default.'
    ].join('\n'));
    return;
  }
  if (action === 'inventory') {
    if (args.length) throw new Error('inventory accepts no arguments');
    console.log(JSON.stringify(await inventory(), null, 2));
    return;
  }
  if (!['plan', 'start'].includes(action) || !id) throw new Error('Unknown action or missing archive ID. Run npm run reader -- help');
  const params = {
    id, binary: flags.get('binary'), binarySha256: flags.get('binary-sha256'),
    port: flags.get('port') ?? 8181
  };
  if (action === 'plan') {
    if (flags.has('i-approve-launch')) throw new Error('Approval flag only applies to start');
    console.log(JSON.stringify(await planReader(params), null, 2));
    return;
  }
  if (!flags.get('i-approve-launch')) throw new Error('Start requires explicit --i-approve-launch');
  const result = await runReader({ ...params, approve: true });
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error('PhiARK reader:', error.message); process.exitCode = 1; });
