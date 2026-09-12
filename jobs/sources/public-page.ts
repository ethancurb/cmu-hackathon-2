import { createHash } from 'node:crypto';
import { isIP } from 'node:net';
import type { Capture } from './types.js';

export const REGISTERED_HOSTS = new Set([
  'offcampus.housing.cmu.edu', 'lobosmanagement.com', 'www.lobosmanagement.com',
  'reinholdresidential.com', 'www.reinholdresidential.com', 'kerpecmgt.com', 'www.kerpecmgt.com',
  'walnutcapital.com', 'www.walnutcapital.com',
]);

const MAX_BYTES = 12 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = 'AddressHousingResearch/0.1 (+local demo; public pages only)';

export class PublicPageError extends Error {
  constructor(public readonly code: 'unregistered_host' | 'invalid_url' | 'timeout' | 'too_large' | 'access_denied' | 'network', message: string) { super(message); }
}

function allowedHost(hostname: string): boolean {
  const lower = hostname.toLowerCase().replace(/\.$/, '');
  if (REGISTERED_HOSTS.has(lower)) return true;
  if (isIP(lower)) return false;
  return false;
}

function validateUrl(input: string | URL): URL {
  let url: URL;
  try { url = input instanceof URL ? new URL(input.href) : new URL(input); } catch { throw new PublicPageError('invalid_url', 'Source URL is not valid'); }
  if (url.protocol !== 'https:' || !allowedHost(url.hostname)) throw new PublicPageError('unregistered_host', `Public source host is not registered: ${url.hostname}`);
  return url;
}

async function readBounded(response: Response): Promise<string> {
  if (!response.body) return '';
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      total += next.value.byteLength;
      if (total > MAX_BYTES) throw new PublicPageError('too_large', `Source response exceeds ${MAX_BYTES} bytes`);
      chunks.push(next.value);
    }
  } finally { reader.releaseLock(); }
  const data = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(data);
}

export async function fetchPublicPage(input: string | URL, signal?: AbortSignal): Promise<Capture> {
  const url = validateUrl(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    const response = await fetch(url, { redirect: 'manual', headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' }, signal: controller.signal });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) throw new PublicPageError('network', 'Redirect missing location');
      const redirected = validateUrl(new URL(location, url));
      const follow = await fetch(redirected, { redirect: 'manual', headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' }, signal: controller.signal });
      if (follow.status >= 300 && follow.status < 400) throw new PublicPageError('network', 'More than one redirect is not accepted');
      if (follow.status === 401 || follow.status === 403 || follow.status === 429) throw new PublicPageError('access_denied', `Source denied access (${follow.status})`);
      if (!follow.ok) throw new PublicPageError('network', `Source returned ${follow.status}`);
      const html = await readBounded(follow);
      return { url: redirected.href, fetchedAt: new Date().toISOString(), html, captureHash: createHash('sha256').update(html).digest('hex'), sourceId: sourceIdFor(redirected) };
    }
    if (response.status === 401 || response.status === 403 || response.status === 429) throw new PublicPageError('access_denied', `Source denied access (${response.status})`);
    if (!response.ok) throw new PublicPageError('network', `Source returned ${response.status}`);
    const html = await readBounded(response);
    return { url: url.href, fetchedAt: new Date().toISOString(), html, captureHash: createHash('sha256').update(html).digest('hex'), sourceId: sourceIdFor(url) };
  } catch (error) {
    if (error instanceof PublicPageError) throw error;
    if ((error as Error).name === 'AbortError') throw new PublicPageError('timeout', `Source request exceeded ${REQUEST_TIMEOUT_MS}ms`);
    throw new PublicPageError('network', (error as Error).message || 'Source request failed');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
}

export function sourceIdFor(url: URL | string): string {
  const hostname = (url instanceof URL ? url.hostname : new URL(url).hostname).toLowerCase();
  if (hostname.includes('cmu.edu')) return 'cmu-offcampus';
  if (hostname.includes('lobosmanagement')) return 'lobos-management';
  if (hostname.includes('reinholdresidential')) return 'reinhold-residential';
  if (hostname.includes('kerpecmgt')) return 'kerpec-management';
  if (hostname.includes('walnutcapital')) return 'walnut-capital';
  return hostname;
}
