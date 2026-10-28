#!/usr/bin/env node
/** Explicit, local-only PhiARK intelligence commands. No remote APIs or server routes. */
import { importIntelligence, listIntelligence, verifyIntelligence, exportIntelligence } from './intelligence.mjs';
import { vaultRoot } from './vault.mjs';

const [command='help',...args]=process.argv.slice(2);
const needed=(i,name)=>{
  if (!args[i] || args[i].startsWith('--')) throw new Error('Missing '+name+'; use npm run intel -- help');
  return args[i];
};
async function main(){
  let output;
  switch(command){
    case 'import':
      output=await importIntelligence({
        packPath:needed(0,'local pack path'),manifestPath:needed(1,'detached signature path'),
        trustPath:needed(2,'independently pinned trust file'),
        approved:args[3]==='--i-approve-import',root:vaultRoot()
      }); break;
    case 'list':
      output={entries:await listIntelligence(),warning:'Catalog metadata is not fresh verification'};
      break;
    case 'verify':
      output=await verifyIntelligence(needed(0,'local trust file'));
      if (output.checked===0 || output.passed!==output.checked) process.exitCode=1;
      break;
    case 'export':
      output=await exportIntelligence({
        id:needed(0,'pack SHA-256'),destination:needed(1,'new destination directory'),
        trustPath:needed(2,'local trust file'),approved:args[3]==='--i-approve-export'
      }); break;
    case 'help':
      console.log([
        'PhiARK R0.7 | Sentinel Offline Intelligence Vault',
        '  npm run intel -- import ./pack.json ./pack.sig.json ./my-trust.json --i-approve-import',
        '  npm run intel -- list',
        '  npm run intel -- verify ./my-trust.json',
        '  npm run intel -- export <pack-sha256> /path/to/NEW-export-directory ./my-trust.json --i-approve-export',
        '',
        'Set PHIARK_DATA_DIR outside the repository for the local vault.',
        'No automatic downloads, uploads, elevated privileges, or trust-root enrollment.',
        'Trust roots are supplied independently on every import/verification/export.',
        'Signed provenance does not establish indicator accuracy or device safety.'
      ].join('\n'));
      return;
    default: throw new Error('Unknown intel command: '+command);
  }
  console.log(JSON.stringify(output,null,2));
}
main().catch(e=>{console.error('PhiARK intelligence:',e.message);process.exitCode=2;});
