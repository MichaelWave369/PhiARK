// Offline CodeBound fieldbook JSON -> one reviewable Markdown guide per explicit import.
// No remote fetch, ZIP handling, content certification, or automatic pack binding.
import { lstat, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { importDocument, vaultRoot } from './vault.mjs';

export const SKILL_MAP = Object.freeze([
  ['harvest','field-hunt-fish-harvest','food','food','safety-critical'],
  ['water','field-purify-water','water','water','safety-critical'],
  ['natural-medicine','field-natural-medicine-literacy','health','health','safety-critical'],
  ['shelter','field-build-shelter','shelter','survival','safety-critical'],
  ['garden','field-grow-garden','food','agriculture','reference'],
  ['power','field-create-power','energy','energy','safety-critical'],
  ['self-defense','field-personal-safety','safety','survival','reference'],
  ['navigation','field-navigate','navigation','maps','reference']
].map(([slot,id,category,subject,safety]) => Object.freeze({slot,id,category,subject,safety})));

const ORIGIN = 'https://github.com/MichaelWave369/CodeBound';
function safeLine(x, label, max=1300) {
  if (typeof x !== 'string' || !x.trim() || x.length > max || /[\x00-\x1f\x7f]/.test(x)) {
    throw new Error('Invalid fieldbook text: ' + label);
  }
  return x;
}
function safeList(x,label,allowEmpty=false) {
  if (!Array.isArray(x) || x.length > 40 || (!allowEmpty && !x.length)) throw new Error('Invalid list: '+label);
  return x.map((v,i)=>safeLine(v,label+' '+i));
}
function md(x) {
  return String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/([\\*_{}[\]()#+!|])/g,'\\$1')
    .replace(new RegExp(String.fromCharCode(96),'g'),'\\'+String.fromCharCode(96));
}
const bullets=(xs,ordered=false)=>xs.map((x,i)=>(ordered ? String(i+1)+'. ' : '- ')+md(x)).join('\n');

export async function loadCodeBoundFieldbook(filename) {
  if (typeof filename !== 'string' || !filename.endsWith('.json')) throw new Error('Choose a local fieldbook.json file');
  const st=await lstat(filename);
  if (!st.isFile() || st.isSymbolicLink() || st.size < 100 || st.size > 2*1024*1024) {
    throw new Error('Expected a regular non-symlink fieldbook.json under 2 MiB');
  }
  const bytes=await readFile(filename);
  const sha256=createHash('sha256').update(bytes).digest('hex');
  const data=JSON.parse(bytes.toString('utf8'));
  if (!data || data.format!=='codebound-fieldbook-v1' || !Array.isArray(data.guides) ||
      !data.sources || typeof data.sources!=='object' || Array.isArray(data.sources)) {
    throw new Error('Unsupported CodeBound fieldbook format');
  }
  const seen=new Set();
  for(const g of data.guides) {
    if(!g || typeof g.id!=='string' || seen.has(g.id)) throw new Error('Invalid or duplicate field guide ID');
    seen.add(g.id);
  }
  const skills=SKILL_MAP.map(spec=>{
    const guide=data.guides.find(g=>g.id===spec.id);
    if(!guide || guide.category!==spec.category) throw new Error('Missing CodeBound skill: '+spec.id);
    for(const k of ['title','summary','phase','effort','code','review']) safeLine(guide[k],k);
    if(!['reference-backed','community-draft'].includes(guide.review)) throw new Error('Unsupported review status');
    for(const key of ['materials','steps','checks','cautions','sources','depends'])
      safeList(guide[key],key,key==='depends');
    if(guide.steps.length<3 || guide.checks.length<2 || guide.cautions.length<1) throw new Error('Missing safety checks');
    const sources=guide.sources.map(k=>{
      const x=data.sources[k];
      if(!x || typeof x!=='object') throw new Error('Missing reference '+k);
      const title=safeLine(x.title,'source title',250);
      const url=safeLine(x.url,'source url',1500);
      if(!/^https:\/\/[A-Za-z0-9.-]+(\/|$)/.test(url) || /[\s<>]/.test(url) ||
          url.includes(String.fromCharCode(96)) || url.includes('"') || url.includes("'")) {
        throw new Error('Unsafe source URL: '+k);
      }
      return {title,url};
    });
    return {...spec,guide,sources};
  });
  return {sha256,filename:basename(filename),version:String(data.version||'unknown').slice(0,50),skills};
}

export function renderCodeBoundGuide({guide,sources,slot,id,subject,sha256}) {
  if(!/^[a-f0-9]{64}$/.test(sha256)) throw new Error('Missing source digest');
  return [
    '# '+md(guide.title),'',
    'Source: CodeBound first-party fieldbook / '+ORIGIN,
    'Source fieldbook SHA-256: '+sha256+' (integrity only, not authenticity)',
    'PhiARK slot: '+slot+'; original guide ID: '+id+'; subject: '+subject,
    'Original guide review label: '+md(guide.review)+' (not an expert certification)','',
    '> WARNING: Educational starter only. Follow current local emergency instructions, trained experts and manufacturer safety rules. Third-party references linked below are not bundled or verified.','',
    md(guide.summary),'',
    '## Materials',bullets(guide.materials),'',
    '## Steps',bullets(guide.steps,true),'',
    '## Acceptance checks',bullets(guide.checks),'',
    '## Hazards and limits',bullets(guide.cautions),'',
    '## Related guide IDs',guide.depends.length?bullets(guide.depends):'(None listed)','',
    '## Recordkeeping',md(guide.code),'',
    '## External links, not cached documents',
    ...sources.map(s=>'- '+md(s.title)+': '+s.url),'',
    'Licensing: CodeBound claims MIT for its original text only; external documents retain their rights.',
    'PhiARK local import is unreviewed and has unverified licensing until separately assessed.',''
  ].join('\n');
}

export async function previewCodeBoundFieldbook(filename) {
  const f=await loadCodeBoundFieldbook(filename);
  return {
    sourceFilename:f.filename,sourceSha256:f.sha256,version:f.version,
    locallyImported:false,publisherAuthenticated:false,
    skills:f.skills.map(s=>({slot:s.slot,id:s.id,title:s.guide.title,subject:s.subject,review:s.guide.review})),
    note:'Shape-checked local JSON only; no content validation, permissions, downloads, or writes.'
  };
}

export async function importCodeBoundSkill({filename,slot,approved=false,root=vaultRoot()}) {
  if(!approved) throw new Error('Explicit --i-approve-import required');
  const f=await loadCodeBoundFieldbook(filename);
  const s=f.skills.find(x=>x.slot===slot);
  if(!s) throw new Error('Unknown CodeBound field skill slot');
  const dir=await mkdtemp(join(tmpdir(),'phiark-codebound-'));
  try {
    const path=join(dir,slot+'.md');
    await writeFile(path,renderCodeBoundGuide({...s,sha256:f.sha256}),{mode:0o600,flag:'wx'});
    const result=await importDocument({
      filename:path, title:'CodeBound: '+s.guide.title,
      author:'CodeBound contributors',subject:s.subject,safety:s.safety,
      source:ORIGIN,license:'MIT claimed for CodeBound-authored text; verify rights',root
    });
    return {
      slot,imported:result.imported,documentId:result.entry.id,sourceFieldbookSha256:f.sha256,
      reviewStatus:result.entry.reviewStatus,licenseStatus:result.entry.licenseStatus,
      packBindingChanged:false,
      nextCommand:'npm run packs -- bind field-skills-r01 '+slot+' '+result.entry.id,
      note:'Local Markdown imported only, not bound. No external manuals copied or safety approved.'
    };
  } finally {
    await rm(dir,{recursive:true,force:true});
  }
}
