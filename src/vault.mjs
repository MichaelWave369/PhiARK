import { createHash, randomUUID } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { extname, join, resolve } from 'node:path';

const TYPES = new Map([
  ['.txt', 'text/plain; charset=utf-8'],
  ['.md', 'text/plain; charset=utf-8'],
  ['.pdf', 'application/pdf'],
  ['.epub', 'application/epub+zip']
]);
const SUBJECTS = new Set(['survival','water','food','health','agriculture','engineering','energy','communications','science','education','maps','other']);
const SAFETY = new Set(['general', 'reference', 'safety-critical']);
const MAX_FILE = 512 * 1024 * 1024; // large ZIM archives use Kiwix, not this import path

export function vaultRoot() {
  return resolve(process.env.PHIARK_DATA_DIR || join(process.cwd(), 'data'));
}

export function isDocumentId(id) {
  return typeof id === 'string' && /^[a-f0-9]{64}$/.test(id);
}

export function objectPath(root, id) {
  if (!isDocumentId(id)) throw new Error('Invalid document digest');
  return join(root, 'objects', id);
}

async function ensureVault(root) {
  await mkdir(join(root, 'objects'), { recursive: true, mode: 0o700 });
}

export async function readCatalog(root = vaultRoot()) {
  let content;
  try {
    content = await readFile(join(root, 'catalog.json'), 'utf8');
  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
  const parsed = JSON.parse(content);
  if (!Array.isArray(parsed) || parsed.some((v) => !v || !isDocumentId(v.id))) {
    throw new Error('Invalid catalog: manual inspection required');
  }
  return parsed;
}

async function saveCatalog(root, entries) {
  await ensureVault(root);
  const destination = join(root, 'catalog.json');
  const temp = join(root, '.catalog-' + randomUUID() + '.tmp');
  try {
    await writeFile(temp, JSON.stringify(entries, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    await rename(temp, destination);
  } finally {
    await unlink(temp).catch((error) => { if (error.code !== 'ENOENT') throw error; });
  }
}

export async function digestFile(filename) {
  const h = createHash('sha256');
  for await (const piece of createReadStream(filename)) h.update(piece);
  return h.digest('hex');
}

function cleanText(value, field, max = 256, required = false) {
  const v = String(value || '').trim();
  if ((required && !v) || v.length > max || /[\x00-\x1f\x7f]/.test(v)) {
    throw new Error('Invalid ' + field);
  }
  return v;
}

export async function importDocument({ filename, title, subject = 'other', source = '', author = '', license = '', safety = 'reference', root = vaultRoot() }) {
  if (!filename) throw new Error('Filename required');
  const details = await lstat(filename);
  if (!details.isFile() || details.isSymbolicLink()) throw new Error('Import a regular, non-symlink file');
  if (details.size > MAX_FILE) throw new Error('File exceeds 512 MiB limit; use Kiwix for ZIM archives');
  const extension = extname(filename).toLowerCase();
  if (!TYPES.has(extension)) throw new Error('Allowed formats: .txt, .md, .pdf, .epub');
  const entryTitle = cleanText(title || filename.split(/[\\/]/).pop(), 'title', 256, true);
  if (!SUBJECTS.has(subject)) throw new Error('Unsupported subject');
  if (!SAFETY.has(safety)) throw new Error('Unsupported safety level');
  const entrySource = cleanText(source, 'source URL', 1500);
  if (entrySource && !/^https:\/\//i.test(entrySource)) throw new Error('Source URL must use HTTPS');
  const entryAuthor = cleanText(author, 'author');
  const entryLicense = cleanText(license, 'license');
  await ensureVault(root);
  const id = await digestFile(filename);
  const stored = objectPath(root, id);
  const existing = await readCatalog(root);
  const prior = existing.find((x) => x.id === id);
  if (prior) return { entry: prior, imported: false };
  // Never mutate an existing content-addressed object without inspection.
  try {
    await stat(stored);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
    await copyFile(filename, stored);
  }
  if (await digestFile(stored) !== id) throw new Error('Stored object checksum mismatch; import rejected');
  const entry = {
    id, title: entryTitle, subject, author: entryAuthor, sourceUrl: entrySource,
    license: entryLicense, licenseStatus: 'unverified', reviewStatus: 'unreviewed',
    safety, extension, mime: TYPES.get(extension), bytes: details.size,
    importedAt: new Date().toISOString()
  };
  await saveCatalog(root, [...existing, entry]);
  return { entry, imported: true };
}

export async function verifyVault(root = vaultRoot()) {
  const catalog = await readCatalog(root);
  const results = [];
  for (const entry of catalog) {
    try {
      const object = objectPath(root, entry.id);
      const info = await lstat(object);
      if (!info.isFile() || info.isSymbolicLink()) throw new Error('not a regular file');
      if (info.size !== entry.bytes) throw new Error('size mismatch');
      if (await digestFile(object) !== entry.id) throw new Error('SHA-256 mismatch');
      results.push({ id: entry.id, title: entry.title, status: 'PASS' });
    } catch (error) {
      results.push({ id: entry.id, title: entry.title, status: 'FAIL', reason: error.message });
    }
  }
  return { checked: results.length, passed: results.filter((x) => x.status === 'PASS').length, results };
}

export async function searchVault(query = '', subject = 'all', root = vaultRoot()) {
  const catalog = await readCatalog(root);
  const needle = String(query).trim().toLocaleLowerCase().slice(0, 120);
  const selected = catalog.filter((entry) => subject === 'all' || entry.subject === subject);
  const matches = [];
  for (const entry of selected) {
    const metadata = [entry.title, entry.author, entry.subject, entry.sourceUrl, entry.license].join(' ').toLocaleLowerCase();
    let excerpt = '';
    let matched = !needle || metadata.includes(needle);
    if (needle && ['.md', '.txt'].includes(entry.extension) && entry.bytes <= 1024 * 1024) {
      try {
        const text = await readFile(objectPath(root, entry.id), 'utf8');
        const at = text.toLocaleLowerCase().indexOf(needle);
        if (at >= 0) {
          matched = true;
          excerpt = text.slice(Math.max(0, at - 65), Math.min(text.length, at + needle.length + 125))
            .replace(/\s+/g, ' ').trim();
        }
      } catch {
        // Missing or corrupt objects cannot create a false search hit.
      }
    }
    if (matched) matches.push({ ...entry, excerpt });
  }
  return matches.slice(0, 300);
}

export const SUPPORTED_SUBJECTS = Object.freeze([...SUBJECTS]);
