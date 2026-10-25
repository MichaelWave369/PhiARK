import test from 'node:test';
import assert from 'node:assert/strict';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, readFile, symlink, writeFile } from 'node:fs/promises';
import { importDocument, objectPath, readCatalog, searchVault, verifyVault } from '../src/vault.mjs';

async function fixture(t) {
  const { rm } = await import('node:fs/promises');
  const root = await mkdtemp(join(tmpdir(), 'phiark-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const input = join(root, 'water.md');
  await writeFile(input, '# Clean water\nSanitation and filtration basics.\n');
  return { root, input };
}

test('empty catalog is honest; imports are explicit and searchable', async (t) => {
  const { root, input } = await fixture(t);
  assert.deepEqual(await readCatalog(root), []);
  const out = await importDocument({ root, filename: input, title: 'Clean water basics', subject: 'water', author: 'Example', safety: 'reference' });
  assert.equal(out.imported, true);
  assert.equal((await searchVault('sanitation', 'water', root)).length, 1);
  assert.equal((await searchVault('sanitation', 'food', root)).length, 0);
  assert.equal((await verifyVault(root)).passed, 1);
  assert.equal((await importDocument({ root, filename: input })).imported, false);
  assert.equal((await readCatalog(root)).length, 1);
  assert.equal(out.entry.reviewStatus, 'unreviewed');
  assert.equal(out.entry.licenseStatus, 'unverified');
});

test('digest verification fails closed after content modification', async (t) => {
  const { root, input } = await fixture(t);
  const { entry } = await importDocument({ root, filename: input });
  await writeFile(objectPath(root, entry.id), 'tampered');
  const report = await verifyVault(root);
  assert.equal(report.passed, 0);
  assert.equal(report.results[0].status, 'FAIL');
});

test('no symlink import, unsupported formats, or insecure provenance URLs', async (t) => {
  const { root, input } = await fixture(t);
  const link = join(root, 'link.md');
  await symlink(input, link);
  await assert.rejects(importDocument({ root, filename: link }), /non-symlink/);
  await assert.rejects(importDocument({ root, filename: input, source: 'http://example.org/a' }), /HTTPS/);
  const dangerous = join(root, 'execute.js');
  await writeFile(dangerous, 'console.log("no")');
  await assert.rejects(importDocument({ root, filename: dangerous }), /Allowed formats/);
});

test('object bytes are content addressed and read-only in the server design', async (t) => {
  const { root, input } = await fixture(t);
  const { entry } = await importDocument({ root, filename: input });
  assert.match(entry.id, /^[a-f0-9]{64}$/);
  assert.equal((await readFile(objectPath(root, entry.id), 'utf8')).includes('Sanitation'), true);
});
