import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadPack, planPack } from './packs.mjs';

const registryPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'catalog', 'awakening-project-r01.json');
const ITEM_ID = /^kit-[a-f]-[a-z-]+$/;
const VALID_REVIEW = 'NOT_REVIEWED';
const VALID_RIGHTS = 'UNKNOWN';
const VALID_ACQUISITION = 'NOT_DOWNLOADED';

export async function readFieldSourceCatalog() {
  const registry = JSON.parse(await readFile(registryPath, 'utf8'));
  if (!registry || registry.schema !== 'phiark-archive-discovery-v1' ||
    registry.status !== 'EXTERNAL_CANDIDATES_ONLY_NO_LOCAL_BYTES' ||
    !Array.isArray(registry.items) || !registry.items.length ||
    typeof registry.snapshotDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(registry.snapshotDate)) {
    throw new Error('Invalid field source registry');
  }
  const pack = await loadPack('field-skills-r01');
  const knownSlots = new Set(pack.slots.map(s => s.id));
  const seen = new Set();
  for (const item of registry.items) {
    if (!ITEM_ID.test(item.id) || seen.has(item.id)) throw new Error('Invalid or duplicate Archive item ID');
    seen.add(item.id);
    if (item.archiveItemUrl !== 'https://archive.org/details/' + item.id ||
        item.archiveMetadataUrl !== 'https://archive.org/metadata/' + item.id ||
        !item.title || typeof item.title !== 'string' ||
        !/\.zip$/i.test(item.originalArchiveFilename) ||
        !Number.isSafeInteger(item.reportedArchiveBytes) || item.reportedArchiveBytes <= 0 ||
        item.rightsStatus !== VALID_RIGHTS || item.contentReview !== VALID_REVIEW ||
        item.acquisitionStatus !== VALID_ACQUISITION ||
        !Array.isArray(item.fieldSlots) || new Set(item.fieldSlots).size !== item.fieldSlots.length ||
        item.fieldSlots.some(s => !knownSlots.has(s)) ||
        !Array.isArray(item.discoveryTopics) || !Array.isArray(item.caution ? [item.caution] : null)) {
      throw new Error('Invalid source discovery record: ' + item.id);
    }
  }
  return registry;
}

export async function listFieldSourceLeads() {
  const catalog = await readFieldSourceCatalog();
  return {
    snapshotDate: catalog.snapshotDate,
    externalCandidates: catalog.items.length,
    downloadedOrApproved: 0,
    note: 'Metadata discovery only; no ZIP bytes or documents present; rights and content unreviewed.',
    items: catalog.items.map(item => ({
      id: item.id, title: item.title, url: item.archiveItemUrl,
      reportedArchiveBytes: item.reportedArchiveBytes, mappedSlots: item.fieldSlots,
      rightsStatus: item.rightsStatus, contentReview: item.contentReview,
      acquisitionStatus: item.acquisitionStatus
    }))
  };
}

export async function describeFieldSource(id) {
  const catalog = await readFieldSourceCatalog();
  const item = catalog.items.find(x => x.id === id);
  if (!item) throw new Error('Unknown Archive source candidate');
  return { ...item, note: 'External discovery lead only. ZIP internals not assessed. Do not import/extract or redistribute without reviewing origin, individual documents and rights.' };
}

export async function fieldCoverage(root) {
  const [pack, catalog, plan] = await Promise.all([
    loadPack('field-skills-r01'), readFieldSourceCatalog(), planPack('field-skills-r01', root)
  ]);
  return {
    packId: pack.id,
    totalSkills: pack.slots.length,
    hashVerifiedLocalSelections: plan.hashVerified,
    safetyApproved: 0,
    sourceCandidatesAreNotDocuments: true,
    skills: pack.slots.map(slot => ({
      id: slot.id, title: slot.title, subject: slot.subject,
      status: plan.slots.find(x => x.slot === slot.id).status,
      externalLeads: catalog.items.filter(item => item.fieldSlots.includes(slot.id)).map(item => ({
        id: item.id, url: item.archiveItemUrl, rightsStatus: item.rightsStatus, contentReview: item.contentReview
      }))
    })),
    note: 'No status reports real-world proficiency, licensing approval, or clinical/field safety certification.'
  };
}
