import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm, writeFile, symlink } from 'node:fs/promises';
import { importArchive, listSelections } from '../src/kiwix.mjs';
import { planReader, runReader } from '../src/reader.mjs';

async function fixture(t) {
  const parent = await mkdtemp(join(tmpdir(), 'phiark-reader-'));
  t.after(() => rm(parent, { force: true, recursive: true }));
  const root = join(parent, 'private-vault');
  const item = (await listSelections()).find(x => x.id === 'chemistry');
  const zim = join(parent, item.filename);
  const checksum = zim + '.sha256';
  const content = Buffer.from('test-only synthetic archive; not valid ZIM format');
  await writeFile(zim, content);
  const zimHash = createHash('sha256').update(content).digest('hex');
  await writeFile(checksum, zimHash + '  ' + item.filename + '\n');
  const binary = join(parent, 'kiwix-serve-test');
  const binaryContent = '#!/bin/sh\nexit 0\n';
  await writeFile(binary, binaryContent, { mode: 0o755 });
  const binarySha256 = createHash('sha256').update(binaryContent).digest('hex');
  return { parent, root, zim, checksum, binary, binarySha256 };
}
test('reader cannot launch from an empty vault or without consent', async t => {
  const f = await fixture(t);
  await assert.rejects(planReader({ id: 'chemistry', binary: f.binary, binarySha256: f.binarySha256, root: f.root }), /not hash-verified/);
  await assert.rejects(runReader({ id: 'chemistry', binary: f.binary, binarySha256: f.binarySha256, root: f.root }), /approve/);
});
test('launch plan uses a single verified ZIM, loopback and only fixed Kiwix flags', async t => {
  const f = await fixture(t);
  await importArchive({ id: 'chemistry', zimFile: f.zim, checksumFile: f.checksum, root: f.root });
  const plan = await planReader({ id: 'chemistry', binary: f.binary, binarySha256: f.binarySha256, port: 8181, root: f.root });
  assert.deepEqual(plan.args.slice(0,3), ['--address=127.0.0.1', '--port=8181', '--blockexternal']);
  assert.equal(plan.args.length, 4);
  assert.match(plan.args[3], /wikipedia_en_chemistry_mini_2026-10\.zim$/);
  assert.equal(plan.url, 'http://127.0.0.1:8181/');
  assert.equal(plan.authorized, false);
  assert.equal(plan.contentApproved, false);
});
test('rejects changed executable, symlink executable, and unsafe port', async t => {
  const f = await fixture(t);
  await importArchive({ id: 'chemistry', zimFile: f.zim, checksumFile: f.checksum, root: f.root });
  await assert.rejects(planReader({ id: 'chemistry', binary: f.binary, binarySha256: '0'.repeat(64), root: f.root }), /digest mismatch/);
  const link = join(f.parent, 'linked-executable');
  await symlink(f.binary, link);
  await assert.rejects(planReader({ id: 'chemistry', binary: link, binarySha256: f.binarySha256, root: f.root }), /not a symlink/);
  await assert.rejects(planReader({ id: 'chemistry', binary: f.binary, binarySha256: f.binarySha256, port: '80', root: f.root }), /unprivileged integer/);
  await assert.rejects(planReader({ id: 'chemistry', binary: 'kiwix-serve', binarySha256: f.binarySha256, root: f.root }), /absolute path/);
});
test('tampered archive cannot be passed to reader even with valid executable', async t => {
  const f = await fixture(t);
  const installed = await importArchive({ id: 'chemistry', zimFile: f.zim, checksumFile: f.checksum, root: f.root });
  await writeFile(join(installed.path, 'wikipedia_en_chemistry_mini_2026-10.zim'), 'corrupt');
  await assert.rejects(planReader({ id: 'chemistry', binary: f.binary, binarySha256: f.binarySha256, root: f.root }), /not hash-verified/);
});
test('approved launch passes exact arguments without shell or background process', async t => {
  const f = await fixture(t);
  await importArchive({ id: 'chemistry', zimFile: f.zim, checksumFile: f.checksum, root: f.root });
  let captured;
  const mockSpawn = (binary, args, options) => {
    captured = { binary, args, options };
    const child = new EventEmitter();
    child.killed = false;
    child.kill = () => { child.killed = true; return true; };
    queueMicrotask(() => child.emit('exit', 0, null));
    return child;
  };
  const result = await runReader({ id: 'chemistry', binary: f.binary, binarySha256: f.binarySha256, root: f.root, approve: true, spawnProcess: mockSpawn });
  assert.equal(result.status, 'STOPPED');
  assert.equal(captured.options.shell, false);
  assert.equal(captured.options.stdio, 'inherit');
  assert.equal(captured.args.length, 4);
  assert.equal(captured.args[0], '--address=127.0.0.1');
});
