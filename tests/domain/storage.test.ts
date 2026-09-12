import { describe, expect, it } from 'vitest';
import { CriteriaSchema, SEED_CRITERIA } from '../../src/domain/schema.js';
import { clearStored, readStored, writeStored, workspaceStorageKey, type Stored } from '../../src/lib/storage.js';

class MemoryStorage {
  private values = new Map<string, string>();
  getItem(key: string) { return this.values.has(key) ? this.values.get(key)! : null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

describe('account scoped workspace storage', () => {
  it('uses a guest key and URI encodes account subjects', () => {
    expect(workspaceStorageKey(null)).toBe('onestop-search-v2:guest');
    expect(workspaceStorageKey('auth0|abc/def')).toBe('onestop-search-v2:account:auth0%7Cabc%2Fdef');
  });

  it('round trips valid criteria and bounded workspace state', () => {
    const storage = new MemoryStorage();
    const data: Stored = {
      criteria: SEED_CRITERIA,
      baseline: SEED_CRITERIA,
      selectedHomeId: 'home-1',
      compareIds: ['home-1', 'home-2', 'home-1'],
      shortlistIds: ['home-2'],
      shortlistMeta: { 'home-2': { title: 'A home', url: 'https://example.com/home-2' } },
      snapshotId: 'snapshot-1',
    };
    expect(writeStored(storage, null, data)).toBe(true);
    expect(readStored(storage, null)).toEqual({ ...data, compareIds: ['home-1', 'home-2'] });
  });

  it('drops malformed fields while retaining independently valid state', () => {
    const storage = new MemoryStorage();
    storage.setItem(workspaceStorageKey(null), JSON.stringify({
      criteria: { nope: true },
      baseline: SEED_CRITERIA,
      selectedHomeId: 4,
      compareIds: ['ok', 4, '', 'ok'],
      shortlistIds: 'bad',
      shortlistMeta: { ok: { title: 'valid', url: 'https://example.com' }, bad: { title: 2, url: null } },
      snapshotId: 9,
      ignored: 'field',
    }));
    expect(readStored(storage, null)).toEqual({
      baseline: SEED_CRITERIA,
      compareIds: ['ok'],
      shortlistMeta: { ok: { title: 'valid', url: 'https://example.com' } },
    });
  });

  it('migrates the legacy guest record once, only after writing the new key', () => {
    const storage = new MemoryStorage();
    const legacy: Stored = { criteria: SEED_CRITERIA, selectedHomeId: null };
    storage.setItem('address-search-v1', JSON.stringify(legacy));
    expect(readStored(storage, null)).toEqual(legacy);
    expect(storage.getItem('address-search-v1')).toBeNull();
    expect(storage.getItem(workspaceStorageKey(null))).toBe(JSON.stringify(legacy));
  });

  it('never reads or removes legacy data for a signed-in account', () => {
    const storage = new MemoryStorage();
    storage.setItem('address-search-v1', JSON.stringify({ criteria: SEED_CRITERIA }));
    expect(readStored(storage, 'auth0|user')).toEqual({});
    expect(clearStored(storage, 'auth0|user')).toBe(true);
    expect(storage.getItem('address-search-v1')).not.toBeNull();
  });

  it('clears guest state and its legacy fallback so clearing cannot resurrect it', () => {
    const storage = new MemoryStorage();
    storage.setItem(workspaceStorageKey(null), JSON.stringify({ snapshotId: 'new' }));
    storage.setItem('address-search-v1', JSON.stringify({ snapshotId: 'old' }));
    expect(clearStored(storage, null)).toBe(true);
    expect(readStored(storage, null)).toEqual({});
  });

  it('returns safely when storage operations throw and does not claim a write', () => {
    const broken = {
      getItem: () => { throw new Error('blocked'); },
      setItem: () => { throw new Error('blocked'); },
      removeItem: () => { throw new Error('blocked'); },
    };
    expect(readStored(broken, null)).toEqual({});
    expect(writeStored(broken, null, { snapshotId: 'x' })).toBe(false);
    expect(clearStored(broken, null)).toBe(false);
  });

  it('rejects invalid criteria rather than persisting them', () => {
    const storage = new MemoryStorage();
    expect(writeStored(storage, null, { criteria: { invalid: true } as never })).toBe(true);
    expect(readStored(storage, null)).toEqual({});
    expect(CriteriaSchema.safeParse(readStored(storage, null).criteria).success).toBe(false);
  });
});
