import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SKILL_MAP } from '../src/codebound-bridge.mjs';
import { exportCodeBoundUsbKit, verifyCodeBoundUsbKit } from '../src/codebound-usb-kit.mjs';

async function setup(t) {
  const root=await mkdtemp(join(tmpdir(),'phiark-usb-test-'));
  t.after(()=>rm(root,{recursive:true,force:true}));
  const filename=join(root,'fieldbook.json');
  const guideData=SKILL_MAP.map((s,i)=>({
    id:s.id,category:s.category,title:'Synthetic '+s.slot+' field lesson',
    summary:'Fixture <script>alert(1)</script> is text only. This is not operational guidance.',
    phase:'Sustain',effort:'Sample practice',review:i%2?'reference-backed':'community-draft',
    materials:['Notebook','Pencil'],steps:['Consult qualified local guidance','Check conditions','Record safe results'],
    checks:['Review local context','Check hazards'],cautions:['Not an emergency procedure.','Avoid unverified methods.'],
    sources:['primary'],depends:[],code:'No personal data <b>allowed</b> in public records.'
  }));
  const data={
    format:'codebound-fieldbook-v1',version:'synthetic-test',
    sources:{primary:{title:'Independent reference example',url:'https://example.org/field'}},
    guides:guideData
  };
  await writeFile(filename,JSON.stringify(data),{mode:0o600});
  return {root,filename,data};
}

test('export refuses to write without explicit operator approval',async t=>{
  const {root,filename}=await setup(t);
  const target=join(root,'portable');
  await assert.rejects(exportCodeBoundUsbKit({filename,target}),/approve-export/);
  assert.ok(!(await readdir(root)).includes('portable'));
});

test('eight standalone HTML and Markdown guides are offline-readable and byte-verified',async t=>{
  const {root,filename}=await setup(t);
  const target=join(root,'portable');
  const out=await exportCodeBoundUsbKit({filename,target,approved:true});
  assert.equal(out.skills,8);
  assert.equal(out.verified,true);
  const verified=await verifyCodeBoundUsbKit(target);
  assert.equal(verified.ok,true);
  assert.equal(verified.skills,8);
  assert.equal(out.sourceFieldbookSha256,verified.sourceFieldbookSha256);
  const index=await readFile(join(target,'index.html'),'utf8');
  assert.match(index,/Eight Offline Field Skills/);
  assert.doesNotMatch(index,/<script\b/i);
  assert.doesNotMatch(index,/<link\b/i);
  for(const skill of SKILL_MAP) {
    const html=await readFile(join(target,'guides',skill.slot+'.html'),'utf8');
    const md=await readFile(join(target,'guides',skill.slot+'.md'),'utf8');
    assert.match(html,/<!doctype html>/i);
    assert.doesNotMatch(html,/<script\b/i);
    assert.doesNotMatch(html,/<iframe\b/i);
    assert.ok(html.includes('Hazards and limitations'));
    assert.ok(html.includes('Acceptance checks'));
    assert.ok(html.includes('href="../index.html"'));
    assert.match(md,/## Hazards and limits/);
    assert.match(md,/Not an emergency procedure/);
    assert.match(md,/Source fieldbook SHA-256/);
  }
  const example=await readFile(join(target,'guides','water.html'),'utf8');
  assert.ok(example.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(!example.includes('<script>alert(1)</script>'));
  assert.match(await readFile(join(target,'README.txt'),'utf8'),/No server, JavaScript, account/);
});

test('checksum and structure verification reject tampering and unexpected files',async t=>{
  const {root,filename}=await setup(t);
  const target=join(root,'portable');
  await exportCodeBoundUsbKit({filename,target,approved:true});
  await writeFile(join(target,'guides','garden.md'),'corrupted');
  const report=await verifyCodeBoundUsbKit(target);
  assert.equal(report.ok,false);
  assert.match(report.reason,/Tampered file/);
  const target2=join(root,'portable-two');
  await exportCodeBoundUsbKit({filename,target:target2,approved:true});
  await writeFile(join(target2,'unwanted.txt'),'unwanted');
  assert.match((await verifyCodeBoundUsbKit(target2)).reason,/Unexpected/);
});

test('destination is never overwritten and exported checksums are reproducible',async t=>{
  const {root,filename}=await setup(t);
  const first=join(root,'one'),second=join(root,'two');
  await exportCodeBoundUsbKit({filename,target:first,approved:true});
  await assert.rejects(exportCodeBoundUsbKit({filename,target:first,approved:true}),/overwrite/);
  await exportCodeBoundUsbKit({filename,target:second,approved:true});
  assert.equal(await readFile(join(first,'SHA256SUMS.txt'),'utf8'),
    await readFile(join(second,'SHA256SUMS.txt'),'utf8'));
  assert.equal(await readFile(join(first,'manifest.json'),'utf8'),
    await readFile(join(second,'manifest.json'),'utf8'));
});

test('bad source guides and symlinked source data fail closed before writing files',async t=>{
  const {root,filename,data}=await setup(t);
  const link=join(root,'linked.json');
  await symlink(filename,link);
  await assert.rejects(exportCodeBoundUsbKit({filename:link,target:join(root,'bad-link'),approved:true}),/non-symlink/);
  data.guides.find(g=>g.id==='field-purify-water').cautions=[];
  await writeFile(filename,JSON.stringify(data));
  await assert.rejects(exportCodeBoundUsbKit({filename,target:join(root,'bad-guide'),approved:true}),/Invalid list/);
  assert.ok(!(await readdir(root)).includes('bad-guide'));
});

test('symlinks inside a portable export are not considered verifiable',async t=>{
  const {root,filename}=await setup(t);
  const target=join(root,'portable');
  await exportCodeBoundUsbKit({filename,target,approved:true});
  await rm(join(target,'guides','harvest.html'));
  await symlink(join(target,'index.html'),join(target,'guides','harvest.html'));
  const result=await verifyCodeBoundUsbKit(target);
  assert.equal(result.ok,false);
  assert.match(result.reason,/regular file/);
});
