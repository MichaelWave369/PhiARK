import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readFieldSourceCatalog, listFieldSourceLeads, describeFieldSource, fieldCoverage } from '../src/field-sources.mjs';
import { importDocument } from '../src/vault.mjs';
import { bindSlot, exportPack, planPack, verifySnapshot, restoreSnapshot, listPacks } from '../src/packs.mjs';

test('six Archive metadata records are candidates only and map onto real eight-slot pack', async () => {
  const catalog = await readFieldSourceCatalog();
  assert.equal(catalog.items.length, 6);
  const ids = new Set(catalog.items.map(x => x.id));
  assert.equal(ids.size, 6);
  const leads = await listFieldSourceLeads();
  assert.equal(leads.externalCandidates, 6);
  assert.equal(leads.downloadedOrApproved, 0);
  assert.ok(leads.items.every(x => x.rightsStatus === 'UNKNOWN' && x.acquisitionStatus === 'NOT_DOWNLOADED'));
  assert.match((await describeFieldSource('kit-b-survival-defense')).caution, /firearms/i);
  await assert.rejects(describeFieldSource('../not-an-item'), /Unknown/);
  assert.ok((await listPacks()).some(x => x.id === 'field-skills-r01'));
});

test('coverage separates search leads from actually imported local files', async t => {
  const root = await mkdtemp(join(tmpdir(), 'phiark-field-empty-'));
  t.after(() => rm(root, { recursive:true, force:true }));
  const report = await fieldCoverage(root);
  assert.equal(report.totalSkills, 8);
  assert.equal(report.hashVerifiedLocalSelections, 0);
  assert.equal(report.safetyApproved, 0);
  assert.ok(report.skills.every(x => x.status === 'MISSING'));
  const sources = report.skills.flatMap(x => x.externalLeads);
  assert.ok(sources.length >= 8);
  assert.ok(sources.every(x => x.contentReview === 'NOT_REVIEWED'));
});

test('a truly imported, matching guide can be bound and exported offline, without source ZIP', async t => {
  const root = await mkdtemp(join(tmpdir(), 'phiark-field-pack-'));
  t.after(() => rm(root, { recursive:true, force:true }));
  const vault = join(root, 'vault');
  const guide = join(root, 'test-water.md');
  await writeFile(guide, '# Synthetic water field notes\nTEST FIXTURE: not emergency guidance.\n');
  const {entry} = await importDocument({root:vault, filename:guide,title:'Synthetic water test',subject:'water',source:'https://example.org/test',safety:'safety-critical'});
  const before = await planPack('field-skills-r01',vault);
  assert.equal(before.hashVerified,0);
  await assert.rejects(bindSlot({id:'field-skills-r01',slotId:'navigation',digest:entry.id,root:vault}),/subject/);
  await bindSlot({id:'field-skills-r01',slotId:'water',digest:entry.id,root:vault});
  const after = await fieldCoverage(vault);
  assert.equal(after.hashVerifiedLocalSelections,1);
  assert.equal(after.safetyApproved,0);
  const snapshot=join(root,'exported');
  const exported=await exportPack('field-skills-r01',snapshot,vault);
  assert.equal(exported.verified,true);
  assert.equal((await verifySnapshot(snapshot)).ok,true);
  const newRoot=join(root,'restored');
  await restoreSnapshot(snapshot,newRoot);
  assert.equal((await planPack('field-skills-r01',newRoot)).hashVerified,1);
});
