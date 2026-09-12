import type { Express, ErrorRequestHandler, Request } from 'express';
import { auth, type ConfigParams } from 'express-openid-connect';

const required = ['AUTH0_ISSUER_BASE_URL', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET', 'AUTH0_SECRET', 'AUTH0_BASE_URL'] as const;
type AuthUser = { sub: string; name?: string; email?: string; emailVerified: boolean };

function origin(value: string, name: string, allowLocalHttp: boolean): URL {
  try {
    const url = new URL(value);
    const local = ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname);
    if (url.username || url.password || url.search || url.hash || url.pathname !== '/' ||
      (url.protocol !== 'https:' && !(allowLocalHttp && local && url.protocol === 'http:'))) throw new Error();
    return url;
  } catch { throw new Error(`${name} must be a valid HTTPS origin${allowLocalHttp ? ' (HTTP is allowed for localhost)' : ''}.`); }
}

export function readAuthConfig(env: NodeJS.ProcessEnv): ConfigParams | null {
  const enabled = env.AUTH0_ENABLED ?? (required.some(name => Boolean(env[name])) ? 'true' : 'false');
  if (!['true', 'false'].includes(enabled)) throw new Error('AUTH0_ENABLED must be true or false.');
  if (enabled === 'false') return null;
  const missing = required.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error(`Auth0 setup is incomplete. Set ${missing.join(', ')}.`);
  if (env.AUTH0_SECRET!.length < 32) throw new Error('AUTH0_SECRET must contain at least 32 random characters.');
  const issuer = origin(env.AUTH0_ISSUER_BASE_URL!, 'AUTH0_ISSUER_BASE_URL', false);
  const base = origin(env.AUTH0_BASE_URL!, 'AUTH0_BASE_URL', true);
  return {
    authRequired: false,
    issuerBaseURL: issuer.origin,
    baseURL: base.origin,
    clientID: env.AUTH0_CLIENT_ID!,
    clientSecret: env.AUTH0_CLIENT_SECRET!,
    secret: env.AUTH0_SECRET!,
    authorizationParams: { response_type: 'code', response_mode: 'query', scope: 'openid profile email' },
    routes: { login: false, logout: '/auth/logout', callback: '/auth/callback', postLogoutRedirect: '/' },
    auth0Logout: true,
    session: {
      name: 'onestop_session', rolling: true, rollingDuration: 86400, absoluteDuration: 604800,
      cookie: { httpOnly: true, sameSite: 'Lax', secure: base.protocol === 'https:', path: '/', transient: false },
    },
    httpTimeout: 8000,
  };
}

function userFrom(request: Request): AuthUser | null {
  if (!request.oidc?.isAuthenticated()) return null;
  const user = request.oidc.user;
  if (!user || typeof user.sub !== 'string' || !user.sub) return null;
  return {
    sub: user.sub,
    ...(typeof user.name === 'string' ? { name: user.name } : {}),
    ...(typeof user.email === 'string' ? { email: user.email } : {}),
    emailVerified: user.email_verified === true,
  };
}

export function mountAuth(app: Express, config: ConfigParams | null): void {
  // All auth responses are private, including the SDK's callback and redirects.
  app.use((request, response, next) => {
    if (request.path.startsWith('/auth/') || ['/api/session', '/api/account'].includes(request.path)) {
      response.setHeader('Cache-Control', 'no-store');
      response.setHeader('X-Content-Type-Options', 'nosniff');
      response.setHeader('Referrer-Policy', 'no-referrer');
    }
    next();
  });
  if (config) {
    app.use(auth(config));
    app.get('/auth/login', (_request, response) => response.oidc.login({ returnTo: '/' }));
    app.get('/auth/signup', (_request, response) => response.oidc.login({ returnTo: '/', authorizationParams: { screen_hint: 'signup' } }));
  } else {
    app.use('/auth', (_request, response) => response.status(503).json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Account sign-in is not configured. The housing demo remains available.' } }));
  }
  const authErrors: ErrorRequestHandler = (_error, request, response, next) => {
    if (request.path.startsWith('/auth/')) return response.redirect(303, '/?auth=error');
    if (['/api/session', '/api/account'].includes(request.path)) {
      return response.status(503).json({ error: { code: 'AUTH_UNAVAILABLE', message: 'Could not check your account. Please try again.' } });
    }
    next(_error);
  };
  app.use(authErrors);
  app.get('/api/session', (request, response) => {
    if (!config) return response.json({ status: 'disabled' });
    const user = userFrom(request);
    response.json(user ? { status: 'authenticated', user } : { status: 'anonymous' });
  });
  app.get('/api/account', (request, response) => {
    const user = config ? userFrom(request) : null;
    if (!user) return response.status(401).json({ error: { code: 'AUTH_REQUIRED', message: 'Sign in to view your account.' } });
    response.json({ user });
  });
  app.use('/auth', (_request, response) => response.status(404).json({ error: { code: 'NOT_FOUND', message: 'That account route does not exist.' } }));
}
