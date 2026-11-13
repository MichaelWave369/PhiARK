// Portable CodeBound eight-skill collection: no server, JavaScript, network or extra packages.
// Input is a locally inspected CodeBound fieldbook.json. Export never binds PhiARK vault slots.
import { createHash } from 'node:crypto';
import { lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { loadCodeBoundFieldbook, renderCodeBoundGuide, SKILL_MAP } from './codebound-bridge.mjs';

const SCHEMA = 'phiark-codebound-portable-v1';
const HEX = /^[a-f0-9]{64}$/;
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const esc = s => String(s).replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const payloadPaths = [
  'README.txt', 'index.html',
  ...SKILL_MAP.flatMap(s => ['guides/'+s.slot+'.html','guides/'+s.slot+'.md'])
].sort();
const knownPaths = [...payloadPaths,'manifest.json','SHA256SUMS.txt'].sort();

function strictFile(info,label) {
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(label+' must be a regular file');
}
function strictDirectory(info,label) {
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error(label+' must be a real directory');
}
async function mustNotExist(path) {
  try {
    await lstat(path);
    throw new Error('Refusing to overwrite existing path: '+path);
  } catch(error) {
    if(error.code!=='ENOENT') throw error;
  }
}
function htmlPage(title,contents) {
  const css=':root{color-scheme:light}body{font:16px/1.55 system-ui,sans-serif;max-width:54rem;margin:auto;padding:1.5rem;color:#172b28;background:#f8faf7}header{border-bottom:2px solid #2f5546;padding-bottom:1rem}h1,h2{line-height:1.15}a{color:#125f46}a:focus-visible{outline:3px solid #125f46}section{padding:1rem 0;border-top:1px solid #c8d5ce}.warning{background:#fff2e5;border-left:4px solid #9b511a;padding:1rem}li{margin:.35rem 0;overflow-wrap:anywhere}code{overflow-wrap:anywhere}@media print{body{padding:0;background:white;color:black}a{color:black}.warning{background:white}section{break-inside:avoid-page}}';
  return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>'+esc(title)+'</title><style>'+css+'</style></head><body>'+contents+'</body></html>\n';
}
const ul = xs => '<ul>'+xs.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ul>';
const ol = xs => '<ol>'+xs.map(v=>'<li>'+esc(v)+'</li>').join('')+'</ol>';
function skillHtml(s,sourceSha256) {
  const g=s.guide;
  return htmlPage('CodeBound: '+g.title,
    '<header><p><a href="../index.html">All eight field skills</a></p><h1>'+esc(g.title)+'</h1>'+
    '<p>'+esc(g.summary)+'</p><p>Original guide: '+esc(s.id)+
    ' | CodeBound review label: '+esc(g.review)+'</p></header>'+
    '<div class="warning"><strong>SAFETY:</strong> Educational starting point only. Not independently field-certified. Check current local conditions, qualified guidance, and any emergency instructions. External links are NOT bundled or independently validated.</div>'+
    '<section><h2>Materials</h2>'+ul(g.materials)+'</section>'+
    '<section><h2>Steps</h2>'+ol(g.steps)+'</section>'+
    '<section><h2>Acceptance checks</h2>'+ul(g.checks)+'</section>'+
    '<section class="warning"><h2>Hazards and limitations</h2>'+ul(g.cautions)+'</section>'+
    '<section><h2>Related original guide IDs</h2>'+(g.depends.length?ul(g.depends):'<p>None listed.</p>')+'</section>'+
    '<section><h2>Practice recordkeeping</h2><p>'+esc(g.code)+'</p></section>'+
    '<section><h2>External sources (online only)</h2><ul>'+
    s.sources.map(ref=>'<li><a href="'+esc(ref.url)+'" rel="noopener noreferrer">'+esc(ref.title)+'</a> (not included)</li>').join('')+
    '</ul></section>'+
    '<footer><p>Source fieldbook SHA-256: <code>'+sourceSha256+'</code>. Integrity does not prove authenticity, accuracy, or permission to redistribute. CodeBound claims MIT for original authored material only.</p></footer>');
}
function indexHtml(parsed) {
  return htmlPage('CodeBound: Eight Offline Field Skills',
    '<header><h1>Eight Offline Field Skills</h1><p>CodeBound knowledge carried through the PhiARK field-kit exporter.</p>'+
    '<p>Eight standalone guides, each available in HTML or Markdown. No internet, server, account or JavaScript needed to read the local files.</p></header>'+
    '<div class="warning"><strong>Important:</strong> This is a learning and preparedness reference, not certified emergency, medical, electrical, structural, food or legal guidance. Verify current local hazards and qualified advice. The referenced websites are online links, not cached manuals.</div>'+
    '<main><ol>'+parsed.skills.map(s=>'<li><a href="guides/'+s.slot+'.html">'+esc(s.guide.title)+'</a> (review label: '+esc(s.guide.review)+') | <a href="guides/'+s.slot+'.md">plain Markdown</a></li>').join('')+'</ol></main>'+
    '<footer><p>Original fieldbook JSON SHA-256: <code>'+parsed.sha256+'</code>. These files contain only CodeBound guide text, not the Internet Archive ZIPs or third-party books.</p></footer>');
}
function readme(parsed) {
  return [
    'PHIARK / CODEBOUND EIGHT-SKILL FIELD KIT','',
    'Open index.html directly with a web browser, even with Wi-Fi and mobile data off.',
    'Each guides/*.html works independently; guides/*.md can be read in a text editor.',
    'No server, JavaScript, account, download or installation required on the reading device.',
    'The source CodeBound fieldbook.json was read locally; source SHA-256: '+parsed.sha256,
    'Original guide reference: https://github.com/MichaelWave369/CodeBound','',
    'SAFETY: Learning material only. Not independently field-tested or certified.',
    'Check real hazards, local rules and current professional guidance before high-risk use.',
    'Sources inside guides are external links and are NOT bundled or safety-validated.',
    'CodeBound claims MIT for original text. Third-party materials retain their rights.','',
    'Check SHA256SUMS.txt for file integrity. A self-contained hash list cannot prove origin;',
    'verify the source and export provenance through a trusted independent channel.',
    'Check actual USB device readability and keep a second offline copy.',''
  ].join('\n');
}

export async function exportCodeBoundUsbKit({filename,target,approved=false}) {
  if(!approved) throw new Error('Explicit --i-approve-export required');
  if(typeof target!=='string' || !target.trim()) throw new Error('New destination path required');
  const destination=resolve(target);
  const parent=dirname(destination);
  strictDirectory(await lstat(parent),'Output parent');
  await mustNotExist(destination);
  const parsed=await loadCodeBoundFieldbook(filename);
  if(parsed.skills.length!==SKILL_MAP.length) throw new Error('Incomplete eight-skill source');
  const stage=await mkdtemp(join(parent,'.'+basename(destination)+'.phiark-stage-'));
  try {
    await mkdir(join(stage,'guides'));
    const files={
      'README.txt':readme(parsed),
      'index.html':indexHtml(parsed)
    };
    for (const s of parsed.skills) {
      files['guides/'+s.slot+'.html']=skillHtml(s,parsed.sha256);
      files['guides/'+s.slot+'.md']=renderCodeBoundGuide({...s,sha256:parsed.sha256});
    }
    if(Object.keys(files).sort().join('|')!==payloadPaths.join('|')) throw new Error('Unexpected output files');
    const hashes={};
    for (const name of payloadPaths) {
      const bytes=Buffer.from(files[name],'utf8');
      hashes[name]=hash(bytes);
      await writeFile(join(stage,name),bytes,{mode:0o600,flag:'wx'});
    }
    const manifest={
      schema:SCHEMA,sourceFieldbookSha256:parsed.sha256,sourceEdition:parsed.version,
      originalRepository:'https://github.com/MichaelWave369/CodeBound',
      skills:parsed.skills.map(s=>({slot:s.slot,originalGuideId:s.id,title:s.guide.title,reviewLabel:s.guide.review})),
      contentApproved:false,redistributionRightsVerified:false,
      files:hashes,
      note:'SHA-256 verifies bytes only; not publisher authenticity, legal rights, procedure safety or user competence.'
    };
    await writeFile(join(stage,'manifest.json'),JSON.stringify(manifest,null,2)+'\n',{mode:0o600,flag:'wx'});
    const sums=[...payloadPaths,'manifest.json'].sort().map(name=>
      hash(name==='manifest.json'?Buffer.from(JSON.stringify(manifest,null,2)+'\n'):Buffer.from(files[name]))+'  '+name
    ).join('\n')+'\n';
    await writeFile(join(stage,'SHA256SUMS.txt'),sums,{mode:0o600,flag:'wx'});
    const checked=await verifyCodeBoundUsbKit(stage);
    if(!checked.ok) throw new Error('Export self-test failed: '+checked.reason);
    await mustNotExist(destination);
    await rename(stage,destination);
    return {
      destination,sourceFieldbookSha256:parsed.sha256,skills:8,
      verified:true,files:knownPaths.length,
      note:'Locally readable HTML and Markdown; checksummed, not content-certified. Physical USB/device test remains necessary.'
    };
  } catch(error) {
    await rm(stage,{recursive:true,force:true});
    throw error;
  }
}

export async function verifyCodeBoundUsbKit(location) {
  try {
    const root=resolve(location);
    strictDirectory(await lstat(root),'USB kit');
    strictDirectory(await lstat(join(root,'guides')),'guides directory');
    const main=await readdir(root);
    if(main.sort().join('|')!==['README.txt','SHA256SUMS.txt','guides','index.html','manifest.json'].sort().join('|')) {
      throw new Error('Unexpected or missing root files');
    }
    const children=(await readdir(join(root,'guides'))).map(name=>'guides/'+name).sort();
    if(children.join('|')!==payloadPaths.filter(name=>name.startsWith('guides/')).join('|')) throw new Error('Unexpected or missing guide files');
    const manifestFile=join(root,'manifest.json');
    const manifestBytes=await readFile(manifestFile);
    if(manifestBytes.length>100*1024) throw new Error('Oversized manifest');
    const manifest=JSON.parse(manifestBytes.toString('utf8'));
    if(!manifest || manifest.schema!==SCHEMA || !HEX.test(manifest.sourceFieldbookSha256) ||
      !Array.isArray(manifest.skills) || manifest.skills.length!==8 ||
      manifest.contentApproved!==false || manifest.redistributionRightsVerified!==false ||
      !manifest.files || typeof manifest.files!=='object' || Array.isArray(manifest.files) ||
      Object.keys(manifest.files).sort().join('|')!==payloadPaths.join('|')) {
      throw new Error('Invalid kit manifest');
    }
    for (const [i,s] of SKILL_MAP.entries()) {
      const entry=manifest.skills[i];
      if(!entry || entry.slot!==s.slot || entry.originalGuideId!==s.id ||
        !['reference-backed','community-draft'].includes(entry.reviewLabel)) throw new Error('Invalid guide manifest entry');
    }
    for (const name of knownPaths) {
      const path=join(root,name);
      const info=await lstat(path);
      strictFile(info,name);
      if(info.size>1024*1024) throw new Error('Oversized export item: '+name);
    }
    for (const name of payloadPaths) {
      if(!HEX.test(manifest.files[name])) throw new Error('Invalid expected checksum');
      if(hash(await readFile(join(root,name)))!==manifest.files[name]) throw new Error('Tampered file: '+name);
    }
    const expected=[...payloadPaths,'manifest.json'].sort().map(name=>
      (name==='manifest.json'?hash(manifestBytes):manifest.files[name])+'  '+name
    ).join('\n')+'\n';
    if((await readFile(join(root,'SHA256SUMS.txt'),'utf8'))!==expected) throw new Error('Checksum manifest mismatch');
    return {
      ok:true,skills:8,files:knownPaths.length,sourceFieldbookSha256:manifest.sourceFieldbookSha256,
      note:'Self-contained byte integrity only. No authenticity, current safety or real USB reader test implied.'
    };
  } catch(error) { return {ok:false,reason:error.message}; }
}
