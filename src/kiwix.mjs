import { randomUUID } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { Readable, Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';
import { digestFile, vaultRoot } from './vault.mjs';

const catalogPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'catalog', 'kiwix-selected-r04.json');
const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024;
const MAX_SIDECAR_BYTES = 4096;
const SHA = /^[a-f0-9]{64}$/;
const ID = /^[a-z][a-z0-9-]{1,60}$/;
const SAFE_HOSTS = new Set(['download.kiwix.org', 'lb.download.kiwix.org', 'mirror.download.kiwix.org']);

async function catalog() {
  const content = JSON.parse(await readFile(catalogPath, 'utf8'));
  if (content.schema !== 'phiark-kiwix-selection-v1' || !Array.isArray(content.sources)) {
    throw new Error('Invalid official archive selection catalog');
  }
  const seen = new Set();
  for (const x of content.sources) {
    if (!ID.test(x.id) || seen.has(x.id) || !/^wikipedia_en_[a-z0-9-]+_(mini|maxi|nopic)_20[0-9]{2}-[0-9]{2}\.zim$/.test(x.filename)) {
      throw new Error('Invalid or repeated selection');
    }
    const expected = 'https://download.kiwix.org/zim/wikipedia/' + x.filename;
    if (x.downloadUrl !== expected || x.checksumUrl !== expected + '.sha256' || x.expectedSha256 !== null) {
      throw new Error('Selection has unapproved URL or unverified pinned SHA');
    }
    seen.add(x.id);
  }
  return content;
}
export async function listSelections() {
  return (await catalog()).sources.map(x => ({
    id: x.id, title: x.title, filename: x.filename, approximateSize: x.approximateSize,
    downloadUrl: x.downloadUrl, checksumUrl: x.checksumUrl, rightsStatus: x.rightsStatus,
    acquisitionStatus: 'NOT_CHECKED'
  }));
}
async function selection(id) {
  const found = (await catalog()).sources.find(s => s.id === id);
  if (!found) throw new Error('Unknown Kiwix selection ID');
  return found;
}
function rootPath(root) {
  return join(resolve(root), 'kiwix', 'installed');
}
function installedPath(root, id) {
  if (!ID.test(id)) throw new Error('Bad selection ID');
  return join(rootPath(root), id);
}
async function expectAbsent(target) {
  try {
    await lstat(target);
    throw new Error('Archive already exists; refusing to overwrite: ' + target);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
function requireRegular(info, label) {
  if (!info.isFile() || info.isSymbolicLink()) throw new Error(label + ' must be a real, non-symlink regular file');
}
function parseSidecar(text, filename) {
  const line = text.trim();
  if (line.includes('\n') || line.includes('\r')) throw new Error('Expected one SHA-256 checksum line');
  const match = /^([a-fA-F0-9]{64})(?:[ \t]+[*]?([^\s]+))?$/.exec(line);
  if (!match) throw new Error('Malformed SHA-256 sidecar');
  if (match[2] && match[2] !== filename) throw new Error('Sidecar filename does not match selected archive');
  return match[1].toLowerCase();
}
async function localSidecar(filename, archiveName) {
  const info = await lstat(filename);
  requireRegular(info, 'SHA-256 sidecar');
  if (info.size < 64 || info.size > MAX_SIDECAR_BYTES) throw new Error('Unexpected sidecar length');
  return parseSidecar(await readFile(filename, 'utf8'), archiveName);
}
async function localArchive(file) {
  const info = await lstat(file);
  requireRegular(info, 'ZIM archive');
  if (info.size === 0 || info.size > MAX_ARCHIVE_BYTES) throw new Error('ZIM archive outside 1 GiB per-file R0.4 limit');
  return info;
}
export async function verifyInstalled(id, root = vaultRoot()) {
  const item = await selection(id);
  const folder = installedPath(root, id);
  try {
    const info = await lstat(folder);
    if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Install directory is not a regular directory');
    const zim = join(folder, item.filename);
    const sha = join(folder, item.filename + '.sha256');
    const receiptFile = join(folder, 'receipt.json');
    const receiptInfo = await lstat(receiptFile);
    requireRegular(receiptInfo, 'receipt');
    const receipt = JSON.parse(await readFile(receiptFile, 'utf8'));
    if (receipt.schema !== 'phiark-kiwix-intake-v1' || receipt.id !== id ||
        receipt.filename !== item.filename || !SHA.test(receipt.sha256) ||
        !['operator-supplied-sidecar', 'official-kiwix-https-sidecar'].includes(receipt.checksumOrigin)) {
      throw new Error('Invalid intake receipt');
    }
    const expected = await localSidecar(sha, item.filename);
    if (expected !== receipt.sha256) throw new Error('Receipt/checksum disagreement');
    const bytes = (await localArchive(zim)).size;
    if (bytes !== receipt.bytes || await digestFile(zim) !== expected) throw new Error('Archive bytes do not match SHA-256');
    return { id, status: 'CHECKSUM_MATCHED', bytes, sha256: expected,
      checksumOrigin: receipt.checksumOrigin, contentApproved: false, rightsApproved: false };
  } catch (e) {
    if (e.code === 'ENOENT') {
      try {
        await lstat(folder);
        return { id, status: 'FAIL', reason: 'Installed entry missing expected file' };
      } catch (inner) {
        if (inner.code === 'ENOENT') return { id, status: 'NOT_INSTALLED' };
        return { id, status: 'FAIL', reason: inner.message };
      }
    }
    return { id, status: 'FAIL', reason: e.message };
  }
}
export async function inventory(root = vaultRoot()) {
  const items = await listSelections();
  return Promise.all(items.map(async (item) => ({
    title: item.title, filename: item.filename, ...await verifyInstalled(item.id, root)
  })));
}
export async function importArchive({ id, zimFile, checksumFile, root = vaultRoot(), checksumOrigin = 'operator-supplied-sidecar' }) {
  const item = await selection(id);
  if (basename(zimFile) !== item.filename || basename(checksumFile) !== item.filename + '.sha256') {
    throw new Error('Import filenames must exactly match the selected edition');
  }
  const expected = await localSidecar(checksumFile, item.filename);
  const archiveInfo = await localArchive(zimFile);
  if (await digestFile(zimFile) !== expected) throw new Error('Input ZIM SHA-256 mismatch; nothing imported');
  if (!['operator-supplied-sidecar', 'official-kiwix-https-sidecar'].includes(checksumOrigin)) {
    throw new Error('Unrecognized sidecar provenance');
  }
  const parent = rootPath(root);
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const final = installedPath(root, id);
  await expectAbsent(final);
  const stage = join(parent, '.stage-' + randomUUID());
  await mkdir(stage, { mode: 0o700 });
  try {
    await copyFile(zimFile, join(stage, item.filename));
    await copyFile(checksumFile, join(stage, item.filename + '.sha256'));
    if (await digestFile(join(stage, item.filename)) !== expected) throw new Error('Copy was corrupted');
    if (await localSidecar(join(stage, item.filename + '.sha256'), item.filename) !== expected) throw new Error('Checksum copy changed');
    await writeFile(join(stage, 'receipt.json'), JSON.stringify({
      schema: 'phiark-kiwix-intake-v1', id, filename: item.filename, bytes: archiveInfo.size,
      sha256: expected, checksumOrigin, sourceUrl: item.downloadUrl,
      checksumUrl: item.checksumUrl, checkedAt: new Date().toISOString(),
      rightsStatus: 'NOT_REVIEWED', contentReviewStatus: 'NOT_REVIEWED'
    }, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await expectAbsent(final);
    await rename(stage, final);
  } catch (e) {
    await rm(stage, { recursive: true, force: true });
    throw e;
  }
  const result = await verifyInstalled(id, root);
  if (result.status !== 'CHECKSUM_MATCHED') {
    throw new Error('Post-import verification failed: ' + (result.reason || result.status));
  }
  return { ...result, path: final, note: 'Byte-integrity against the provided SHA-256, not content/license authentication.' };
}

function requireApprovedUrl(urlText) {
  const url = new URL(urlText);
  if (url.protocol !== 'https:' || url.username || url.password || url.port || !SAFE_HOSTS.has(url.hostname) ||
      url.search || url.hash || !/^\/zim\/wikipedia\/wikipedia_en_[a-z0-9-]+_(mini|maxi|nopic)_20[0-9]{2}-[0-9]{2}\.zim(?:\.sha256)?$/.test(url.pathname)) {
    throw new Error('Refusing unapproved download or redirect host/path: ' + urlText);
  }
  return url;
}
async function remoteResponse(url, abortSignal) {
  let current = requireApprovedUrl(url);
  for (let redirect = 0; redirect < 5; redirect++) {
    const response = await fetch(current, { redirect: 'manual', signal: abortSignal, headers: { 'Accept-Encoding': 'identity' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location) throw new Error('Redirect missing location');
      current = requireApprovedUrl(new URL(location, current).href);
      await response.body?.cancel();
      continue;
    }
    if (response.status !== 200 || !response.body) throw new Error('Archive host responded HTTP ' + response.status);
    return response;
  }
  throw new Error('Too many redirects');
}
async function downloadFile(url, dest, limit, deadlineMs) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), deadlineMs);
  try {
    const response = await remoteResponse(url, controller.signal);
    const declared = response.headers.get('content-length');
    if (declared && (!Number.isSafeInteger(Number(declared)) || Number(declared) > limit)) {
      throw new Error('Remote content length exceeds allowed limit');
    }
    let written = 0;
    const guard = new Transform({
      transform(chunk, _encoding, callback) {
        written += chunk.length;
        if (written > limit) callback(new Error('Download exceeds limit'));
        else callback(null, chunk);
      }
    });
    await pipeline(Readable.fromWeb(response.body), guard, createWriteStream(dest, { flags: 'wx', mode: 0o600 }));
    if (written === 0) throw new Error('Empty download');
    return written;
  } finally {
    clearTimeout(timeout);
  }
}
export async function acquireArchive(id, { approved = false, root = vaultRoot() } = {}) {
  if (!approved) throw new Error('Explicit --i-approve-download required; network access is never automatic');
  const item = await selection(id);
  const parent = join(resolve(root), 'kiwix');
  await mkdir(parent, { recursive: true, mode: 0o700 });
  await expectAbsent(installedPath(root, id));
  const stage = join(parent, '.incoming-' + randomUUID());
  await mkdir(stage, { mode: 0o700 });
  try {
    const sidecarFile = join(stage, item.filename + '.sha256');
    const zimFile = join(stage, item.filename);
    await downloadFile(item.checksumUrl, sidecarFile, MAX_SIDECAR_BYTES, 30000);
    const expected = await localSidecar(sidecarFile, item.filename);
    await downloadFile(item.downloadUrl, zimFile, MAX_ARCHIVE_BYTES, 2 * 60 * 60 * 1000);
    if (await digestFile(zimFile) !== expected) throw new Error('Publisher checksum mismatch; refusing install');
    return await importArchive({ id, zimFile, checksumFile: sidecarFile,
      checksumOrigin: 'official-kiwix-https-sidecar', root });
  } finally {
    await rm(stage, { recursive: true, force: true });
  }
}
