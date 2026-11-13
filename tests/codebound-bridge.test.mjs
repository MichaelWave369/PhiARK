import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SKILL_MAP, loadCodeBoundFieldbook, previewCodeBoundFieldbook, renderCodeBoundGuide, importCodeBoundSkill } from '../src/codebound-bridge.mjs';
import { readCatalog, objectPath, verifyVault } from '../src/vault.mjs';
import { bindSlot, planPack, exportPack, verifySnapshot } from '../src/packs.mjs';

async function fixture(t) {
  const root=await mkdtemp(join(tmpdir(),'phiark-codebound-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const filename=join(root,'fieldbook.json');
  const sources={reference:{title:'Synthetic safety reference',url:'https://example.org/guide'}};
  const guides=SKILL_MAP.map(s=>({
    id:s.id,category:s.category,title:'Synthetic '+s.slot+' lesson',
    summary:'Fixture only: not a real emergency procedure.',
    phase:'Sustain',effort:'Practice session',review:'community-draft',
    materials:['Paper','Pencil'],steps:['Read trusted source','Plan safe exercise','Record results'],
    checks:['Check conditions','Record uncertainty'],
    cautions:['Do not treat this fixture as advice.'],
    sources:['reference'],depends:[],code:'Store measurements, not personal names.'
  }));
  const data={format:'codebound-fieldbook-v1',version:'test',sources,guides};
  await writeFile(filename,JSON.stringify(data),{mode:0o600});
  return {root,filename,data};
}
test('preview parses exact eight guides without writing or asserting safety',async t=>{
  const {root,filename}=await fixture(t);
  const result=await previewCodeBoundFieldbook(filename);
  assert.equal(result.skills.length,8);
  assert.equal(result.publisherAuthenticated,false);
  assert.equal(result.locallyImported,false);
  assert.match(result.sourceSha256,/^[0-9a-f]{64}$/);
  assert.deepEqual(await readCatalog(join(root,'vault')),[]);
});
test('single-slot import requires consent, preserves cautions and stays unbound',async t=>{
  const {root,filename}=await fixture(t);
  const vault=join(root,'vault');
  await assert.rejects(importCodeBoundSkill({filename,slot:'water',root:vault}),/approve-import/);
  assert.deepEqual(await readCatalog(vault),[]);
  const out=await importCodeBoundSkill({filename,slot:'water',approved:true,root:vault});
  assert.equal(out.imported,true);
  assert.equal(out.reviewStatus,'unreviewed');
  assert.equal(out.licenseStatus,'unverified');
  assert.equal(out.packBindingChanged,false);
  const doc=(await readCatalog(vault))[0];
  assert.equal(doc.subject,'water');
  const md=await readFile(objectPath(vault,doc.id),'utf8');
  assert.match(md,/Hazards and limits/);
  assert.match(md,/Do not treat this fixture as advice/);
  assert.match(md,/fieldbook SHA-256:/);
  assert.match(md,/not bundled or verified/);
  assert.equal((await planPack('field-skills-r01',vault)).hashVerified,0);
  assert.equal((await verifyVault(vault)).passed,1);
  assert.equal((await importCodeBoundSkill({filename,slot:'water',approved:true,root:vault})).imported,false);
  await bindSlot({id:'field-skills-r01',slotId:'water',digest:doc.id,root:vault});
  assert.equal((await planPack('field-skills-r01',vault)).hashVerified,1);
  const destination=join(root,'snapshot');
  await exportPack('field-skills-r01',destination,vault);
  assert.equal((await verifySnapshot(destination)).ok,true);
});
test('rejects missing safety data, duplicate IDs, wrong category, unsafe refs and unknown slots',async t=>{
  const {filename,data}=await fixture(t);
  await assert.rejects(importCodeBoundSkill({filename,slot:'unknown',approved:true}),/Unknown CodeBound/);
  data.guides[0].cautions=[];
  await writeFile(filename,JSON.stringify(data));
  await assert.rejects(loadCodeBoundFieldbook(filename),/Invalid list/);
  data.guides[0].cautions=['Warning'];
  data.guides[1].id=data.guides[0].id;
  await writeFile(filename,JSON.stringify(data));
  await assert.rejects(loadCodeBoundFieldbook(filename),/duplicate/i);
  data.guides[1].id=SKILL_MAP[1].id;
  data.guides[0].category='other';
  await writeFile(filename,JSON.stringify(data));
  await assert.rejects(loadCodeBoundFieldbook(filename),/Missing CodeBound/);
  data.guides[0].category=SKILL_MAP[0].category;
  data.sources.reference.url='http://example.org/not-secure';
  await writeFile(filename,JSON.stringify(data));
  await assert.rejects(loadCodeBoundFieldbook(filename),/Unsafe source URL/);
});
test('rejects symlinks and escapes text in Markdown representation',async t=>{
  const {root,filename}=await fixture(t);
  const link=join(root,'linked.json');
  await symlink(filename,link);
  await assert.rejects(previewCodeBoundFieldbook(link),/non-symlink/);
  const original=await loadCodeBoundFieldbook(filename);
  const skill=original.skills[0];
  const markdown=renderCodeBoundGuide({...skill,sha256:original.sha256});
  assert.ok(markdown.includes('## Steps'));
  assert.ok(markdown.includes('## Hazards and limits'));
  assert.ok(!markdown.includes('<script'));
});
