import { createHostedApp } from '../server/hosted.js';
import type { IncomingMessage, ServerResponse } from 'node:http';

const { app } = createHostedApp();
export default function handler(request: IncomingMessage, response: ServerResponse) {
  // /api/* reaches this catch-all without rewriting. Auth0's public /auth/* routes
  // are forwarded to /api/auth/*; retain the SDK's configured callback paths.
  if (request.url?.startsWith('/api/auth/')) request.url = request.url.replace(/^\/api\/auth\//, '/auth/');
  return app(request, response);
}
