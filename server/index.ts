import path from 'node:path';
import { existsSync } from 'node:fs';
import { loadEnvFile } from 'node:process';
import { createSnapshotStore } from './snapshots.js';
import { createApp } from './api.js';
import { createWorkflows } from './workflows.js';
import { savedSeed } from './research.js';
import { readAuthConfig } from './auth.js';

if (existsSync('.env.local')) loadEnvFile('.env.local');
const authConfig = readAuthConfig(process.env);
const store = createSnapshotStore(path.join(process.cwd(), 'data'));
try { await store.loadCurrent(); }
catch (error) {
  if (!['NO_SNAPSHOT', 'SNAPSHOT_NOT_FOUND'].includes((error as { code?: string }).code ?? '')) throw error;
  await store.publish(await savedSeed());
}
const isProduction = import.meta.url.includes('/dist-server/');
const port = Number(process.env.ADDRESS_PORT ?? (isProduction ? 4173 : 4318));
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('ADDRESS_PORT must be a port between 1024 and 65535.');
const staticDirectory = path.join(process.cwd(), 'dist');
const { app } = createApp({ store, workflows: createWorkflows(store, { useResearchWorker: process.env.ADDRESS_RESEARCH_WORKER !== 'off' }), staticDirectory: existsSync(staticDirectory) ? staticDirectory : undefined, authConfig });
const server = app.listen(port, '127.0.0.1', () => process.stdout.write(`OneStop is ready at http://127.0.0.1:${port} (accounts ${authConfig ? 'enabled' : 'disabled'})\n`));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 2000).unref(); });
