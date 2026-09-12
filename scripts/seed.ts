import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import path from 'node:path';
import { SEED_CRITERIA, validateSnapshot } from '../src/domain/schema.js';
import { snapshotFromCollection, placeHomes } from '../server/research.js';
import { enrichSnapshot } from '../jobs/geo/enrich.js';
import { createSnapshotStore } from '../server/snapshots.js';
import { evaluateSearch } from '../src/domain/engine.js';
import type { CollectedSources } from '../jobs/sources/collect.js';

const progress = (message: string) => process.stdout.write(`${new Date().toISOString()} ${message}\n`);
const collected = JSON.parse(await readFile('data/seed/observations.json', 'utf8')) as CollectedSources & { collectedAt: string };
let snapshot = snapshotFromCollection(collected, SEED_CRITERIA, collected.collectedAt);
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 300_000);
try {
  await mkdir('data/cache/geo/prt', { recursive: true });
  try { await copyFile('/private/tmp/cmu-geo-probe-prt-gtfs.zip', 'data/cache/geo/prt/GTFS.zip'); } catch { /* normal installations fetch the official feed */ }
  snapshot = await placeHomes(snapshot, SEED_CRITERIA, controller.signal, progress);
  await writeFile('data/seed/placed.json', JSON.stringify(snapshot, null, 2) + '\n');
  snapshot = await enrichSnapshot(snapshot, SEED_CRITERIA, controller.signal, progress);
  snapshot = validateSnapshot(snapshot);
  await writeFile('data/seed/cmu.json', JSON.stringify(snapshot, null, 2) + '\n');
  await createSnapshotStore(path.resolve('data')).publish(snapshot);
  const result = evaluateSearch(snapshot, SEED_CRITERIA, 'seed-audit');
  progress(JSON.stringify({ snapshotId: snapshot.id, homes: snapshot.homes.length, placed: snapshot.homes.filter(h => h.coordinate.value).length, routes: snapshot.routes.filter(r => r.status === 'ok').length, transit: snapshot.homes.filter(h => h.transit.length).length, nearby: snapshot.homes.filter(h => h.nearby.length).length, counts: result.counts }));
} finally { clearTimeout(timeout); }
