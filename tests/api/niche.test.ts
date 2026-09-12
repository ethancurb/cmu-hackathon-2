import { afterEach, describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import type { Server } from 'node:http';
import { home2400, syntheticSnapshot } from '../fixtures/homes.js';
import { createSnapshotStore } from '../../server/snapshots.js';
import { createApp, type Workflows } from '../../server/api.js';
import type { NicheOptions } from '../../server/niche.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });

const grokReply = (assessments: unknown[]) => new Response(JSON.stringify({
  choices: [{ message: { content: JSON.stringify({ assessments }) } }],
}), { status: 200, headers: { 'Content-Type': 'application/json' } });

const matchFor = (homeId: string, changes: Record<string, unknown> = {}) => ({
  homeId, matches: true, confidence: 'strong', reason: 'Fudi Asian Mart is 229 m away.',
  provenance: 'listing_data', citedPlaceIds: [], mitigates: null, ...changes,
});

async function setup(niche: Partial<NicheOptions> = {}) {
  const directory = await mkdtemp(path.join(tmpdir(), 'address-niche-test-'));
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  const store = createSnapshotStore(path.join(directory, 'snapshots'));
  const initial = { ...syntheticSnapshot([home2400()]), id: 'initial' };
  await store.publish(initial);
  const workflows: Workflows = {
    discovery: async () => ({ snapshot: initial }), routes: async () => ({ snapshot: initial }),
    destinations: async () => [], import: async () => ({ snapshot: initial }),
  };
  const { app } = createApp({ store, workflows, niche: { apiKey: 'test-key', cacheDirectory: path.join(directory, 'cache'), timeoutMs: 2000, ...niche } });
  let server: Server;
  await new Promise<void>((resolve, reject) => { server = app.listen(0, '127.0.0.1', () => resolve()); server.on('error', reject); });
  cleanups.push(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server!.address() as { port: number }).port}`;
  const ask = (body: unknown, init: RequestInit = {}) => fetch(`${base}/api/niche`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), ...init });
  return { ask };
}

describe('POST /api/niche', () => {
  it('returns matching verdicts and drops homes the snapshot does not contain', async () => {
    let calls = 0;
    const { ask } = await setup({ fetch: async () => { calls += 1; return grokReply([
      matchFor('test:home:2400'),
      matchFor('test:ghost'),
      matchFor('test:home:2400', { matches: false, reason: 'Duplicate non-match must not appear.' }),
    ]); } });
    const response = await ask({ snapshotId: 'initial', query: 'close to a Chinese supermarket' });
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(calls).toBe(1);
    expect(result.degraded).toBeNull();
    expect(result.assessments).toHaveLength(1);
    expect(result.assessments[0].homeId).toBe('test:home:2400');
  });

  it('serves the second identical query from the disk cache without a model call', async () => {
    let calls = 0;
    const { ask } = await setup({ fetch: async () => { calls += 1; return grokReply([matchFor('test:home:2400')]); } });
    await ask({ snapshotId: 'initial', query: 'Close to a Chinese Supermarket' });
    const second = await (await ask({ snapshotId: 'initial', query: 'close to a chinese supermarket' })).json();
    expect(calls).toBe(1);
    expect(second.assessments).toHaveLength(1);
  });

  it('degrades to an explained empty result without an API key', async () => {
    const { ask } = await setup({ apiKey: undefined });
    const result = await (await ask({ snapshotId: 'initial', query: 'far from a railroad' })).json();
    expect(result.assessments).toEqual([]);
    expect(result.degraded).toMatch(/not configured/i);
  });

  it('degrades when the model answers in an unusable shape, and does not cache it', async () => {
    let calls = 0;
    const replies = [
      new Response(JSON.stringify({ choices: [{ message: { content: '{"assessments": "nope"}' } }] }), { status: 200 }),
      grokReply([matchFor('test:home:2400')]),
    ];
    const { ask } = await setup({ fetch: async () => { calls += 1; return replies.shift()!; } });
    const first = await (await ask({ snapshotId: 'initial', query: 'quiet street' })).json();
    expect(first.degraded).toMatch(/unexpected shape/i);
    const second = await (await ask({ snapshotId: 'initial', query: 'quiet street' })).json();
    expect(calls).toBe(2); // the degraded answer was not cached
    expect(second.degraded).toBeNull();
  });

  it('degrades on timeout instead of hanging or failing the request', async () => {
    const { ask } = await setup({ timeoutMs: 50, fetch: (_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(Object.assign(new Error('timed out'), { name: 'TimeoutError' })));
    }) });
    const result = await (await ask({ snapshotId: 'initial', query: 'near a dog park' })).json();
    expect(result.degraded).toMatch(/too long/i);
  });

  it('aborts the upstream model call when the client cancels', async () => {
    let upstreamAborted = false;
    let signalStarted!: () => void;
    const upstreamStarted = { promise: new Promise<void>((resolve) => { signalStarted = resolve; }) };
    const { ask } = await setup({ timeoutMs: 10_000, fetch: (_input, init) => {
      signalStarted();
      return new Promise((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => { upstreamAborted = true; reject(new Error('aborted')); });
      });
    } });
    const controller = new AbortController();
    const pending = ask({ snapshotId: 'initial', query: 'anything slow' }, { signal: controller.signal }).catch(() => 'client-aborted');
    await upstreamStarted.promise;
    controller.abort();
    expect(await pending).toBe('client-aborted');
    await expect.poll(() => upstreamAborted).toBe(true);
  });

  it('rejects a stale snapshot with 409', async () => {
    const { ask } = await setup();
    const response = await ask({ snapshotId: 'obsolete', query: 'close to anything' });
    expect(response.status).toBe(409);
  });
});
