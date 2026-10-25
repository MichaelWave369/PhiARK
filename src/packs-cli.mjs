#!/usr/bin/env node
import { bindSlot, exportPack, listPacks, planPack, restoreSnapshot, verifySnapshot, verifyZim } from './packs.mjs';

const [cmd = 'help', ...args] = process.argv.slice(2);
function required(i, description) {
  if (!args[i] || args[i].startsWith('--')) throw new Error('Missing ' + description + '; run npm run packs -- help');
  return args[i];
}
async function main() {
  let answer;
  switch (cmd) {
    case 'list':
      answer = await listPacks();
      break;
    case 'plan':
      answer = await planPack(required(0, 'pack id'));
      break;
    case 'bind':
      answer = await bindSlot({ id: required(0,'pack id'), slotId: required(1,'slot id'), digest: required(2,'document digest') });
      break;
    case 'export':
      answer = await exportPack(required(0,'pack id'), required(1,'new export directory'));
      break;
    case 'verify':
      answer = await verifySnapshot(required(0,'export directory'));
      if (!answer.ok) process.exitCode = 1;
      break;
    case 'restore':
      if (args[2] !== '--i-approve-new-vault') throw new Error('Restore requires --i-approve-new-vault; target must not exist');
      answer = await restoreSnapshot(required(0, 'verified export directory'), required(1, 'new vault data directory'));
      break;
    case 'zim-check':
      answer = await verifyZim(required(0,'ZIM file'), required(1,'official publisher SHA-256 digest'));
      if (!answer.matches) process.exitCode = 1;
      break;
    case 'help':
      console.log(`PhiARK R0.3 knowledge packs (local-only; no automatic downloads)

  npm run packs -- list
  npm run packs -- plan essential-field-r01
  npm run vault -- list
  npm run packs -- bind essential-field-r01 readiness-plan <document-sha256>
  npm run packs -- export essential-field-r01 /path/to/new/snapshot
  npm run packs -- verify /path/to/snapshot
  npm run packs -- restore /path/to/snapshot /path/to/NEW-vault --i-approve-new-vault
  npm run packs -- zim-check /path/to/downloaded.zim <official-Kiwix-sha256>

Notes:
- Each slot requires manual selection of a real imported local document.
- A verified hash is never an approval of contents, licensing or provenance.
- Export/restore refuse to overwrite an existing destination.
- ZIM check does not install Kiwix, import a channel, or contact the network.
- Keep any private personal data off public GitHub Pages.
`);
      return;
    default:
      throw new Error('Unknown packs command: ' + cmd);
  }
  console.log(JSON.stringify(answer, null, 2));
}
main().catch(e => { console.error('PhiARK pack error:', e.message); process.exitCode = 1; });
