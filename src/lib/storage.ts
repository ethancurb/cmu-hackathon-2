import { CriteriaSchema, type Criteria } from '../domain/schema.js';

export type SavedHomeLabel = { title: string; url: string };
export type Stored = {
  criteria?: Criteria;
  baseline?: Criteria;
  selectedHomeId?: string | null;
  compareIds?: string[];
  shortlistIds?: string[];
  shortlistMeta?: Record<string, SavedHomeLabel>;
  snapshotId?: string;
};

const GUEST_KEY = 'onestop-search-v2:guest';
const LEGACY_KEY = 'address-search-v1';
const MAX_IDS = 100;
const MAX_ID_LENGTH = 256;
const MAX_LABEL_LENGTH = 1000;

export function workspaceStorageKey(sub: string | null): string {
  return sub === null ? GUEST_KEY : `onestop-search-v2:account:${encodeURIComponent(sub)}`;
}

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);
const boundedString = (value: unknown, max: number): value is string => typeof value === 'string' && value.length > 0 && value.length <= max;

function cleanIds(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const result: string[] = [];
  for (const item of value) {
    if (boundedString(item, MAX_ID_LENGTH) && !result.includes(item)) result.push(item);
    if (result.length === MAX_IDS) break;
  }
  return result;
}

function cleanMeta(value: unknown): Record<string, SavedHomeLabel> | undefined {
  if (!isRecord(value)) return undefined;
  const result: Record<string, SavedHomeLabel> = {};
  for (const [id, label] of Object.entries(value)) {
    if (Object.keys(result).length === MAX_IDS) break;
    if (boundedString(id, MAX_ID_LENGTH) && isRecord(label) && boundedString(label.title, MAX_LABEL_LENGTH) && boundedString(label.url, MAX_LABEL_LENGTH)) {
      result[id] = { title: label.title, url: label.url };
    }
  }
  return result;
}

function sanitize(value: unknown): Stored {
  if (!isRecord(value)) return {};
  const result: Stored = {};
  if (CriteriaSchema.safeParse(value.criteria).success) result.criteria = CriteriaSchema.parse(value.criteria);
  if (CriteriaSchema.safeParse(value.baseline).success) result.baseline = CriteriaSchema.parse(value.baseline);
  if (value.selectedHomeId === null) result.selectedHomeId = null;
  else if (boundedString(value.selectedHomeId, MAX_ID_LENGTH)) result.selectedHomeId = value.selectedHomeId;
  const compareIds = cleanIds(value.compareIds);
  if (compareIds) result.compareIds = compareIds;
  const shortlistIds = cleanIds(value.shortlistIds);
  if (shortlistIds) result.shortlistIds = shortlistIds;
  const shortlistMeta = cleanMeta(value.shortlistMeta);
  if (shortlistMeta) result.shortlistMeta = shortlistMeta;
  if (boundedString(value.snapshotId, MAX_ID_LENGTH)) result.snapshotId = value.snapshotId;
  return result;
}

function parseStored(raw: string): Stored | null {
  try {
    return sanitize(JSON.parse(raw));
  } catch {
    return null;
  }
}

export function readStored(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, sub: string | null): Stored {
  let raw: string | null;
  try { raw = storage.getItem(workspaceStorageKey(sub)); } catch { return {}; }
  if (raw !== null) return parseStored(raw) ?? {};
  if (sub !== null) return {};

  let legacyRaw: string | null;
  try { legacyRaw = storage.getItem(LEGACY_KEY); } catch { return {}; }
  if (legacyRaw === null) return {};
  const migrated = parseStored(legacyRaw);
  if (migrated === null) return {};
  try {
    storage.setItem(GUEST_KEY, JSON.stringify(migrated));
  } catch {
    return migrated;
  }
  try { storage.removeItem(LEGACY_KEY); } catch { /* leave migration available for a later read */ }
  return migrated;
}

export function writeStored(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, sub: string | null, data: Stored): boolean {
  try {
    storage.setItem(workspaceStorageKey(sub), JSON.stringify(sanitize(data)));
    return true;
  } catch {
    return false;
  }
}

export function clearStored(storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>, sub: string | null): boolean {
  try {
    if (sub === null) storage.removeItem(LEGACY_KEY);
    storage.removeItem(workspaceStorageKey(sub));
    return true;
  } catch {
    return false;
  }
}
