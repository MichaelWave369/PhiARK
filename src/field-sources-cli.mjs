#!/usr/bin/env node
import { describeFieldSource, fieldCoverage, listFieldSourceLeads } from './field-sources.mjs';
import { planPack } from './packs.mjs';
import { previewCodeBoundFieldbook, importCodeBoundSkill } from './codebound-bridge.mjs';

const [command = 'help', argument, slot, approval] = process.argv.slice(2);
async function main() {
  let result;
  if (command === 'sources') result = await listFieldSourceLeads();
  else if (command === 'detail') {
    if (!argument) throw new Error('Usage: npm run field -- detail <archive-item-id>');
    result = await describeFieldSource(argument);
  } else if (command === 'coverage') result = await fieldCoverage();
  else if (command === 'plan') result = await planPack('field-skills-r01');
  else if (command === 'codebound-preview') {
    if (!argument || slot) throw new Error('Usage: npm run field -- codebound-preview ./fieldbook.json');
    result = await previewCodeBoundFieldbook(argument);
  } else if (command === 'codebound-import') {
    if (!argument || !slot || approval !== '--i-approve-import') {
      throw new Error('Usage: npm run field -- codebound-import ./fieldbook.json <slot> --i-approve-import');
    }
    result = await importCodeBoundSkill({filename:argument,slot,approved:true});
  }
  else if (command === 'help') {
    console.log(`PhiARK eight-field-skills offline source registry
  npm run field -- sources             List six Archive discovery candidates (metadata only)
  npm run field -- detail <item-id>   Show the original source details and caveats
  npm run field -- coverage            Map eight pack slots to possible external sources
  npm run field -- plan                Report actual local, digest-verified pack selections
  npm run field -- codebound-preview ./fieldbook.json
                                     Preview the eight CodeBound guides with no writes
  npm run field -- codebound-import ./fieldbook.json water --i-approve-import
                                     Import ONE first-party guide as Markdown into the private vault

To preserve a reviewed, legally acquired individual guide:
  npm run vault -- add /path/to/guide.pdf --title "Exact title" --subject water --author "Author" --source "https://source.example/item" --license "terms to verify" --safety safety-critical
  npm run vault -- list
  npm run packs -- bind field-skills-r01 water <actual-digest>
  npm run packs -- export field-skills-r01 /path/to/new/export

CodeBound imports require explicit approval and do not automatically bind pack slots.\nNo command here downloads archives, extracts ZIPs, approves medical/technical methods, or confers redistribution rights.`);
    return;
  } else throw new Error('Unknown field command: ' + command);
  console.log(JSON.stringify(result, null, 2));
}
main().catch(error => { console.error('PhiARK field sources:', error.message); process.exitCode = 1; });
