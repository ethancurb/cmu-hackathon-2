import express, { type ErrorRequestHandler } from 'express';
import { randomUUID, createHash } from 'node:crypto';
import { z } from 'zod';
import { CriteriaSchema, DestinationSchema, SEED_CRITERIA, type Criteria, type Destination, type Snapshot } from '../src/domain/schema.js';
import { evaluateSearch } from '../src/domain/engine.js';
import { createJobManager, type JobOutput } from './jobs.js';
import type { SnapshotStore } from './snapshots.js';
import { AppError } from './errors.js';
import { SOURCE_REGISTRY } from '../jobs/sources/registry.js';
import type { ConfigParams } from 'express-openid-connect';
import { mountAuth } from './auth.js';

export type Workflows = {
  discovery: (criteria: Criteria, signal: AbortSignal, progress: (message: string) => void) => Promise<JobOutput>;
  routes: (destination: Destination, homeIds: string[], signal: AbortSignal, progress: (message: string) => void, expectedSnapshotId: string) => Promise<JobOutput>;
  destinations: (query: string, market: Criteria['market'], signal: AbortSignal) => Promise<Destination[]>;
  import: (sourceId: string, url: string, text: string, signal: AbortSignal, progress: (message: string) => void, context?: { snapshotId: string; criteria: Criteria }) => Promise<JobOutput>;
};
export type ApiOptions = { store: SnapshotStore; workflows: Workflows; seed?: Criteria; staticDirectory?: string; discoveryEnabled?: boolean; routingEnabled?: boolean; authConfig?: ConfigParams | null };

const key = (input: unknown) => createHash('sha256').update(JSON.stringify(input)).digest('hex');
const unavailable = (capability: string) => new AppError('CAPABILITY_UNAVAILABLE', `${capability} is unavailable in this viewing session. Saved research remains usable.`, 503);
const sourceHost = (url: string) => new URL(url).hostname.toLowerCase().replace(/^www\./, '').replace(/\.$/, '');

export function createApp(options: ApiOptions) {
  const app = express();
  const jobs = createJobManager(options.store.publish);
  const seed = options.seed ?? SEED_CRITERIA;
  app.disable('x-powered-by');
  mountAuth(app, options.authConfig ?? null);
  app.use((request, response, next) => {
    response.locals.requestId = randomUUID();
    response.setHeader('X-Content-Type-Options', 'nosniff');
    if (request.path.startsWith('/api/')) response.setHeader('Cache-Control', 'no-store');
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      const origin = request.headers.origin;
      if (origin) {
        try {
          const parsed = new URL(origin);
          if (!['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname)) throw new Error();
        } catch { return next(new AppError('ORIGIN_DENIED', 'This local research endpoint does not accept cross-site requests.', 403)); }
      }
      if (request.headers['sec-fetch-site'] === 'cross-site') return next(new AppError('ORIGIN_DENIED', 'Cross-site requests are not accepted.', 403));
    }
    next();
  });
  app.use(express.json({ limit: '100kb' }));
  app.get('/api/health', (_request, response) => response.json({ ok: true }));
  app.get('/api/bootstrap', async (_request, response) => {
    response.json({ snapshot: await options.store.loadCurrent(), seed, capabilities: { discovery: options.discoveryEnabled !== false, routing: options.routingEnabled !== false } });
  });
  app.get('/api/snapshots/:id', async (request, response) => response.json({ snapshot: await options.store.load(request.params.id) }));
  app.post('/api/search', async (request, response) => {
    const body = z.object({ snapshotId: z.string(), requestId: z.string().min(1).max(150), criteria: CriteriaSchema }).strict().parse(request.body);
    const current = await options.store.loadCurrent();
    if (body.snapshotId !== current.id) throw new AppError('STALE_SNAPSHOT', 'New research is available. Refresh the snapshot before searching.', 409);
    response.json(evaluateSearch(current, body.criteria, body.requestId));
  });
  app.post('/api/discovery', (request, response) => {
    if (options.discoveryEnabled === false) throw unavailable('Live discovery');
    const { criteria } = z.object({ criteria: CriteriaSchema }).strict().parse(request.body);
    const job = jobs.start('discovery', key(criteria), (signal, progress) => options.workflows.discovery(criteria, signal, progress));
    response.status(202).json({ job });
  });
  app.post('/api/routes', async (request, response) => {
    if (options.routingEnabled === false) throw unavailable('New walking routes');
    const body = z.object({ snapshotId: z.string(), destination: DestinationSchema, homeIds: z.array(z.string()).max(100) }).strict().parse(request.body);
    const current = await options.store.loadCurrent();
    if (body.snapshotId !== current.id) throw new AppError('STALE_SNAPSHOT', 'New research is available. Refresh before recomputing routes.', 409);
    if (body.homeIds.some(id => !current.homes.some(home => home.id === id))) throw new AppError('UNKNOWN_HOME', 'A requested home does not exist in this snapshot.', 400);
    const job = jobs.start('routes', key(body), (signal, progress) => options.workflows.routes(body.destination, body.homeIds, signal, progress, body.snapshotId));
    response.status(202).json({ job });
  });
  app.get('/api/jobs/:id', (request, response) => response.json({ job: jobs.get(request.params.id) }));
  app.post('/api/destination', async (request, response) => {
    const body = z.union([
      z.object({ query: z.string().trim().min(2).max(180), market: CriteriaSchema.shape.market }).strict(),
      z.object({ label: z.string().trim().min(1).max(140), coordinate: DestinationSchema.shape.coordinate }).strict(),
    ]).parse(request.body);
    if ('coordinate' in body) {
      const destinationKey = key(body).slice(0, 12);
      return response.json({ candidates: [{ id: `destination:pin:${destinationKey}`, version: `pin-${destinationKey}`, label: body.label, coordinate: body.coordinate, evidenceIds: [`destination:pin:${destinationKey}:selection`], caveat: 'Destination pin chosen in the map; entrance access is not physically verified.' }] });
    }
    const candidates = await options.workflows.destinations(body.query, body.market, AbortSignal.timeout(18000));
    response.json({ candidates });
  });
  app.post('/api/import', async (request, response) => {
    if (options.discoveryEnabled === false) throw unavailable('Source import');
    const body = z.object({ sourceId: z.string().min(1).max(100), url: z.url().max(2000).refine(value => { const url = new URL(value); return url.protocol === 'https:' && !url.username && !url.password && (!url.port || url.port === '443'); }, 'Listing URL must use standard HTTPS without credentials.'), text: z.string().max(80000).default(''), snapshotId: z.string().optional(), criteria: CriteriaSchema.optional() }).strict().superRefine((value, ctx) => {
      if (Boolean(value.snapshotId) !== Boolean(value.criteria)) ctx.addIssue({ code: 'custom', message: 'Snapshot and criteria must be supplied together.' });
    }).parse(request.body);
    const source = SOURCE_REGISTRY.find(item => item.id === body.sourceId);
    if (!source) throw new AppError('UNKNOWN_SOURCE', 'Choose a source from the research ledger.', 400);
    if (sourceHost(source.url) !== sourceHost(body.url)) throw new AppError('SOURCE_URL_MISMATCH', 'Choose a listing URL from the selected source.', 400);
    if (body.snapshotId && body.criteria) {
      const current = await options.store.loadCurrent();
      if (body.snapshotId !== current.id) throw new AppError('STALE_SNAPSHOT', 'New research is available. Refresh before importing a listing.', 409);
    }
    const context = body.snapshotId && body.criteria ? { snapshotId: body.snapshotId, criteria: body.criteria } : undefined;
    const job = jobs.start('discovery', key(body), (signal, progress) => options.workflows.import(body.sourceId, body.url, body.text, signal, progress, context));
    response.status(202).json({ job });
  });
  app.use('/api', (_request, _response, next) => next(new AppError('NOT_FOUND', 'That endpoint does not exist.', 404)));
  if (options.staticDirectory) {
    app.use(express.static(options.staticDirectory));
    app.get('/{*path}', (_request, response) => response.sendFile('index.html', { root: options.staticDirectory }));
  }
  const errors: ErrorRequestHandler = (error: unknown, _request, response, _next) => {
    const detail = error instanceof z.ZodError ? new AppError('INVALID_REQUEST', 'Some request fields are invalid. Check the selected criteria.', 400)
      : error instanceof AppError ? error
      : (error as { type?: string })?.type === 'entity.too.large' ? new AppError('REQUEST_TOO_LARGE', 'The request exceeds the supported size.', 413)
      : error instanceof SyntaxError ? new AppError('INVALID_JSON', 'The request must contain valid JSON.', 400)
      : new AppError('INTERNAL_ERROR', 'The request could not be completed. Saved research is preserved.');
    response.status(detail.status).json({ error: { code: detail.code, message: detail.message }, requestId: response.locals.requestId });
  };
  app.use(errors);
  return { app, jobs };
}
