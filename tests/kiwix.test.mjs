import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, mkdir, rm, writeFile, symlink } from 'node:fs/promises';
import { acquireArchive, importArchive, inventory, listSelections, verifyInstalled } from '../src/kiwix.mjs';

async function fixture(t) {
  const parent = await mkdtemp(join(tmpdir(), 'phiark-kiwix-'));
  t.after(() => rm(parent, { recursive: true, force: true }));
  const root = join(parent, 'private');
  const selections = await listSelections();
  const item = selections.find(x => x.id === 'chemistry');
  const zim = join(parent, item.filename);
  const checksum = zim + '.sha256';
  const bytes = Buffer.from('synthetic test bytes, not a real ZIM');
  const sha = createHash('sha256').update(bytes).digest('hex');
  await writeFile(zim, bytes);
  await writeFile(checksum, sha + '  ' + item.filename + '\n');
  return { parent, root, item, zim, checksum, sha };
}
test('catalog has exact releases, never fictitious SHA or installed status', async () => {
  const list = await listSelections();
  assert.equal(list.length, 6);
  assert.equal(list.find(x => x.id === 'chemistry').filename, 'wikipedia_en_chemistry_mini_2026-10.zim');
  assert(list.every(x => x.acquisitionStatus === 'NOT_CHECKED'));
  assert(list.every(x => x.checksumUrl === x.downloadUrl + '.sha256'));
});
test('missing archive is never reported installed and acquisition requires approval', async t => {
  const { root } = await fixture(t);
  const rows = await inventory(root);
  assert.equal(rows.length, 6);
  assert(rows.every(x => x.status === 'NOT_INSTALLED'));
  await assert.rejects(acquireArchive('chemistry', { root }), /approve/);
});
test('local import verifies checksum before accepting; no accidental overwrite', async t => {
  const { root, item, zim, checksum, sha } = await fixture(t);
  const imported = await importArchive({ id: item.id, zimFile: zim, checksumFile: checksum, root });
  assert.equal(imported.status, 'CHECKSUM_MATCHED');
  assert.equal(imported.sha256, sha);
  assert.equal(imported.rightsApproved, false);
  assert.equal(imported.contentApproved, false);
  assert.equal((await verifyInstalled(item.id, root)).status, 'CHECKSUM_MATCHED');
  await assert.rejects(importArchive({id:item.id, zimFile:zim, checksumFile:checksum, root}), /already exists/);
});
test('mismatched bytes or mismatched sidecar filename cannot import', async t => {
  const { root, item, zim, checksum } = await fixture(t);
  await writeFile(checksum, '0'.repeat(64) + '  ' + item.filename + '\n');
  await assert.rejects(importArchive({ id:item.id, zimFile:zim, checksumFile:checksum, root }), /mismatch/);
  await writeFile(checksum, '0'.repeat(64) + '  unrelated.zim\n');
  await assert.rejects(importArchive({ id:item.id, zimFile:zim, checksumFile:checksum, root }), /filename/);
  assert.equal((await verifyInstalled(item.id, root)).status, 'NOT_INSTALLED');
});
test('stored file tampering is caught by subsequent verification', async t => {
  const { root, item, zim, checksum } = await fixture(t);
  const stored = await importArchive({ id:item.id, zimFile:zim, checksumFile:checksum, root });
  await writeFile(join(stored.path,item.filename), 'changed data');
  const checked = await verifyInstalled(item.id, root);
  assert.equal(checked.status, 'FAIL');
});
test('import rejects archive symlinks', async t => {
  const { parent, root, item, zim, checksum } = await fixture(t);
  const linkedFolder = join(parent, 'linked');
  await mkdir(linkedFolder);
  const symlinkFile = join(linkedFolder, item.filename);
  await symlink(zim, symlinkFile);
  await assert.rejects(importArchive({ id:item.id, zimFile:symlinkFile, checksumFile:checksum, root }), /non-symlink/);
});
