import { afterAll, beforeAll, expect, it } from 'vitest';
import { createServer, type Server } from 'node:http';
import handler from '../../api/index.js';

let server: Server;
let base: string;
beforeAll(async () => {
  server = createServer(handler);
  await new Promise<void>((resolve, reject) => { server.listen(0, '127.0.0.1', resolve); server.on('error', reject); });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterAll(async () => { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); });

it('preserves the full snapshot path through a serverless rewrite', async () => {
  const bootstrap = await (await fetch(`${base}/api?__onestop_route=api/bootstrap`)).json();
  expect(bootstrap.snapshot.homes).toHaveLength(49);
  const response = await fetch(`${base}/api?__onestop_route=api/snapshots/${bootstrap.snapshot.id}`);
  expect(response.status).toBe(200);
  expect((await response.json()).snapshot.id).toBe(bootstrap.snapshot.id);
});

it('routes a paused Auth0 endpoint to its explicit disabled response', async () => {
  const response = await fetch(`${base}/api?__onestop_route=auth/login`);
  expect(response.status).toBe(503);
  expect((await response.json()).error.code).toBe('AUTH_UNAVAILABLE');
});
