import { tmpdir } from 'node:os';
import path from 'node:path';
import seedData from '../data/seed/cmu.json' with { type: 'json' };
import { SEED_CRITERIA, validateSnapshot } from '../src/domain/schema.js';
import { createApp, type Workflows } from './api.js';
import { AppError } from './errors.js';
import { readAuthConfig } from './auth.js';
import { DEMO_NICHE_LIMITS } from './niche-limits.js';
import { findDestinations } from '../jobs/geo/geocode.js';
import type { SnapshotStore } from './snapshots.js';

// The audited public seed travels with every deployment. No writes to Vercel's source tree,
// no laptop CLI credentials, and no background jobs depending on one function instance.
export function createHostedApp(env: NodeJS.ProcessEnv = process.env) {
  const snapshot = validateSnapshot(seedData);
  const unavailable = async (): Promise<never> => { throw new AppError('CAPABILITY_UNAVAILABLE', 'Live source collection runs in the local research workspace. The saved demo remains available.', 503); };
  const store: SnapshotStore = {
    loadCurrent: async () => structuredClone(snapshot),
    load: async id => {
      if (id !== snapshot.id) throw new AppError('SNAPSHOT_NOT_FOUND', 'That research snapshot is unavailable.', 404);
      return structuredClone(snapshot);
    },
    publish: unavailable,
  };
  const workflows: Workflows = {
    discovery: unavailable, routes: unavailable, import: unavailable,
    destinations: (query, market, signal) => findDestinations(query, market, signal, { cacheDirectory: path.join(tmpdir(), 'onestop-geocode') }),
  };
  const allowedOrigins = new Set(['https://onestop-hackcmu.vercel.app']);
  for (const hostname of [env.VERCEL_URL, env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL]) {
    if (hostname && /^[a-z0-9][a-z0-9.-]*$/i.test(hostname)) allowedOrigins.add(`https://${hostname}`);
  }
  const authConfig = readAuthConfig(env);
  if (authConfig?.baseURL) allowedOrigins.add(new URL(authConfig.baseURL).origin);
  return createApp({
    store, workflows, seed: SEED_CRITERIA, discoveryEnabled: false, routingEnabled: false,
    authConfig, allowedOrigins: [...allowedOrigins], allowLoopbackOrigins: false,
    trustVercelClientIp: env.VERCEL === '1', nicheLimits: DEMO_NICHE_LIMITS,
    niche: { apiKey: env.XAI_API_KEY ?? '', model: env.XAI_MODEL, apiUrl: 'https://api.x.ai/v1/chat/completions', cacheDirectory: path.join(tmpdir(), 'onestop-niche'), timeoutMs: 45_000 },
  });
}
