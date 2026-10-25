import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { importDocument, digestFile } from '../src/vault.mjs';
import { bindSlot, exportPack, listPacks, planPack, restoreSnapshot, verifySnapshot, verifyZim } from '../src/packs.mjs';

async function sandbox(t) {
  const parent = await mkdtemp(join(tmpdir(), 'phiark-packs-'));
  t.after(() => rm(parent, { force: true, recursive: true }));
  const data = join(parent, 'vault');
  const input = join(parent, 'guide.md');
  await writeFile(input, '# Readiness plan\nFor humans and animals.\n');
  const { entry } = await importDocument({ filename: input, title: 'Readiness', subject: 'survival', root: data });
  return { parent, data, input, entry };
}
test('pack definitions are real plans, not falsely counted downloads', async t => {
  const { data } = await sandbox(t);
  const list = await listPacks();
  assert.equal(list.length, 2);
  const plan = await planPack('essential-field-r01', data);
  assert.equal(plan.total, 11);
  assert.equal(plan.hashVerified, 0);
  assert.equal(plan.slots[0].status, 'MISSING');
  assert.equal(plan.safetyApproved, 0);
});
test('bind only existing, intact document with matching category', async t => {
  const { data, entry } = await sandbox(t);
  await assert.rejects(bindSlot({id:'essential-field-r01',slotId:'readiness-plan',digest:'a'.repeat(64),root:data}), /absent/);
  await assert.rejects(bindSlot({id:'essential-field-r01',slotId:'safe-water',digest:entry.id,root:data}), /subject/);
  const linked = await bindSlot({id:'essential-field-r01',slotId:'readiness-plan',digest:entry.id,root:data});
  assert.equal(linked.status, 'HASH_VERIFIED_NOT_CONTENT_APPROVED');
  const plan = await planPack('essential-field-r01', data);
  assert.equal(plan.hashVerified, 1);
  assert.equal(plan.safetyApproved, 0);
});
test('export, verify and new-root restore are end-to-end offline and non-destructive', async t => {
  const { parent, data, entry } = await sandbox(t);
  await bindSlot({id:'essential-field-r01',slotId:'readiness-plan',digest:entry.id,root:data});
  const dest = join(parent,'portable-pack');
  const exported = await exportPack('essential-field-r01',dest,data);
  assert.equal(exported.verified,true);
  assert.equal((await verifySnapshot(dest)).ok,true);
  await assert.rejects(exportPack('essential-field-r01',dest,data), /exists/);
  const recovered = join(parent, 'fresh-vault');
  const restored = await restoreSnapshot(dest,recovered);
  assert.equal(restored.documents, 1);
  assert.equal((await planPack('essential-field-r01',recovered)).hashVerified,1);
  await assert.rejects(restoreSnapshot(dest,recovered), /exists/);
});
test('snapshot fails closed on tampering and a symlinked object', async t => {
  const { parent, data, input, entry } = await sandbox(t);
  await bindSlot({id:'essential-field-r01',slotId:'readiness-plan',digest:entry.id,root:data});
  const dest = join(parent,'export');
  await exportPack('essential-field-r01',dest,data);
  await writeFile(join(dest,'objects',entry.id), 'corrupt');
  assert.equal((await verifySnapshot(dest)).ok,false);
  await assert.rejects(restoreSnapshot(dest,join(parent,'restored')), /verification failed/);
  await rm(join(dest,'objects',entry.id));
  await symlink(input, join(dest,'objects',entry.id));
  assert.equal((await verifySnapshot(dest)).ok,false);
});
test('Kiwix ZIM helper checks bytes but does not claim content verification', async t => {
  const { parent } = await sandbox(t);
  const zim = join(parent, 'manual.zim');
  await writeFile(zim, 'synthetic bytes for hash-path unit test');
  const expected = await digestFile(zim);
  const result = await verifyZim(zim, expected);
  assert.equal(result.matches, true);
  assert.match(result.note, /supplied digest/);
  assert.equal((await verifyZim(zim,'0'.repeat(64))).matches,false);
  await assert.rejects(verifyZim(zim,'not-a-hash'), /64-character/);
});
