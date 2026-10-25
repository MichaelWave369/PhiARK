#!/usr/bin/env node
import { acquireArchive, importArchive, inventory, listSelections, verifyInstalled } from './kiwix.mjs';
const [command = 'help', ...args] = process.argv.slice(2);
const required = (i, what) => {
  if (!args[i] || args[i].startsWith('--')) throw new Error('Missing ' + what + '. Run npm run kiwix -- help');
  return args[i];
};
async function main() {
  let result;
  switch (command) {
    case 'list':
    case 'plan': result = await listSelections(); break;
    case 'inventory': result = await inventory(); break;
    case 'verify':
      result = await verifyInstalled(required(0, 'selection ID'));
      if (result.status !== 'CHECKSUM_MATCHED') process.exitCode = 1;
      break;
    case 'import':
      result = await importArchive({
        id: required(0, 'selection ID'), zimFile: required(1, 'local ZIM path'),
        checksumFile: required(2, 'local .sha256 sidecar path')
      }); break;
    case 'acquire':
      if (args[1] !== '--i-approve-download') throw new Error('Network acquisition requires explicit --i-approve-download');
      result = await acquireArchive(required(0, 'selection ID'), { approved: true });
      break;
    case 'help':
      console.log([
        'PhiARK R0.4 Kiwix intake (official English ZIM selections)',
        'npm run kiwix -- list',
        'npm run kiwix -- inventory',
        'npm run kiwix -- acquire chemistry --i-approve-download',
        'npm run kiwix -- import chemistry /path/to/EXACT.zim /path/to/EXACT.zim.sha256',
        'npm run kiwix -- verify chemistry',
        'Acquisition is opt-in; official Kiwix hosts/paths only. Unknown redirects are refused.',
        'Manual alternative: download archive AND official sidecar, then run import.',
        'Limit: 1 GiB per ZIM. No overwrite, no content/license certification.',
        'Kiwix reader is a separate installation; PHIARK_DATA_DIR controls storage.'
      ].join('\n')); return;
    default: throw new Error('Unknown Kiwix command: ' + command);
  }
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error('PhiARK Kiwix:', error.message); process.exitCode = 1; });
