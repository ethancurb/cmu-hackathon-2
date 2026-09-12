import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { Server } from 'node:http';
import { SEED_CRITERIA } from '../../src/config/seed.js';
import { home2400, syntheticSnapshot } from '../fixtures/homes.js';
import { createSnapshotStore } from '../../server/snapshots.js';
import { createApp } from '../../server/api.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

async function setup() {
  const directory = await mkdtemp(path.join(tmpdir(), 'address-api-test-'));
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const store = createSnapshotStore(directory);
  const home = home2400();
  home.address = { ...home.address, evidenceIds: ['test:evidence:building'] };
  const initial = { ...syntheticSnapshot([home]), id: 'initial' };
  initial.evidence.push({ ...initial.evidence[0]!, id: 'test:evidence:building', scopeKey: home.buildingKey, scopeKind: 'building' });
  await store.publish(initial);
  const { app, jobs } = createApp({ store, workflows: {
    discovery: async () => ({ snapshot: { ...initial, id: 'refreshed' } }),
    routes: async () => ({ snapshot: { ...initial, id: 'routed' } }),
    destinations: async () => [SEED_CRITERIA.destination],
    import: async () => ({ snapshot: { ...initial, id: 'imported' } }),
  } });
  let server: Server;
  await new Promise<void>((resolve, reject) => { server = app.listen(0, '127.0.0.1', () => resolve()); server.on('error', reject); });
  cleanups.push(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const port = (server!.address() as { port: number }).port;
  const base = `http://127.0.0.1:${port}`;
  const post = (url: string, body: unknown, headers: Record<string, string> = {}) => fetch(base + url, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify(body) });
  return { base, post, jobs };
}

describe('local housing API', () => {
  it('serves seeded criteria and derives rent-only search behavior from the actual engine', async () => {
    const { base, post } = await setup();
    const bootstrap = await (await fetch(base + '/api/bootstrap')).json();
    expect(bootstrap.seed.personalRentCap).toBe(120000);
    const response = await post('/api/search', { snapshotId: 'initial', requestId: 'view-1', criteria: SEED_CRITERIA });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.requestId).toBe('view-1');
    expect(result.results[0].cost.personalBaseRent).toBe(120000);
    expect(result.results[0].constraints.find((item: { key: string }) => item.key === 'personal_rent').outcome).toBe('pass');
  });
  it('returns a job whose published snapshot can be retrieved through its exact ID', async () => {
    const { base, post, jobs } = await setup();
    const response = await post('/api/discovery', { criteria: SEED_CRITERIA });
    expect(response.status).toBe(202);
    const started = await response.json();
    await jobs.settled(started.job.id);
    const finished = await (await fetch(base + '/api/jobs/' + started.job.id)).json();
    expect(finished.job.status).toBe('succeeded');
    const result = await (await fetch(base + '/api/snapshots/' + finished.job.snapshotId)).json();
    expect(result.snapshot.id).toBe('refreshed');
  });
  it('rejects obsolete snapshot searches and malformed criteria', async () => {
    const { post } = await setup();
    const stale = await post('/api/search', { snapshotId: 'old', requestId: 'view-2', criteria: SEED_CRITERIA });
    expect(stale.status).toBe(409);
    const invalid = await post('/api/search', { snapshotId: 'initial', requestId: 'view-3', criteria: { ...SEED_CRITERIA, personalRentCap: -1 } });
    expect(invalid.status).toBe(400);
  });
  it('rejects cross-site attempts to start subscription-backed research', async () => {
    const { post } = await setup();
    const response = await post('/api/discovery', { criteria: SEED_CRITERIA }, { Origin: 'https://outside.example', 'Sec-Fetch-Site': 'cross-site' });
    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe('ORIGIN_DENIED');
  });
});
