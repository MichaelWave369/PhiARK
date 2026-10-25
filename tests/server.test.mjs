import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const serverFile = fileURLToPath(new URL('../src/server.mjs', import.meta.url));

async function startServer(t, root) {
  const server = spawn(process.execPath, [serverFile], {
    env: { ...process.env, PHIARK_DATA_DIR: root, PHIARK_HOST: '127.0.0.1',
      PHIARK_PORT: '0', PHIARK_ALLOW_LAN: '0' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  t.after(() => { if (!server.killed) server.kill(); });
  let timer;
  const started = new Promise((resolve, reject) => {
    let output = '';
    server.stdout.on('data', chunk => {
      output += chunk.toString();
      const match = output.match(/http:\/\/127\.0\.0\.1:(\d+)/);
      if (match) resolve(Number(match[1]));
    });
    server.once('error', reject);
    server.once('exit', code => reject(new Error('PhiARK server exited before ready: ' + code)));
  });
  try {
    return await Promise.race([
      started,
      new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error('PhiARK server startup timeout')), 5000);
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

test('document GET/HEAD fails closed on same-size corruption, missing objects and symlinks', async t => {
  const root = await mkdtemp(join(tmpdir(), 'phiark-http-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  const objects = join(root, 'objects');
  await mkdir(objects);
  const original = '# Offline knowledge\nVerify before using.\n';
  const digest = createHash('sha256').update(original).digest('hex');
  const path = join(objects, digest);
  await writeFile(path, original);
  await writeFile(join(root, 'catalog.json'), JSON.stringify([{
    id: digest, bytes: Buffer.byteLength(original), extension: '.md',
    mime: 'text/plain; charset=utf-8', title: 'Knowledge', reviewStatus: 'unreviewed'
  }]));
  const port = await startServer(t, root);
  const address = 'http://127.0.0.1:' + port + '/documents/' + digest;

  const valid = await fetch(address);
  assert.equal(valid.status, 200);
  assert.equal(await valid.text(), original);
  const validHead = await fetch(address, { method: 'HEAD' });
  assert.equal(validHead.status, 200);
  assert.equal(validHead.headers.get('content-length'), String(Buffer.byteLength(original)));
  assert.equal(await validHead.text(), '');

  await writeFile(path, 'X' + original.slice(1)); // identical length; wrong digest
  const corrupt = await fetch(address);
  assert.equal(corrupt.status, 409);
  assert.match(await corrupt.text(), /integrity check required/);
  const corruptHead = await fetch(address, { method: 'HEAD' });
  assert.equal(corruptHead.status, 409);
  assert.equal(await corruptHead.text(), '');

  await rm(path);
  assert.equal((await fetch(address)).status, 409);

  // A symlink to valid bytes must not be accepted as a vault object.
  const outside = join(root, 'outside.md');
  await writeFile(outside, original);
  try {
    await symlink(outside, path);
  } catch (error) {
    if (error.code === 'EPERM' || error.code === 'ENOTSUP') {
      t.diagnostic('symlinks unavailable on this host');
      return;
    }
    throw error;
  }
  assert.equal((await fetch(address)).status, 409);
});
