import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { SEED_CRITERIA } from '../src/domain/schema.js';
import { createSnapshotStore } from '../server/snapshots.js';
import { savedSeed } from '../server/research.js';
import { createWorkflows } from '../server/workflows.js';

export type IngestOptions = { market: string; limit: number; refresh: boolean };
export function parseIngestArgs(argv: string[]): IngestOptions {
  const options: IngestOptions = { market: 'pittsburgh', limit: 60, refresh: false };
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--market') options.market = argv[++index] ?? '';
    else if (argv[index] === '--limit') { const value = Number(argv[++index]); if (!Number.isInteger(value) || value < 1 || value > 100) throw new Error('--limit must be an integer between 1 and 100.'); options.limit = value; }
    else if (argv[index] === '--refresh') options.refresh = true;
    else throw new Error(`Unknown ingest option: ${argv[index]}`);
  }
  return options;
}

export async function runIngest(options = parseIngestArgs(process.argv.slice(2))) {
  if (options.market.toLowerCase() !== 'pittsburgh') throw new Error('The direct-source ingest CLI currently supports Pittsburgh. Use the app’s new-market discovery for broader web leads.');
  const store = createSnapshotStore(path.resolve('data'));
  try { await store.loadCurrent(); } catch (error) { if ((error as { code?: string }).code !== 'NO_SNAPSHOT') throw error; await store.publish(await savedSeed()); }
  const signal = AbortSignal.timeout(6 * 60_000);
  const output = await createWorkflows(store, { useResearchWorker: false, limit: options.limit }).discovery(SEED_CRITERIA, signal, message => process.stderr.write(`[ingest] ${message}\n`));
  await store.publish(output.snapshot);
  const snapshot = await store.load(output.snapshot.id);
  return { snapshotId: snapshot.id, market: options.market, refresh: options.refresh, fetchedPages: snapshot.sourceRuns.reduce((sum, run) => sum + run.pagesFetched, 0), importedIds: snapshot.homes.map(home => home.id), quarantinedFields: snapshot.homes.reduce((sum, home) => sum + [home.rent.amount, home.bedrooms, home.bathrooms, home.coordinate].filter(fact => fact.value === null || fact.state === 'conflicting').length, 0), partial: output.partial ?? false, message: output.message, failures: snapshot.sourceRuns.filter(run => run.error).map(run => ({ sourceId: run.sourceId, error: run.error })) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) runIngest().then(summary => process.stdout.write(JSON.stringify(summary) + '\n')).catch(error => { process.stderr.write((error instanceof Error ? error.message : String(error)) + '\n'); process.exitCode = 1; });
