import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash, generateKeyPairSync, sign as edSign } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readFile, readdir, rm, symlink, writeFile } from 'node:fs/promises';
import {
  verifyIntelligenceBytes, importIntelligence, listIntelligence,
  verifyIntelligence, exportIntelligence
} from '../src/intelligence.mjs';

const sha=data=>createHash('sha256').update(data).digest('hex');
const DOMAIN=Buffer.from('FieldShield Sentinel Signed IOC v1\0');
const fmt=obj=>Buffer.from(JSON.stringify(obj,null,2)+'\n');
const headerMessage=header=>{
  const sorted=Object.fromEntries(Object.entries(header).sort(([a],[b])=>a.localeCompare(b,'en-US')));
  return Buffer.concat([DOMAIN,Buffer.from(JSON.stringify(sorted))]);
};
const fresh=async t=>{
  const home=await mkdtemp(join(tmpdir(),'phiark-intel-'));
  t.after(()=>rm(home,{recursive:true,force:true}));
  const {publicKey,privateKey}=generateKeyPairSync('ed25519');
  const pub=publicKey.export({format:'der',type:'spki'}).subarray(-32);
  const pack=fmt({
    schema:'fieldshield.ioc-pack.v1',source:'SYNTHETIC FIXTURE ONLY',
    issued_at:'2026-01-01T00:00:00Z',
    indicators:[{id:'demo-1',kind:'domain',value:'demo.example.invalid',
      confidence:'low',reference:'https://www.rfc-editor.org/rfc/rfc2606'}]
  });
  const header={
    schema:'fieldshield.signed-ioc.v1',publisher:'lab-example',key_id:'test-key',
    pack_sha256:sha(pack),issued_at:'2026-02-01T00:00:00Z',expires_at:'2035-01-01T00:00:00Z'
  };
  const manifest=fmt({...header,signature_b64:edSign(null,headerMessage(header),privateKey).toString('base64')});
  const policy={
    schema:'fieldshield.trust-store.v1',publishers:[{
      id:'lab-example',keys:[{id:'test-key',algorithm:'ed25519',state:'trusted',
        public_key_b64:pub.toString('base64')}],
      blocked_pack_sha256:[],minimum_issued_at:'2026-01-01T00:00:00Z'
    }]
  };
  const packPath=join(home,'pack.json'),manifestPath=join(home,'sig.json'),trustPath=join(home,'trust.json');
  await Promise.all([writeFile(packPath,pack),writeFile(manifestPath,manifest),
    writeFile(trustPath,fmt(policy))]);
  return {home,pack,manifest,policy,packPath,manifestPath,trustPath,
    root:join(home,'vault'),privateKey,header};
};
test('verifies correct Ed25519 contract for synthetic FieldShield pack',async t=>{
  const v=await fresh(t);
  const receipt=verifyIntelligenceBytes(v.pack,v.manifest,fmt(v.policy),Date.parse('2026-10-28T00:00:00Z'));
  assert.equal(receipt.id,sha(v.pack));
  assert.equal(receipt.status,'SIGNATURE_VERIFIED_NOT_CONTENT_APPROVED');
  assert.equal(receipt.indicatorsClaimed,1);
  assert.equal(receipt.publisher,'lab-example');
});
test('explicit import, verify, export and fresh-root restore without trust-store copy',async t=>{
  const v=await fresh(t);
  const inputs={packPath:v.packPath,manifestPath:v.manifestPath,trustPath:v.trustPath,root:v.root};
  await assert.rejects(importIntelligence(inputs),/Explicit/);
  const imported=await importIntelligence({...inputs,approved:true});
  assert.equal(imported.imported,true);
  assert.equal(imported.id,sha(v.pack));
  const listed=await listIntelligence(v.root);
  assert.equal(listed.length,1);
  assert.equal((await verifyIntelligence(v.trustPath,v.root)).passed,1);
  assert.equal((await importIntelligence({...inputs,approved:true})).imported,false);
  const dest=join(v.home,'portable');
  await assert.rejects(exportIntelligence({id:imported.id,destination:dest,
    root:v.root,trustPath:v.trustPath}),/Explicit/);
  const exported=await exportIntelligence({id:imported.id,destination:dest,
    root:v.root,trustPath:v.trustPath,approved:true});
  assert.equal(exported.verifiedAgainstLocalTrust,true);
  const paths=await readdir(dest);
  assert.deepEqual(paths.sort(),['README.txt','manifest.json','pack.json']);
  assert.deepEqual(await readFile(join(dest,'pack.json')),v.pack);
  assert.deepEqual(await readFile(join(dest,'manifest.json')),v.manifest);
  const second=await importIntelligence({
    packPath:join(dest,'pack.json'),manifestPath:join(dest,'manifest.json'),
    trustPath:v.trustPath,root:join(v.home,'new-vault'),approved:true
  });
  assert.equal(second.id,imported.id);
  await assert.rejects(exportIntelligence({id:imported.id,destination:dest,
    root:v.root,trustPath:v.trustPath,approved:true}),/exists/);
});
test('tampered pack and signature fail before any vault mutation',async t=>{
  const v=await fresh(t);
  await assert.rejects(importIntelligence({
    packPath:v.packPath,manifestPath:v.manifestPath,trustPath:v.trustPath,
    root:v.root,approved:false
  }),/Explicit/);
  const edited=Buffer.from(v.pack);
  edited[20]^=1;
  assert.throws(()=>verifyIntelligenceBytes(edited,v.manifest,fmt(v.policy)),/hash mismatch/);
  const badSig=JSON.parse(v.manifest);
  badSig.signature_b64='A'+badSig.signature_b64.slice(1);
  assert.throws(()=>verifyIntelligenceBytes(v.pack,fmt(badSig),fmt(v.policy)),
    /signature invalid|Invalid Ed25519/);
  assert.deepEqual(await listIntelligence(v.root),[]);
});
test('rejects unknown publishers, revoked keys, blocked digests and issuance rollback',async t=>{
  const v=await fresh(t);
  const wrong=structuredClone(v.policy);
  wrong.publishers[0].id='someone-else';
  assert.throws(()=>verifyIntelligenceBytes(v.pack,v.manifest,fmt(wrong)),/Untrusted publisher/);
  const revoked=structuredClone(v.policy);
  revoked.publishers[0].keys[0].state='revoked';
  assert.throws(()=>verifyIntelligenceBytes(v.pack,v.manifest,fmt(revoked)),/revoked/);
  const blocked=structuredClone(v.policy);
  blocked.publishers[0].blocked_pack_sha256=[sha(v.pack)];
  assert.throws(()=>verifyIntelligenceBytes(v.pack,v.manifest,fmt(blocked)),/blocked/);
  const rollback=structuredClone(v.policy);
  rollback.publishers[0].minimum_issued_at='2028-01-01T00:00:00Z';
  assert.throws(()=>verifyIntelligenceBytes(v.pack,v.manifest,fmt(rollback)),/issuance floor/);
});
test('expired and future manifests are rejected',async t=>{
  const v=await fresh(t);
  assert.throws(()=>verifyIntelligenceBytes(v.pack,v.manifest,fmt(v.policy),
    Date.parse('2040-01-01T00:00:00Z')),/not currently valid/);
  assert.throws(()=>verifyIntelligenceBytes(v.pack,v.manifest,fmt(v.policy),
    Date.parse('2025-01-01T00:00:00Z')),/not currently valid/);
});
test('ambiguous duplicate manifest JSON fields are rejected',async t=>{
  const v=await fresh(t);
  const ambiguous=Buffer.from(v.manifest.toString('utf8').replace(
    '"publisher": "lab-example",','"publisher": "rogue", "publisher": "lab-example",'));
  assert.throws(()=>verifyIntelligenceBytes(v.pack,ambiguous,fmt(v.policy)),/duplicate/);
});
test('trust changes and damaged stored bytes fail subsequent re-verification',async t=>{
  const v=await fresh(t);
  const receipt=await importIntelligence({
    packPath:v.packPath,manifestPath:v.manifestPath,trustPath:v.trustPath,
    root:v.root,approved:true
  });
  const blocked=structuredClone(v.policy);
  blocked.publishers[0].blocked_pack_sha256=[receipt.id];
  await writeFile(v.trustPath,fmt(blocked));
  const rejection=await verifyIntelligence(v.trustPath,v.root);
  assert.equal(rejection.passed,0);
  assert.match(rejection.results[0].reason,/blocked/);
  await writeFile(v.trustPath,fmt(v.policy));
  await writeFile(join(v.root,'intelligence','objects',receipt.id,'pack.json'),'tampered');
  const damaged=await verifyIntelligence(v.trustPath,v.root);
  assert.equal(damaged.passed,0);
  await assert.rejects(exportIntelligence({
    id:receipt.id,destination:join(v.home,'bad-export'),
    root:v.root,trustPath:v.trustPath,approved:true
  }),/hash mismatch/);
});
test('refuses symbolic-link source and does not import',async t=>{
  const v=await fresh(t);
  const link=join(v.home,'linked-pack.json');
  try{await symlink(v.packPath,link);}catch(e){if(['EPERM','EACCES'].includes(e.code))return;throw e;}
  await assert.rejects(importIntelligence({
    packPath:link,manifestPath:v.manifestPath,trustPath:v.trustPath,
    root:v.root,approved:true
  }),/symbolic|ELOOP|changed/i);
  assert.deepEqual(await listIntelligence(v.root),[]);
});
test('refuses changing publisher ID or signature metadata',async t=>{
  const v=await fresh(t);
  const changed=JSON.parse(v.manifest);
  changed.publisher='new-publisher';
  const policy=structuredClone(v.policy);
  policy.publishers[0].id='new-publisher';
  assert.throws(()=>verifyIntelligenceBytes(v.pack,fmt(changed),fmt(policy)),/signature invalid/);
  changed.publisher='lab-example';
  changed.expires_at='2036-01-01T00:00:00Z';
  assert.throws(()=>verifyIntelligenceBytes(v.pack,fmt(changed),fmt(v.policy)),/signature invalid/);
});
