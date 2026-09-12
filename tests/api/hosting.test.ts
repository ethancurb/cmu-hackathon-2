import { afterEach, expect, it } from 'vitest';
import type { Server } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createApp, type ApiOptions, type Workflows } from '../../server/api.js';
import { home2400, syntheticSnapshot } from '../fixtures/homes.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
async function setup(extra: Partial<ApiOptions> = {}) {
  const snapshot = syntheticSnapshot([home2400()]);
  const store = { loadCurrent: async () => snapshot, load: async () => snapshot, publish: async () => {} };
  const workflows: Workflows = { discovery: async () => ({ snapshot }), routes: async () => ({ snapshot }), import: async () => ({ snapshot }), destinations: async () => [] };
  const { app } = createApp({ store, workflows, allowedOrigins: ['https://onestop-hackcmu.vercel.app'], allowLoopbackOrigins: false, ...extra });
  let server: Server;
  await new Promise<void>((resolve, reject) => { server = app.listen(0, '127.0.0.1', () => resolve()); server.on('error', reject); });
  cleanups.push(() => new Promise<void>(resolve => { server.closeAllConnections(); server.close(() => resolve()); }));
  const base = `http://127.0.0.1:${(server!.address() as { port: number }).port}`;
  return { snapshot, base, post: (route: string, body: unknown, origin = 'https://onestop-hackcmu.vercel.app') => fetch(`${base}${route}`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin }, body: JSON.stringify(body) }) };
}

it('accepts the configured public origin and rejects a lookalike or localhost in hosted mode', async () => {
  const { post } = await setup();
  const body = { label: 'Work', coordinate: { lat: 40.4, lon: -79.9 } };
  expect((await post('/api/destination', body)).status).toBe(200);
  expect((await post('/api/destination', body, 'https://onestop-hackcmu.vercel.app.attacker.test')).status).toBe(403);
  expect((await post('/api/destination', body, 'http://localhost:5173')).status).toBe(403);
});

it('bounds public Grok requests before another upstream call and never returns the key', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'onestop-limit-'));
  cleanups.push(() => rm(directory, { recursive: true, force: true }));
  let calls = 0;
  const { snapshot, post } = await setup({ nicheLimits: { perClient: 1, perInstance: 5, concurrent: 2, windowMs: 60_000 }, niche: {
    apiKey: 'server-only-test-secret', cacheDirectory: directory, fetch: async (_url, init) => {
      calls++;
      expect((init?.headers as Record<string, string>).Authorization).toBe('Bearer server-only-test-secret');
      return new Response(JSON.stringify({ choices: [{ message: { content: '{"assessments":[]}' } }] }));
    },
  } });
  const response = await post('/api/niche', { snapshotId: snapshot.id, query: 'hot tub' });
  expect(response.status).toBe(200);
  expect(await response.text()).not.toContain('server-only-test-secret');
  const denied = await post('/api/niche', { snapshotId: snapshot.id, query: 'parking' });
  expect(denied.status).toBe(429);
  expect(denied.headers.get('retry-after')).toBeTruthy();
  expect(calls).toBe(1);
});
