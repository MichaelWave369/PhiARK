import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { request } from 'node:http';
import { mkdtemp, stat, writeFile, symlink, rm, chmod } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectLocalSocket } from '../src/local_socket.mjs';

const serverFile = fileURLToPath(new URL('../src/server.mjs', import.meta.url));
const linux = process.platform === 'linux';

async function dir(t) {
  const root = await mkdtemp(join(tmpdir(), 'phiark-unix-'));
  t.after(() => rm(root, { recursive: true, force: true }));
  return root;
}

function unixEnv(root) {
  const env = { ...process.env };
  for (const key of ['PHIARK_HOST', 'PHIARK_PORT', 'PHIARK_ALLOW_LAN']) delete env[key];
  env.PHIARK_DATA_DIR = root;
  env.PHIARK_SOCKET_PATH = join(root, '.phiark.sock');
  return env;
}

function requestUnix(socketPath, path) {
  return new Promise((resolve, reject) => {
    const req = request({ socketPath, path, method: 'GET', timeout: 2000 }, res => {
      const parts = [];
      res.on('data', part => parts.push(part));
      res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(parts).toString() }));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.end();
  });
}

test('Unix transport serves through private socket without a TCP listener or app authority', { skip: !linux }, async t => {
  const root = await dir(t);
  const env = unixEnv(root);
  const child = spawn(process.execPath, [serverFile], { env, stdio: ['ignore', 'pipe', 'pipe'] });
  t.after(() => { if (child.exitCode === null) child.kill(); });
  const started = new Promise((resolve, reject) => {
    let output = '';
    child.stdout.on('data', buf => {
      output += buf.toString();
      if (output.includes('private Unix socket:')) resolve();
    });
    child.once('error', reject);
    child.once('exit', code => reject(new Error('PhiARK socket server exited: ' + code)));
  });
  let timeout;
  try {
    await Promise.race([
      started, new Promise((_, reject) => {
        timeout = setTimeout(() => reject(new Error('socket server startup timed out')), 5000);
      })
    ]);
  } finally { clearTimeout(timeout); }

  const info = await stat(env.PHIARK_SOCKET_PATH);
  assert.equal(info.isSocket(), true);
  assert.equal(info.mode & 0o077, 0);
  const status = await requestUnix(env.PHIARK_SOCKET_PATH, '/api/status');
  assert.equal(status.status, 200);
  const body = JSON.parse(status.body);
  assert.equal(body.mode, 'LOCAL');
  assert.equal(body.documents, 0);
  assert.equal(body.networkRequired, false);
  assert.equal(body.verified, false);
});

test('Unix transport rejects unsafe path, broad permissions, TCP configuration, and stale socket', { skip: !linux }, async t => {
  const root = await dir(t);
  const env = unixEnv(root);
  assert.equal(await selectLocalSocket(env, root), env.PHIARK_SOCKET_PATH);
  await assert.rejects(selectLocalSocket({ ...env, PHIARK_PORT: '3691' }, root), /forbids TCP/);
  await assert.rejects(selectLocalSocket({ ...env, PHIARK_HOST: '0.0.0.0' }, root), /forbids TCP/);
  await assert.rejects(selectLocalSocket({ ...env, PHIARK_ALLOW_LAN: '1' }, root), /forbids TCP/);
  await assert.rejects(selectLocalSocket({
    ...env, PHIARK_SOCKET_PATH: join(dirname(root), 'outside.sock')
  }, root), /directly inside/);

  await chmod(root, 0o755);
  await assert.rejects(selectLocalSocket(env, root), /not be accessible/);
  await chmod(root, 0o700);
  await writeFile(env.PHIARK_SOCKET_PATH, 'stale');
  await assert.rejects(selectLocalSocket(env, root), /exists/);
  await rm(env.PHIARK_SOCKET_PATH);

  const redirected = join(root, 'redirected');
  await symlink(root, redirected);
  await assert.rejects(selectLocalSocket({
    ...env, PHIARK_DATA_DIR: redirected,
    PHIARK_SOCKET_PATH: join(redirected, '.phiark.sock')
  }, redirected), /unsafe directory component/);
});
