import { createHash } from 'node:crypto';
import { collectSources } from './sources/collect.js';
import { SEED_CRITERIA } from '../src/domain/schema.js';

export type IngestOptions = { market: string; limit: number; refresh: boolean };

export function parseIngestArgs(argv: string[]): IngestOptions {
  let market = 'pittsburgh'; let limit = 24; let refresh = false;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--market') market = argv[++i] ?? market;
    else if (arg === '--limit') { const value = Number(argv[++i]); if (Number.isInteger(value) && value > 0 && value <= 100) limit = value; }
    else if (arg === '--refresh') refresh = true;
  }
  return { market, limit, refresh };
}

export async function runIngest(options: IngestOptions = parseIngestArgs(process.argv.slice(2))): Promise<Record<string, unknown>> {
  if (options.market.toLowerCase() !== 'pittsburgh') throw new Error(`Unsupported market: ${options.market}`);
  const result = await collectSources(SEED_CRITERIA, (message) => process.stderr.write(`[ingest] ${message}\n`), new AbortController().signal);
  const imported = result.homes.slice(0, options.limit).map((home) => home.id);
  const quarantinedFields = result.observations.reduce((count, observation) => count + [observation.bedrooms, observation.bathrooms, observation.rent.amount, observation.rent.upperAmount, observation.availability].filter((fact) => fact.state === 'unknown').length, 0);
  const createdAt = result.researchScopes[0]?.checkedAt ?? new Date().toISOString();
  const snapshotId = `ingest-${createHash('sha1').update(`${createdAt}:${imported.join(',')}`).digest('hex').slice(0, 12)}`;
  return { snapshotId, market: options.market, refresh: options.refresh, fetchedPages: result.sourceRuns.reduce((sum, run) => sum + run.pagesFetched, 0), importedIds: imported, quarantinedFields, failures: result.warnings, sourceRuns: result.sourceRuns.map((run) => ({ sourceId: run.sourceId, status: run.status, observations: run.observations, error: run.error })) };
}

if (import.meta.url === `file://${process.argv[1]}`) runIngest().then((summary) => process.stdout.write(`${JSON.stringify(summary)}\n`)).catch((error) => { process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`); process.exitCode = 1; });
