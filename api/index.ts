import { createHostedApp } from '../server/hosted.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const { app } = createHostedApp();
export default function handler(request: IncomingMessage & { query?: Record<string, unknown> }, response: ServerResponse) {
  // Plain Vercel Node functions do not give Next-style [...path] files a recursive
  // route. Carry the complete path explicitly so snapshots and Auth0 callbacks work.
  const url = new URL(request.url ?? '/', 'http://onestop.internal');
  const route = url.searchParams.get('__onestop_route') ?? request.query?.__onestop_route;
  if (route !== undefined && route !== null) {
    if (typeof route !== 'string' || !/^(api|auth)\/[a-zA-Z0-9_/-]+$/.test(route)) {
      response.writeHead(404, { 'Content-Type': 'application/json' });
      response.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: 'That endpoint does not exist.' } }));
      return;
    }
    url.searchParams.delete('__onestop_route');
    request.url = `/${route}${url.search}`;
  }
  return app(request, response);
}
