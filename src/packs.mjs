import { createHash, randomUUID } from 'node:crypto';
import { copyFile, lstat, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { digestFile, isDocumentId, objectPath, readCatalog, vaultRoot } from './vault.mjs';

const defsRoot = join(dirname(fileURLToPath(import.meta.url)), '..', 'packs');
const IDS = /^[a-z][a-z0-9-]{1,60}$/;
const SNAP_SCHEMA = 'phiark-portable-pack-v1';
const packIds = ['essential-field-r01', 'learning-core-r01'];

function assertId(id) {
  if (!IDS.test(id) || !packIds.includes(id)) throw new Error('Unknown pack ID');
}
function assertRegular(s, label) {
  if (!s.isFile() || s.isSymbolicLink()) throw new Error(label + ' must be a regular file');
}
function assertDirectory(s, label) {
  if (!s.isDirectory() || s.isSymbolicLink()) throw new Error(label + ' must be a real directory');
}
async function readJsonStrict(path) {
  assertRegular(await lstat(path), path);
  return JSON.parse(await readFile(path, 'utf8'));
}
async function writeAtomic(path, data) {
  const tmp = join(dirname(path), '.' + basename(path) + '.' + randomUUID() + '.tmp');
  try {
    await writeFile(tmp, JSON.stringify(data, null, 2) + '\n', { flag: 'wx', mode: 0o600 });
    await rename(tmp, path);
  } finally {
    await rm(tmp, { force: true });
  }
}

export async function listPacks() {
  return Promise.all(packIds.map(async (id) => {
    const p = await loadPack(id);
    return { id: p.id, title: p.title, slots: p.slots.length, summary: p.summary };
  }));
}

export async function loadPack(id) {
  assertId(id);
  const p = await readJsonStrict(join(defsRoot, id + '.json'));
  if (p.schema !== 'phiark-pack-definition-v1' || p.id !== id || !Array.isArray(p.slots) ||
      !p.slots.length || p.slots.length > 50) throw new Error('Invalid pack definition');
  const unique = new Set();
  for (const slot of p.slots) {
    if (!IDS.test(slot.id) || unique.has(slot.id) ||
        !['essential', 'important'].includes(slot.priority) ||
        !['general', 'reference', 'safety-critical'].includes(slot.safety) ||
        !slot.title || !slot.subject) throw new Error('Invalid or repeated slot');
    unique.add(slot.id);
  }
  return p;
}

async function readBindings(root) {
  const path = join(root, 'pack-bindings.json');
  try {
    const b = await readJsonStrict(path);
    if (!b || b.schema !== 'phiark-bindings-v1' || typeof b.packs !== 'object' || Array.isArray(b.packs)) {
      throw new Error('Invalid pack binding state');
    }
    return b;
  } catch (e) {
    if (e.code === 'ENOENT') return { schema: 'phiark-bindings-v1', packs: {} };
    throw e;
  }
}

export async function planPack(id, root = vaultRoot()) {
  const pack = await loadPack(id);
  const docs = await readCatalog(root);
  const bindings = (await readBindings(root)).packs[id] || {};
  const entries = [];
  for (const slot of pack.slots) {
    const digest = bindings[slot.id] || null;
    const document = digest ? docs.find(x => x.id === digest) : null;
    let status = 'MISSING';
    if (digest && !document) status = 'BROKEN_BINDING';
    if (document) {
      try {
        const filename = objectPath(root, document.id);
        const st = await lstat(filename);
        assertRegular(st, 'object');
        if (st.size === document.bytes && await digestFile(filename) === document.id) status = 'HASH_VERIFIED';
        else status = 'CORRUPT';
      } catch { status = 'CORRUPT'; }
    }
    entries.push({
      slot: slot.id, title: slot.title, subject: slot.subject, sourceLead: slot.source,
      priority: slot.priority, safety: slot.safety, status,
      documentId: digest, licenseStatus: document?.licenseStatus || 'not-assessed',
      reviewStatus: document?.reviewStatus || 'not-reviewed'
    });
  }
  return { id: pack.id, title: pack.title, edition: pack.edition, slots: entries,
    hashVerified: entries.filter(x => x.status === 'HASH_VERIFIED').length,
    total: entries.length, safetyApproved: 0,
    note: 'HASH_VERIFIED proves matching bytes only, never accurate guidance or permission to redistribute.' };
}

export async function bindSlot({ id, slotId, digest, root = vaultRoot() }) {
  const def = await loadPack(id);
  if (!isDocumentId(digest)) throw new Error('Expected document SHA-256 digest');
  const slot = def.slots.find(x => x.id === slotId);
  if (!slot) throw new Error('Unknown pack slot');
  const doc = (await readCatalog(root)).find(x => x.id === digest);
  if (!doc) throw new Error('Document digest is absent from local catalog');
  if (doc.subject !== slot.subject) throw new Error('Document subject must match pack slot');
  const file = objectPath(root, digest);
  const info = await lstat(file);
  assertRegular(info, 'selected document');
  if (info.size !== doc.bytes || await digestFile(file) !== digest) throw new Error('Selected document hash/size mismatch');
  const bindings = await readBindings(root);
  bindings.packs[id] ||= {};
  bindings.packs[id][slot.id] = digest;
  await mkdir(root, { recursive: true });
  await writeAtomic(join(root, 'pack-bindings.json'), bindings);
  return { pack: id, slot: slot.id, documentId: digest, status: 'HASH_VERIFIED_NOT_CONTENT_APPROVED' };
}

async function assertMissing(path) {
  try {
    await lstat(path);
    throw new Error('Destination exists; refusing overwrite: ' + path);
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;
  }
}

async function stageDirectory(target, operation) {
  const destination = resolve(target);
  await assertMissing(destination);
  const parent = dirname(destination);
  assertDirectory(await lstat(parent), 'destination parent');
  const staging = join(parent, '.' + basename(destination) + '.phiark-' + randomUUID());
  await mkdir(staging, { mode: 0o700 });
  try {
    const result = await operation(staging);
    await assertMissing(destination);
    await rename(staging, destination);
    return { destination, ...result };
  } catch (e) {
    await rm(staging, { recursive: true, force: true });
    throw e;
  }
}

export async function exportPack(id, target, root = vaultRoot()) {
  const plan = await planPack(id, root);
  const candidates = plan.slots.filter(x => x.documentId);
  if (!candidates.length) throw new Error('No slots bound: use bind before export');
  if (candidates.some(x => x.status !== 'HASH_VERIFIED')) {
    throw new Error('Pack has missing or corrupt bound documents; refusing export');
  }
  const catalog = await readCatalog(root);
  const documentIds = [...new Set(candidates.map(x => x.documentId))].sort();
  const documents = documentIds.map(digest => catalog.find(x => x.id === digest));
  return stageDirectory(target, async (stage) => {
    await mkdir(join(stage, 'objects'));
    for (const doc of documents) {
      const input = objectPath(root, doc.id);
      const output = objectPath(stage, doc.id);
      assertRegular(await lstat(input), 'source object');
      await copyFile(input, output);
      if (await digestFile(output) !== doc.id) throw new Error('Snapshot copy hash mismatch: ' + doc.title);
    }
    await writeFile(join(stage, 'catalog.json'), JSON.stringify(documents, null, 2) + '\n', { flag: 'wx' });
    const catalogHash = await digestFile(join(stage, 'catalog.json'));
    const manifest = {
      schema: SNAP_SCHEMA, packId: id, title: plan.title, exportedAt: new Date().toISOString(),
      catalogSha256: catalogHash, slotBindings: candidates.map(x => ({ slot: x.slot, id: x.documentId })),
      documentIds
    };
    await writeFile(join(stage, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { flag: 'wx' });
    await writeFile(join(stage, 'manifest.sha256'), await digestFile(join(stage, 'manifest.json')) + '\n', { flag: 'wx' });
    const check = await verifySnapshot(stage);
    if (!check.ok) throw new Error('Self-test failed: ' + check.reason);
    return { pack: id, documents: documents.length, boundSlots: candidates.length, verified: true,
      note: 'Integrity only. Confirm individual licensing before sharing.' };
  });
}

export async function verifySnapshot(dir) {
  try {
    const root = resolve(dir);
    assertDirectory(await lstat(root), 'snapshot');
    assertDirectory(await lstat(join(root, 'objects')), 'objects');
    const manifest = await readJsonStrict(join(root, 'manifest.json'));
    const shaFile = join(root, 'manifest.sha256');
    assertRegular(await lstat(shaFile), 'manifest checksum');
    const recordedHash = (await readFile(shaFile, 'utf8')).trim();
    if (!isDocumentId(recordedHash) || recordedHash !== await digestFile(join(root, 'manifest.json'))) {
      throw new Error('manifest checksum mismatch');
    }
    if (manifest.schema !== SNAP_SCHEMA || !packIds.includes(manifest.packId) ||
        !isDocumentId(manifest.catalogSha256) || !Array.isArray(manifest.documentIds) ||
        !Array.isArray(manifest.slotBindings) || !manifest.documentIds.length) throw new Error('invalid manifest schema');
    if (await digestFile(join(root, 'catalog.json')) !== manifest.catalogSha256) throw new Error('catalog checksum mismatch');
    const docs = await readCatalog(root);
    if (docs.length !== manifest.documentIds.length) throw new Error('catalog/document count mismatch');
    const ids = new Set();
    for (const id of manifest.documentIds) {
      if (!isDocumentId(id) || ids.has(id)) throw new Error('invalid/duplicate document ID');
      ids.add(id);
    }
    for (const doc of docs) {
      if (!ids.has(doc.id) || !Number.isSafeInteger(doc.bytes) || doc.bytes < 0) throw new Error('unexpected catalog entry');
      const path = objectPath(root, doc.id);
      const info = await lstat(path);
      assertRegular(info, 'object');
      if (info.size !== doc.bytes || await digestFile(path) !== doc.id) throw new Error('object hash/size mismatch: ' + doc.id);
    }
    const onDisk = await readdir(join(root, 'objects'));
    if (onDisk.length !== ids.size || onDisk.some(name => !ids.has(name))) throw new Error('unexpected object files');
    const def = await loadPack(manifest.packId);
    const slots = new Set();
    for (const binding of manifest.slotBindings) {
      if (!binding || !IDS.test(binding.slot) || slots.has(binding.slot) ||
          !ids.has(binding.id) || !def.slots.some(x => x.id === binding.slot)) throw new Error('invalid slot binding');
      slots.add(binding.slot);
    }
    if (!slots.size) throw new Error('empty snapshot bindings');
    return { ok: true, packId: manifest.packId, documents: docs.length, slots: slots.size, note: 'byte-integrity only' };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

export async function restoreSnapshot(source, target) {
  const sourceRoot = resolve(source);
  const checked = await verifySnapshot(sourceRoot);
  if (!checked.ok) throw new Error('Snapshot verification failed: ' + checked.reason);
  const manifest = await readJsonStrict(join(sourceRoot, 'manifest.json'));
  const catalog = await readCatalog(sourceRoot);
  return stageDirectory(target, async (stage) => {
    await mkdir(join(stage, 'objects'));
    for (const doc of catalog) {
      await copyFile(objectPath(sourceRoot, doc.id), objectPath(stage, doc.id));
    }
    await copyFile(join(sourceRoot, 'catalog.json'), join(stage, 'catalog.json'));
    const bindings = { schema: 'phiark-bindings-v1', packs: {
      [manifest.packId]: Object.fromEntries(manifest.slotBindings.map(x => [x.slot, x.id]))
    }};
    await writeFile(join(stage, 'pack-bindings.json'), JSON.stringify(bindings, null, 2) + '\n');
    // Re-read copied bytes; don't call it restored until every object matches.
    for (const doc of catalog) {
      if (await digestFile(objectPath(stage, doc.id)) !== doc.id) throw new Error('Restore checksum mismatch');
    }
    return { restored: true, pack: manifest.packId, documents: catalog.length,
      note: 'A new vault data directory was created. No old vault was replaced.' };
  });
}

export async function verifyZim(filename, expected) {
  if (typeof expected !== 'string' || !isDocumentId(expected.toLowerCase())) {
    throw new Error('Provide the 64-character publisher SHA-256 digest');
  }
  if (!/\.zim$/i.test(filename)) throw new Error('Expected a .zim archive');
  const s = await lstat(filename);
  assertRegular(s, 'ZIM archive');
  const actual = await digestFile(filename);
  return { file: basename(filename), sizeBytes: s.size, actualSha256: actual,
    expectedSha256: expected.toLowerCase(), matches: actual === expected.toLowerCase(),
    note: 'Matching SHA-256 only validates bytes against the supplied digest; obtain it independently from Kiwix.' };
}
