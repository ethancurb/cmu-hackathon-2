import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Snapshot } from '../../src/domain/schema.js';
import { createSnapshotStore } from '../../server/snapshots.js';

const directories: string[] = [];
const snapshot = (id: string): Snapshot => ({
  schemaVersion: 1, id, createdAt: '2026-09-12T09:00:00.000Z',
  discoveryMarket: { label: 'Test city', region: 'PA', country: 'US' },
  searchDescription: 'Synthetic empty snapshot for storage integrity tests',
  researchScopes: [], homes: [], evidence: [], routes: [], sources: [], sourceRuns: [],
});
async function setup() {
  const directory = await mkdtemp(path.join(tmpdir(), 'address-store-test-'));
  directories.push(directory);
  return { directory, store: createSnapshotStore(directory) };
}
afterEach(async () => { await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true }))); });

describe('immutable snapshots and atomic current pointer', () => {
  it('publishes a retrievable snapshot before moving the current pointer', async () => {
    const { directory, store } = await setup();
    await store.publish(snapshot('seed-one'));
    expect((await store.loadCurrent()).id).toBe('seed-one');
    expect((await store.load('seed-one')).searchDescription).toContain('Synthetic');
    expect(JSON.parse(await readFile(path.join(directory, 'current.json'), 'utf8')).snapshotId).toBe('seed-one');
  });
  it('keeps the last good snapshot when a new snapshot cannot be written', async () => {
    const { directory, store } = await setup();
    await store.publish(snapshot('good'));
    await mkdir(path.join(directory, 'snapshots', 'broken', 'snapshot.json'), { recursive: true });
    await expect(store.publish(snapshot('broken'))).rejects.toThrow();
    expect((await store.loadCurrent()).id).toBe('good');
  });
  it('does not overwrite an immutable result with different content', async () => {
    const { store } = await setup();
    await store.publish(snapshot('same-id'));
    await expect(store.publish({ ...snapshot('same-id'), searchDescription: 'Different data' })).rejects.toMatchObject({ code: 'SNAPSHOT_EXISTS' });
    expect((await store.load('same-id')).searchDescription).toContain('Synthetic');
  });
  it('rejects path traversal rather than treating a requested ID as a filename', async () => {
    const { store } = await setup();
    await expect(store.load('../../private')).rejects.toMatchObject({ code: 'INVALID_SNAPSHOT_ID' });
  });
  it('ignores an incomplete candidate file while reading the current snapshot', async () => {
    const { directory, store } = await setup();
    await store.publish(snapshot('complete'));
    await writeFile(path.join(directory, 'current.json.partial'), '{');
    expect((await store.loadCurrent()).id).toBe('complete');
  });
});
