#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { importDocument, readCatalog, verifyVault, vaultRoot } from './vault.mjs';

const args = process.argv.slice(2);
const command = args.shift() || 'help';
const flags = {};
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) {
    const k = args[i].slice(2);
    flags[k] = args[++i];
  }
}
async function main() {
  if (command === 'add') {
    const filename = args.find((a) => !a.startsWith('--'));
    if (!filename) throw new Error('Usage: npm run vault -- add ./manual.pdf --title "Manual" --subject water');
    const { entry, imported } = await importDocument({
      filename, title: flags.title, subject: flags.subject || 'other',
      author: flags.author, source: flags.source, license: flags.license, safety: flags.safety
    });
    console.log(JSON.stringify({ imported, id: entry.id, title: entry.title }, null, 2));
  } else if (command === 'list') {
    console.log(JSON.stringify(await readCatalog(), null, 2));
  } else if (command === 'verify') {
    const report = await verifyVault();
    console.log(JSON.stringify(report, null, 2));
    if (report.passed !== report.checked) process.exitCode = 1;
  } else if (command === 'status') {
    const docs = await readCatalog();
    console.log(JSON.stringify({ root: vaultRoot(), documents: docs.length, physicallyDownloaded: docs.length }, null, 2));
  } else if (command === 'sources') {
    const file = join(dirname(fileURLToPath(import.meta.url)), '..', 'catalog', 'sources.json');
    console.log(await readFile(file, 'utf8'));
  } else if (command === 'help') {
    console.log(`PhiARK Knowledge Vault R0.1
  npm start
  npm run vault -- add ./guide.pdf --title "Guide" --subject water --author "Publisher" --source "https://example.org/guide" --license "check terms" --safety safety-critical
  npm run vault -- list
  npm run vault -- verify
  npm run vault -- status
  npm run vault -- sources

All imports are explicit local files. No command auto-downloads or launches scripts.
Set PHIARK_DATA_DIR to a folder outside the repository for removable-drive storage.`);
  } else {
    throw new Error('Unknown command: ' + command);
  }
}
main().catch((error) => { console.error('PhiARK:', error.message); process.exitCode = 1; });
