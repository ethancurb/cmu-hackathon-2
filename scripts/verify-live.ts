import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Job } from '../src/domain/jobs.js';
import type { Destination, SearchResult, Snapshot } from '../src/domain/schema.js';
import { SEED_CRITERIA } from '../src/domain/schema.js';
import { createSnapshotStore } from '../server/snapshots.js';
import { savedSeed } from '../server/research.js';

// Explicit live acceptance command: requests public geocoding, walking and one
// housing page. Restores the portable CMU seed after checking published results.
const base = process.env.ADDRESS_API_URL ?? 'http://127.0.0.1:4318';
const store = createSnapshotStore(path.resolve('data'));
async function request<T>(pathname: string, body?: unknown): Promise<T> {
  const response = await fetch(base + pathname, body === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  if (!response.ok) throw new Error(`${pathname}: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}
async function completed(start: { job: Job }): Promise<Job> {
  let job = start.job;
  const deadline = Date.now() + 370_000;
  let message = '';
  while (['queued', 'running'].includes(job.status) && Date.now() < deadline) {
    if (job.progress.message !== message) { message = job.progress.message; process.stdout.write(message + '\n'); }
    await new Promise(resolve => setTimeout(resolve, 1500));
    ({ job } = await request<{ job: Job }>('/api/jobs/' + job.id));
  }
  if (!['succeeded', 'partial'].includes(job.status) || !job.snapshotId) throw new Error(JSON.stringify(job));
  return job;
}
try {
  const initial = await request<{ snapshot: Snapshot }>('/api/bootstrap');
  const found = await request<{ candidates: Destination[] }>('/api/destination', { query: 'Hunt Library', market: SEED_CRITERIA.market });
  const destination = found.candidates.find(candidate => /Hunt Library/i.test(candidate.label));
  if (!destination) throw new Error('Live library geocode unavailable; the UI offers a manual map pin.');
  const criteria = { ...SEED_CRITERIA, destination };
  const before = await request<SearchResult>('/api/search', { snapshotId: initial.snapshot.id, requestId: 'route-before', criteria });
  const beforeWalking = before.results.find(result => result.homeId === 'cmu-floorplan-30562681')?.constraints.find(item => item.key === 'walk');
  if (beforeWalking?.outcome !== 'unknown') throw new Error('An old Gates route qualified for a different destination.');
  const routeJob = await completed(await request('/api/routes', { snapshotId: initial.snapshot.id, destination, homeIds: ['cmu-floorplan-30562681', 'cmu-floorplan-51260', 'cmu-floorplan-28130489'] }));
  const { snapshot } = await request<{ snapshot: Snapshot }>('/api/snapshots/' + routeJob.snapshotId);
  const after = await request<SearchResult>('/api/search', { snapshotId: snapshot.id, requestId: 'route-after', criteria });
  const home = after.results.find(result => result.homeId === 'cmu-floorplan-30562681');
  const route = snapshot.routes.find(item => item.id === home?.routeId);
  if (!route || route.destinationVersion !== destination.version || route.status !== 'ok') throw new Error('New destination has no usable computed foot route.');
  const isolated = await request<SearchResult>('/api/search', { snapshotId: snapshot.id, requestId: 'new-market', criteria: { ...criteria, market: { label: 'New York', region: 'NY', country: 'US' } } });
  if (isolated.results.length || !isolated.discoveryNeeded) throw new Error('Pittsburgh research leaked into a different city.');
  const importJob = await completed(await request('/api/import', { sourceId: 'lobos-management', url: 'https://lobosmanagement.com/units/bentley-apartments-021-a-03/', snapshotId: snapshot.id, criteria }));
  const imported = await request<{ snapshot: Snapshot }>('/api/snapshots/' + importJob.snapshotId);
  const unit = imported.snapshot.homes.filter(item => item.id === 'lobos-detail-bentley-apartments-021-a-03');
  if (unit.length !== 1 || unit[0]!.rent.amount.state !== 'sourced' || unit[0]!.bathrooms.value !== 1) throw new Error('URL-only import lost the actual unit evidence or duplicated the unit.');
  const report = {
    checkedAt: new Date().toISOString(), destination, routeJob, beforeWalking,
    afterWalking: home?.constraints.find(item => item.key === 'walk'),
    route: { id: route.id, requestedDestination: route.requestedDestination, snappedDestination: route.snappedDestination, durationSeconds: route.durationSeconds, computedAt: route.computedAt },
    newMarket: { count: isolated.results.length, discoveryNeeded: isolated.discoveryNeeded },
    import: { job: importJob, uniqueUnitCount: unit.length, rentCents: unit[0]!.rent.amount.value, bathrooms: unit[0]!.bathrooms.value, sourceUrl: unit[0]!.primaryUrl },
  };
  await mkdir('docs/artifacts', { recursive: true });
  await writeFile('docs/artifacts/destination-import-acceptance.json', JSON.stringify(report, null, 2) + '\n');
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
} finally {
  await store.publish(await savedSeed());
  process.stdout.write('Restored the audited CMU seed; verification snapshots remain saved.\n');
}
