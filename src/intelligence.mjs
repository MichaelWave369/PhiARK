/** PhiARK R0.7: offline signed intelligence vault for FieldShield Sentinel.
 * No fetch, child processes, dynamic execution, imported trust roots or HTTP routes.
 * The operator independently supplies an explicitly trusted local key policy.
 */
import { createHash, createPublicKey, verify as verifySignature, randomUUID } from 'node:crypto';
import { constants } from 'node:fs';
import { open, lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join, resolve, dirname, basename } from 'node:path';
import { vaultRoot } from './vault.mjs';

const DOMAIN = Buffer.from('FieldShield Sentinel Signed IOC v1\0', 'utf8');
const ED25519_SPKI = Buffer.from('302a300506032b6570032100', 'hex');
const MANIFEST_KEYS = ['schema','publisher','key_id','pack_sha256','issued_at','expires_at','signature_b64'];
const HEADER_KEYS = MANIFEST_KEYS.filter(x => x !== 'signature_b64');
const SHA = /^[0-9a-f]{64}$/;
const ID = /^[A-Za-z0-9_.:-]{1,64}$/;
const UTC = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,6})?(?:Z|[+-]\d{2}:\d{2})$/;
const MAX_PACK = 2_000_000;
const MAX_MANIFEST = 16_384;
const MAX_TRUST = 131_072;
const MAX_CATALOG = 1_000_000;

const sha256 = data => createHash('sha256').update(data).digest('hex');
const exactKeys = (obj, keys) => obj && typeof obj === 'object' && !Array.isArray(obj)
  && Object.keys(obj).length === keys.length && keys.every(k => Object.hasOwn(obj,k));
const safeId = value => typeof value === 'string' && ID.test(value);
const isHash = value => typeof value === 'string' && SHA.test(value);

function date(value, name) {
  if (typeof value !== 'string' || !UTC.test(value)) throw new Error('Invalid ' + name + ' timestamp');
  const millis = Date.parse(value);
  if (!Number.isFinite(millis)) throw new Error('Invalid ' + name + ' timestamp');
  return millis;
}
function base64(value, n, name) {
  if (typeof value !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('Invalid ' + name + ' base64');
  }
  const raw = Buffer.from(value, 'base64');
  if (raw.length !== n || raw.toString('base64') !== value) throw new Error('Invalid ' + name + ' length/encoding');
  return raw;
}
function decode(raw, name) {
  if (!Buffer.isBuffer(raw)) throw new Error(name + ' must be bytes');
  let result;
  try { result = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(raw)); }
  catch { throw new Error(name + ' is not UTF-8 JSON'); }
  if (!result || typeof result !== 'object' || Array.isArray(result)) throw new Error(name + ' must be a JSON object');
  return result;
}
function strictManifest(raw) {
  const text = new TextDecoder('utf-8', {fatal:true}).decode(raw);
  const manifest = decode(raw, 'Signature manifest');
  if (!exactKeys(manifest, MANIFEST_KEYS)) throw new Error('Unsupported signed manifest fields');
  // Manifest contains only flat string fields: counting key labels also
  // rejects ambiguous duplicate JSON properties accepted by JSON.parse.
  const matches = [...text.matchAll(/"([a-z_]+)"\s*:/g)];
  if (matches.length !== MANIFEST_KEYS.length ||
      MANIFEST_KEYS.some(k => matches.filter(m => m[1] === k).length !== 1)) {
    throw new Error('Ambiguous or duplicate signed manifest properties');
  }
  return manifest;
}
function headerMessage(manifest) {
  const header = Object.fromEntries(HEADER_KEYS.map(k => [k, manifest[k]]));
  const sorted = Object.fromEntries(
    Object.entries(header).sort(([a], [b]) => a.localeCompare(b, 'en-US'))
  );
  return Buffer.concat([DOMAIN, Buffer.from(JSON.stringify(sorted), 'utf8')]);
}
function validatePolicy(policy, publisher, keyId, digest, issued) {
  if (!exactKeys(policy, ['schema','publishers']) ||
      policy.schema !== 'fieldshield.trust-store.v1' ||
      !Array.isArray(policy.publishers) || policy.publishers.length > 100) {
    throw new Error('Unsupported local trust policy');
  }
  const seenPublishers = new Set();
  let chosen;
  for (const row of policy.publishers) {
    if (!exactKeys(row, ['id','keys','blocked_pack_sha256','minimum_issued_at']) ||
        !safeId(row.id) || seenPublishers.has(row.id)) throw new Error('Invalid/duplicate publisher trust row');
    seenPublishers.add(row.id);
    if (row.id === publisher) chosen = row;
  }
  if (!chosen) throw new Error('Untrusted publisher: explicit local trust required');
  if (!Array.isArray(chosen.blocked_pack_sha256) ||
      chosen.blocked_pack_sha256.some(x => !isHash(x))) throw new Error('Invalid digest blocklist');
  if (chosen.blocked_pack_sha256.includes(digest)) throw new Error('Pack digest blocked by local policy');
  if (issued < date(chosen.minimum_issued_at, 'minimum_issued_at')) throw new Error('Pack signature below local issuance floor');
  if (!Array.isArray(chosen.keys) || chosen.keys.length > 100) throw new Error('Invalid key roster');
  const seenKeys = new Set();
  let trusted;
  for (const key of chosen.keys) {
    if (!exactKeys(key, ['id','algorithm','state','public_key_b64']) ||
        !safeId(key.id) || seenKeys.has(key.id) ||
        key.algorithm !== 'ed25519' || !['trusted','revoked'].includes(key.state)) {
      throw new Error('Invalid/duplicate trusted key row');
    }
    seenKeys.add(key.id);
    const raw = base64(key.public_key_b64, 32, 'Ed25519 public key');
    if (key.id === keyId) {
      if (key.state !== 'trusted') throw new Error('Publisher key revoked');
      trusted = raw;
    }
  }
  if (!trusted) throw new Error('Unknown signing key; no automatic trust');
  return trusted;
}

export function verifyIntelligenceBytes(packRaw, manifestRaw, trustRaw, now = Date.now()) {
  if (packRaw.length > MAX_PACK || manifestRaw.length > MAX_MANIFEST || trustRaw.length > MAX_TRUST)
    throw new Error('Input exceeds size limit');
  const manifest = strictManifest(manifestRaw);
  if (manifest.schema !== 'fieldshield.signed-ioc.v1' ||
      !safeId(manifest.publisher) || !safeId(manifest.key_id) ||
      !isHash(manifest.pack_sha256)) throw new Error('Invalid signed manifest identity');
  const issued = date(manifest.issued_at,'issued_at');
  const expires = date(manifest.expires_at,'expires_at');
  if (expires <= issued || issued > now || expires <= now) throw new Error('Manifest not currently valid');
  const digest = sha256(packRaw);
  if (digest !== manifest.pack_sha256) throw new Error('IOC pack hash mismatch');
  const trusted = validatePolicy(decode(trustRaw,'Trust store'), manifest.publisher,
    manifest.key_id, digest, issued);
  const pub = createPublicKey({
    key: Buffer.concat([ED25519_SPKI, trusted]), format: 'der', type: 'spki'
  });
  if (!verifySignature(null, headerMessage(manifest), pub,
      base64(manifest.signature_b64, 64, 'Ed25519 signature'))) {
    throw new Error('Detached Ed25519 signature invalid');
  }
  const pack = decode(packRaw,'IOC pack');
  if (pack.schema !== 'fieldshield.ioc-pack.v1' ||
      typeof pack.source !== 'string' || !pack.source ||
      !Array.isArray(pack.indicators) || pack.indicators.length < 1 ||
      pack.indicators.length > 100_000) throw new Error('Unsupported IOC pack schema');
  const packIssued = date(pack.issued_at, 'pack issued_at');
  if (packIssued > issued || packIssued > now) throw new Error('Pack issuance exceeds signed time');
  return {
    id: digest, publisher: manifest.publisher, keyId: manifest.key_id,
    indicatorsClaimed: pack.indicators.length, source: pack.source.slice(0, 256),
    manifestSha256: sha256(manifestRaw), publicKeySha256: sha256(trusted),
    signatureExpiresAt: manifest.expires_at,
    status: 'SIGNATURE_VERIFIED_NOT_CONTENT_APPROVED',
    note: 'Signature establishes locally pinned key authenticity, not IOC accuracy, license rights, or device safety.'
  };
}

async function snapshot(path, limit) {
  const name = resolve(path);
  const flag = constants.O_RDONLY | (constants.O_NOFOLLOW || 0);
  const fd = await open(name, flag);
  try {
    const before = await fd.stat();
    if (!before.isFile() || before.size > limit) throw new Error('Input must be a bounded regular file');
    const buffer = Buffer.alloc(limit + 1);
    let cursor = 0;
    while (cursor < buffer.length) {
      const { bytesRead } = await fd.read(buffer, cursor, buffer.length - cursor, cursor);
      if (!bytesRead) break;
      cursor += bytesRead;
    }
    const after = await fd.stat();
    if (cursor > limit || before.size !== cursor || after.size !== before.size ||
        after.mtimeMs !== before.mtimeMs) throw new Error('File changed or exceeded size limit');
    return buffer.subarray(0, cursor);
  } finally { await fd.close(); }
}

const intelRoot = root => join(resolve(root), 'intelligence');
const objectDir = (root,id) => {
  if (!isHash(id)) throw new Error('Invalid IOC SHA-256 ID');
  return join(intelRoot(root), 'objects', id);
};
async function assertDirectory(path) {
  const entry = await lstat(path);
  if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error('Expected real directory: ' + path);
}
async function catalog(root) {
  let raw;
  try { raw = await snapshot(join(intelRoot(root),'catalog.json'), MAX_CATALOG); }
  catch (e) {
    if (e.code === 'ENOENT') return [];
    throw e;
  }
  const parsed = decode(raw,'Intelligence catalog');
  if (!exactKeys(parsed,['schema','entries']) || parsed.schema !== 'phiark-intelligence-catalog.v1' ||
      !Array.isArray(parsed.entries) || parsed.entries.length > 1000 ||
      parsed.entries.some(x => !x || !isHash(x.id))) throw new Error('Invalid intelligence catalog');
  const ids = parsed.entries.map(x => x.id);
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate intelligence catalog objects');
  return parsed.entries;
}
async function saveCatalog(root, entries) {
  const base = intelRoot(root);
  const target = join(base,'catalog.json');
  try {
    const existing = await lstat(target);
    if (!existing.isFile() || existing.isSymbolicLink()) throw new Error('Unsafe intelligence catalog destination');
  } catch (e) { if (e.code !== 'ENOENT') throw e; }
  const tmp = join(base,'.catalog-'+randomUUID());
  try {
    await writeFile(tmp, JSON.stringify({schema:'phiark-intelligence-catalog.v1',entries},null,2)+'\n',
      {flag:'wx', mode:0o600});
    await rename(tmp,target);
  } finally { await rm(tmp,{force:true}); }
}
async function withLock(root, fn) {
  const base = intelRoot(root);
  await mkdir(base, {recursive:true, mode:0o700});
  await assertDirectory(base);
  const lock = join(base,'.write-lock');
  await mkdir(lock,{mode:0o700}); // refuse concurrent writers
  try { return await fn(); } finally { await rm(lock,{recursive:true}); }
}

export async function importIntelligence({packPath, manifestPath, trustPath,
                                        approved=false, root=vaultRoot()}) {
  if (!approved) throw new Error('Explicit --i-approve-import flag required');
  const [packRaw,manifestRaw,trustRaw] = await Promise.all([
    snapshot(packPath,MAX_PACK),snapshot(manifestPath,MAX_MANIFEST),snapshot(trustPath,MAX_TRUST)
  ]);
  const receipt = verifyIntelligenceBytes(packRaw,manifestRaw,trustRaw);
  return withLock(root, async () => {
    const rows = await catalog(root);
    if (rows.some(x => x.id === receipt.id)) {
      const existing = await verifyOne(root,receipt.id,trustRaw);
      if (existing.manifestSha256 !== receipt.manifestSha256) throw new Error('Existing object uses a different signed manifest');
      return {imported:false, ...existing};
    }
    if (rows.length >= 1000) throw new Error('Intelligence catalog capacity reached');
    const parent = join(intelRoot(root),'objects');
    await mkdir(parent,{recursive:true, mode:0o700});
    await assertDirectory(parent);
    const dest = objectDir(root,receipt.id);
    try { await lstat(dest); throw new Error('Uncataloged object directory exists; manual review required'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; }
    const staged = join(parent,'.stage-'+randomUUID());
    await mkdir(staged,{mode:0o700});
    let committed = false;
    try {
      await writeFile(join(staged,'pack.json'),packRaw,{flag:'wx',mode:0o600});
      await writeFile(join(staged,'manifest.json'),manifestRaw,{flag:'wx',mode:0o600});
      await rename(staged,dest);
      committed = true;
      const entry = {...receipt, importedAt:new Date().toISOString()};
      await saveCatalog(root,[...rows,entry]);
      return {imported:true, ...entry};
    } catch (error) {
      if (committed) await rm(dest,{recursive:true,force:true});
      throw error;
    } finally { await rm(staged,{recursive:true,force:true}); }
  });
}

async function verifyOne(root,id,trustRaw) {
  const target = objectDir(root,id);
  await assertDirectory(target);
  const [pack,manifest] = await Promise.all([
    snapshot(join(target,'pack.json'),MAX_PACK),
    snapshot(join(target,'manifest.json'),MAX_MANIFEST)
  ]);
  const receipt = verifyIntelligenceBytes(pack,manifest,trustRaw);
  if (receipt.id !== id) throw new Error('Object-directory SHA-256 mismatch');
  return receipt;
}
export async function listIntelligence(root=vaultRoot()) {
  return catalog(root); // catalog is metadata, NOT a fresh signature verification
}
export async function verifyIntelligence(trustPath,root=vaultRoot()) {
  const trust = await snapshot(trustPath,MAX_TRUST);
  const rows = await catalog(root);
  const results=[];
  for (const item of rows) {
    try {
      const receipt=await verifyOne(root,item.id,trust);
      if (receipt.manifestSha256!==item.manifestSha256 ||
          receipt.publisher!==item.publisher || receipt.keyId!==item.keyId) {
        throw new Error('Stored catalog provenance mismatch');
      }
      results.push({id:item.id,status:'VERIFIED_NOW',publisher:receipt.publisher});
    } catch (e) { results.push({id:item.id,status:'FAIL',reason:e.message}); }
  }
  return {checked:results.length,passed:results.filter(x=>x.status==='VERIFIED_NOW').length,
    results, note:'Empty catalogs are not evidence of safety. Verify after trust-policy updates.'};
}
export async function exportIntelligence({id,destination,trustPath,
                                         approved=false,root=vaultRoot()}) {
  if (!approved) throw new Error('Explicit --i-approve-export flag required');
  const trust = await snapshot(trustPath,MAX_TRUST);
  const rows = await catalog(root);
  const entry = rows.find(x=>x.id===id);
  if (!entry) throw new Error('Unknown intelligence digest');
  const receipt = await verifyOne(root,id,trust);
  if (receipt.manifestSha256!==entry.manifestSha256) throw new Error('Catalog receipt mismatch');
  const dest = resolve(destination);
  await assertDirectory(dirname(dest));
  try { await lstat(dest); throw new Error('Destination exists; refusing overwrite'); }
  catch (e) { if (e.code!=='ENOENT') throw e; }
  const stage=join(dirname(dest),'.'+basename(dest)+'.intelligence-'+randomUUID());
  await mkdir(stage,{mode:0o700});
  try {
    const obj=objectDir(root,id);
    await writeFile(join(stage,'pack.json'),await snapshot(join(obj,'pack.json'),MAX_PACK),{flag:'wx',mode:0o600});
    await writeFile(join(stage,'manifest.json'),await snapshot(join(obj,'manifest.json'),MAX_MANIFEST),{flag:'wx',mode:0o600});
    const verification=verifyIntelligenceBytes(
      await snapshot(join(stage,'pack.json'),MAX_PACK),
      await snapshot(join(stage,'manifest.json'),MAX_MANIFEST), trust);
    if (verification.id!==id || verification.manifestSha256!==receipt.manifestSha256) {
      throw new Error('Staged export verification failed');
    }
    await writeFile(join(stage,'README.txt'),
      'PhiARK offline Sentinel intelligence export\nSupply your independently trusted local trust-store file to verify.\nThis archive never includes trust roots or evidence reports.\n',
      {flag:'wx',mode:0o600});
    try { await lstat(dest); throw new Error('Destination appeared; refusing overwrite'); }
    catch (e) { if (e.code!=='ENOENT') throw e; }
    await rename(stage,dest);
    return {exported:true,id,destination:dest,verifiedAgainstLocalTrust:true};
  } finally { await rm(stage,{recursive:true,force:true}); }
}
