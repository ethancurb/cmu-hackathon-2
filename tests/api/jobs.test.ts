import { describe, expect, it } from 'vitest';
import { createJobManager } from '../../server/jobs.js';
import type { Snapshot } from '../../src/domain/schema.js';

const data = (id: string): Snapshot => ({ schemaVersion: 1, id, createdAt: new Date().toISOString(), discoveryMarket: { label: 'Test', region: 'PA', country: 'US' }, searchDescription: 'Synthetic job test', researchScopes: [], homes: [], evidence: [], routes: [], sources: [], sourceRuns: [] });

describe('research job lifecycle', () => {
  it('makes the result snapshot readable before reporting success', async () => {
    const published: string[] = [];
    const manager = createJobManager(async snapshot => { published.push(snapshot.id); });
    const job = manager.start('discovery', 'same-query', async () => ({ snapshot: data('fresh') }));
    await manager.settled(job.id);
    expect(published).toEqual(['fresh']);
    expect(manager.get(job.id)).toMatchObject({ status: 'succeeded', snapshotId: 'fresh' });
  });
  it('coalesces repeated clicks into one job and serializes different jobs', async () => {
    const order: string[] = [];
    const manager = createJobManager(async () => undefined);
    const worker = async () => { order.push('first'); await new Promise(resolve => setTimeout(resolve, 20)); return { snapshot: data('one') }; };
    const first = manager.start('discovery', 'query', worker);
    const repeat = manager.start('discovery', 'query', worker);
    const second = manager.start('routes', 'new-destination', async () => { order.push('second'); return { snapshot: data('two') }; });
    expect(repeat.id).toBe(first.id);
    await manager.settled(second.id);
    expect(order).toEqual(['first', 'second']);
  });
  it('terminates a timed-out job without publishing a late result', async () => {
    let publicationCount = 0;
    const manager = createJobManager(async () => { publicationCount += 1; }, { timeoutMs: 20 });
    const job = manager.start('discovery', 'slow', async () => { await new Promise(resolve => setTimeout(resolve, 80)); return { snapshot: data('late') }; });
    await manager.settled(job.id);
    await new Promise(resolve => setTimeout(resolve, 90));
    expect(manager.get(job.id)).toMatchObject({ status: 'failed', snapshotId: null, error: { code: 'JOB_TIMEOUT' } });
    expect(publicationCount).toBe(0);
  });
  it('records partial source failure without disguising it as complete coverage', async () => {
    const manager = createJobManager(async () => undefined);
    const job = manager.start('discovery', 'partial', async () => ({ snapshot: data('partial-result'), partial: true, message: 'Two sources retrieved; one unavailable.' }));
    await manager.settled(job.id);
    expect(manager.get(job.id)).toMatchObject({ status: 'partial', snapshotId: 'partial-result', progress: { message: 'Two sources retrieved; one unavailable.' } });
  });
});
