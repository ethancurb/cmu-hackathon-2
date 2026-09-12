import { afterEach, describe, expect, it } from 'vitest';
import express from 'express';
import type { Server } from 'node:http';
import { generateKeyPairSync, randomUUID, sign } from 'node:crypto';
import type { ConfigParams } from 'express-openid-connect';
import { mountAuth, readAuthConfig } from '../../server/auth.js';

const cleanups: (() => Promise<void>)[] = [];
afterEach(async () => { for (const cleanup of cleanups.splice(0).reverse()) await cleanup(); });
const environment = () => ({
  AUTH0_ENABLED: 'true', AUTH0_ISSUER_BASE_URL: 'https://onestop-test.auth0.com',
  AUTH0_CLIENT_ID: 'onestop-client', AUTH0_CLIENT_SECRET: 'test-client-secret',
  AUTH0_SECRET: 'a'.repeat(64), AUTH0_BASE_URL: 'http://127.0.0.1:4173',
});

async function start(config: ConfigParams | null) {
  const app = express();
  let server: Server;
  await new Promise<void>((resolve, reject) => {
    server = app.listen(0, '127.0.0.1', () => resolve());
    server.on('error', reject);
  });
  cleanups.push(() => new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())));
  const base = `http://127.0.0.1:${(server!.address() as { port: number }).port}`;
  mountAuth(app, config ? { ...config, baseURL: base } : null);
  app.get('/{*path}', (_req, res) => res.send('public housing demo'));
  return { base, get: (route: string, cookie = '') => fetch(base + route, { redirect: 'manual', headers: { cookie } }) };
}

function cookieHeader(response: Response) {
  return response.headers.getSetCookie().map(value => value.split(';')[0]).join('; ');
}

// Controlled OIDC provider exercises the real SDK's code exchange, signature
// validation and encrypted cookie. This is not evidence of a live Auth0 login.
function provider() {
  const issuer = `https://${randomUUID()}.auth0.com`;
  const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'test-key', use: 'sig', alg: 'RS256' };
  let nonce = '';
  let subject = 'auth0|demo-a';
  const jwt = () => {
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: 'RS256', kid: 'test-key' })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ iss: issuer + '/', aud: 'onestop-client', sub: subject,
      nonce, iat: now, exp: now + 3600, name: 'Demo renter', email: 'renter@example.com', email_verified: true,
    })).toString('base64url');
    const input = header + '.' + payload;
    return input + '.' + sign('RSA-SHA256', Buffer.from(input), privateKey).toString('base64url');
  };
  const customFetch: typeof fetch = async (input) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    if (url.pathname === '/.well-known/openid-configuration') return Response.json({
      issuer: issuer + '/', authorization_endpoint: issuer + '/authorize', token_endpoint: issuer + '/oauth/token',
      jwks_uri: issuer + '/.well-known/jwks.json', response_types_supported: ['code'], subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'], token_endpoint_auth_methods_supported: ['client_secret_post'],
      code_challenge_methods_supported: ['S256'],
    });
    if (url.pathname === '/.well-known/jwks.json') return Response.json({ keys: [jwk] });
    if (url.pathname === '/oauth/token') return Response.json({ id_token: jwt(), access_token: 'test-access-token', token_type: 'Bearer', expires_in: 3600 });
    throw new Error('Unexpected test provider request');
  };
  return { config: { ...readAuthConfig({ ...environment(), AUTH0_ISSUER_BASE_URL: issuer })!, customFetch },
    setNonce: (value: string) => { nonce = value; }, setSubject: (value: string) => { subject = value; } };
}

describe('Auth0 configuration', () => {
  it('keeps an unconfigured demo usable and rejects partially enabled auth', () => {
    expect(readAuthConfig({})).toBeNull();
    expect(readAuthConfig({ AUTH0_ENABLED: 'false' })).toBeNull();
    expect(() => readAuthConfig({ AUTH0_ENABLED: 'true' })).toThrow('AUTH0_ISSUER_BASE_URL');
    expect(() => readAuthConfig({ AUTH0_CLIENT_ID: 'partial' })).toThrow();
    expect(() => readAuthConfig({ AUTH0_ENABLED: 'maybe' })).toThrow('AUTH0_ENABLED');
  });
  it('rejects unsafe or malformed configuration without exposing values', () => {
    expect(() => readAuthConfig({ ...environment(), AUTH0_BASE_URL: 'http://public.example' })).toThrow('AUTH0_BASE_URL');
    expect(() => readAuthConfig({ ...environment(), AUTH0_BASE_URL: 'https://user:password@public.example' })).toThrow('AUTH0_BASE_URL');
    expect(() => readAuthConfig({ ...environment(), AUTH0_ISSUER_BASE_URL: 'http://issuer.example' })).toThrow('AUTH0_ISSUER_BASE_URL');
    expect(() => readAuthConfig({ ...environment(), AUTH0_SECRET: 'short' })).toThrow('AUTH0_SECRET');
  });
  it('uses server-side code flow with an HTTP-only cookie that becomes secure on HTTPS', () => {
    const config = readAuthConfig(environment())!;
    expect(config.authorizationParams).toMatchObject({ response_type: 'code', response_mode: 'query', scope: 'openid profile email' });
    expect(config.session).toMatchObject({ name: 'onestop_session', cookie: { httpOnly: true, sameSite: 'Lax', secure: false } });
    expect(readAuthConfig({ ...environment(), AUTH0_BASE_URL: 'https://housing.example' })!.session).toMatchObject({ cookie: { secure: true } });
  });
});

describe('Auth0 session boundary', () => {
  it('reports disabled auth truthfully and protects account data while keeping the demo public', async () => {
    const { get } = await start(null);
    const session = await get('/api/session');
    expect(await session.json()).toEqual({ status: 'disabled' });
    expect(session.headers.get('cache-control')).toContain('no-store');
    expect((await get('/api/account')).status).toBe(401);
    expect((await get('/auth/login')).status).toBe(503);
    expect(await (await get('/')).text()).toContain('public housing demo');
  });
  it('rejects forged cookies and never redirects a JSON account request to login HTML', async () => {
    const { get } = await start(readAuthConfig(environment()));
    const response = await get('/api/account', 'onestop_session=forged-admin-cookie');
    expect(response.status).toBe(401);
    expect(response.headers.get('content-type')).toContain('application/json');
    expect(response.headers.get('location')).toBeNull();
    expect(await (await get('/api/session')).json()).toEqual({ status: 'anonymous' });
  });
  it('logs in via the actual SDK, persists the session and only exposes declared profile fields', async () => {
    const fixture = provider();
    const { base, get } = await start(fixture.config);
    const login = await get('/auth/login?returnTo=https://outside.example');
    expect(login.status).toBe(302);
    const authorization = new URL(login.headers.get('location')!);
    expect(authorization.searchParams.get('redirect_uri')).toBe(base + '/auth/callback');
    expect(authorization.searchParams.get('response_type')).toBe('code');
    fixture.setNonce(authorization.searchParams.get('nonce')!);
    const callback = await get('/auth/callback?' + new URLSearchParams({ code: 'test-code', state: authorization.searchParams.get('state')! }), cookieHeader(login));
    expect(callback.status).toBe(302);
    expect(callback.headers.get('location')).toBe('/');
    const cookie = cookieHeader(callback);
    expect(cookie).toContain('onestop_session=');
    expect(callback.headers.getSetCookie().some(value => value.startsWith('onestop_session=') && value.includes('HttpOnly') && value.includes('SameSite=Lax'))).toBe(true);
    const session = await (await get('/api/session', cookie)).json();
    expect(session).toEqual({ status: 'authenticated', user: { sub: 'auth0|demo-a', name: 'Demo renter', email: 'renter@example.com', emailVerified: true } });
    expect(await (await get('/api/account', cookie)).json()).toEqual({ user: session.user });
    const logout = await get('/auth/logout', cookie);
    expect(logout.status).toBe(302);
    expect(logout.headers.getSetCookie().some(value => value.startsWith('onestop_session=;'))).toBe(true);
  });
  it('requests hosted sign-up and rejects callbacks with missing or mismatched transaction state', async () => {
    const fixture = provider();
    const { get } = await start(fixture.config);
    const signup = await get('/auth/signup');
    expect(new URL(signup.headers.get('location')!).searchParams.get('screen_hint')).toBe('signup');
    const bad = await get('/auth/callback?code=bogus&state=wrong', cookieHeader(signup));
    expect(bad.status).toBe(303);
    expect(bad.headers.get('location')).toBe('/?auth=error');
    const missing = await get('/auth/callback?error=access_denied&error_description=sensitive-provider-detail');
    expect(missing.headers.get('location')).toBe('/?auth=error');
    expect(await missing.text()).not.toContain('sensitive-provider-detail');
    expect(await (await get('/api/session', cookieHeader(bad))).json()).toEqual({ status: 'anonymous' });
  });
});
