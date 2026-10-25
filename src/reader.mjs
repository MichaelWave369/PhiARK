import { spawn } from 'node:child_process';
import { lstat } from 'node:fs/promises';
import { isAbsolute, join, resolve } from 'node:path';
import { digestFile, vaultRoot } from './vault.mjs';
import { listSelections, verifyInstalled } from './kiwix.mjs';

const HASH = /^[a-f0-9]{64}$/;
const PORT_MIN = 1024;
const PORT_MAX = 65535;

function parsePort(port) {
  const value = Number(port);
  if (!Number.isInteger(value) || value < PORT_MIN || value > PORT_MAX) {
    throw new Error('Kiwix reader port must be an unprivileged integer between 1024 and 65535');
  }
  return value;
}

async function verifyBinary(binaryPath, expectedHash) {
  if (typeof binaryPath !== 'string' || !isAbsolute(binaryPath)) {
    throw new Error('Provide the absolute path to an operator-selected kiwix-serve executable');
  }
  if (!HASH.test(String(expectedHash || '').toLowerCase())) {
    throw new Error('Require --binary-sha256 with the expected executable SHA-256 digest');
  }
  const path = resolve(binaryPath);
  const info = await lstat(path);
  if (!info.isFile() || info.isSymbolicLink()) {
    throw new Error('Kiwix executable must be a regular file, not a symlink');
  }
  if (!info.size) throw new Error('Kiwix executable is empty');
  const actual = await digestFile(path);
  if (actual !== expectedHash.toLowerCase()) {
    throw new Error('Kiwix executable digest mismatch: refusing launch');
  }
  return { path, hash: actual };
}

export async function planReader({
  id, binary, binarySha256, port = 8181, root = vaultRoot()
}) {
  const all = await listSelections();
  const item = all.find(x => x.id === id);
  if (!item) throw new Error('Unknown selected archive ID');

  const verified = await verifyInstalled(id, root);
  if (verified.status !== 'CHECKSUM_MATCHED') {
    throw new Error('Archive is not hash-verified: ' + verified.status);
  }
  const selectedExecutable = await verifyBinary(binary, binarySha256);
  const selectedPort = parsePort(port);
  // Reuse the exact object from the verified archive catalog; never use caller-provided ZIM paths.
  const archive = join(resolve(root), 'kiwix', 'installed', id, item.filename);
  return {
    id, archive, archiveSha256: verified.sha256,
    binary: selectedExecutable.path, binarySha256: selectedExecutable.hash,
    args: ['--address=127.0.0.1', '--port=' + selectedPort, '--blockexternal', archive],
    url: 'http://127.0.0.1:' + selectedPort + '/',
    address: '127.0.0.1',
    port: selectedPort,
    contentApproved: false,
    rightsApproved: false,
    authorized: false,
    note: 'Dry-run launch plan only. Operator approval is required separately to start the program.'
  };
}

export async function runReader({
  id, binary, binarySha256, port = 8181, root = vaultRoot(), approve = false,
  spawnProcess = spawn
}) {
  if (approve !== true) throw new Error('Start requires explicit --i-approve-launch');
  const plan = await planReader({ id, binary, binarySha256, port, root });
  // Integrity is checked before spawn and only specific args are constructed. No shell,
  // daemon flag, arbitrary flags, remote listen address or user-chosen document paths.
  const child = spawnProcess(plan.binary, plan.args, {
    shell: false, stdio: 'inherit', windowsHide: true
  });
  console.log('PhiARK reader starting at ' + plan.url);
  console.log('Only ' + plan.id + ' is selected. Press Ctrl+C to stop it.');
  return await new Promise((resolve, reject) => {
    let settled = false;
    let stopping = false;
    const stop = () => {
      if (stopping) return;
      stopping = true;
      if (!child.killed) child.kill('SIGTERM');
    };
    const clear = () => {
      process.off('SIGINT', stop);
      process.off('SIGTERM', stop);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
    child.once('error', (error) => {
      if (settled) return;
      settled = true; clear(); reject(error);
    });
    child.once('exit', (code, signal) => {
      if (settled) return;
      settled = true; clear();
      if (code === 0 || (stopping && ['SIGINT', 'SIGTERM'].includes(signal))) resolve({ status: 'STOPPED', exitCode: code, signal });
      else reject(new Error('kiwix-serve terminated unexpectedly: exit ' + code + ', signal ' + signal));
    });
  });
}
