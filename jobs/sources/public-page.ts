import { createHash } from 'node:crypto';
import { lookup as dnsLookup } from 'node:dns/promises';
import { isIP } from 'node:net';
import { request as httpsRequest } from 'node:https';
import type { Capture } from './types.js';

export const REGISTERED_HOSTS = new Set([
  'offcampus.housing.cmu.edu', 'lobosmanagement.com', 'www.lobosmanagement.com',
  'reinholdresidential.com', 'www.reinholdresidential.com', 'kerpecmgt.com', 'www.kerpecmgt.com',
  'walnutcapital.com', 'www.walnutcapital.com',
]);
const SOURCE_IDS: Record<string, string> = {
  'offcampus.housing.cmu.edu': 'cmu-offcampus',
  'lobosmanagement.com': 'lobos-management', 'www.lobosmanagement.com': 'lobos-management',
  'reinholdresidential.com': 'reinhold-residential', 'www.reinholdresidential.com': 'reinhold-residential',
  'kerpecmgt.com': 'kerpec-management', 'www.kerpecmgt.com': 'kerpec-management',
  'walnutcapital.com': 'walnut-capital', 'www.walnutcapital.com': 'walnut-capital',
};
const MAX_BYTES = 12 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 15_000;
const USER_AGENT = 'AddressHousingResearch/0.1 (+local demo; public pages only)';

export class PublicPageError extends Error {
  constructor(public readonly code: 'unregistered_host' | 'invalid_url' | 'private_address' | 'timeout' | 'too_large' | 'access_denied' | 'network', message: string) { super(message); }
}
export type ResolvedAddress = { address: string; family: 4 | 6 };
export type PublicPageOptions = { resolveHost?: (hostname: string) => Promise<ResolvedAddress[]> };
const cancelled = () => new PublicPageError('timeout', `Source request exceeded ${REQUEST_TIMEOUT_MS}ms`);
const throwIfAborted = (signal?: AbortSignal) => { if (signal?.aborted) throw cancelled(); };
const awaitWithAbort = <T>(work: Promise<T>, signal?: AbortSignal): Promise<T> => {
  throwIfAborted(signal);
  if (!signal) return work;
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(cancelled());
    signal.addEventListener('abort', abort, { once: true });
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort));
  });
};

const normalizedHost = (hostname: string) => hostname.toLowerCase().replace(/\.$/, '');
const allowedHost = (hostname: string) => REGISTERED_HOSTS.has(normalizedHost(hostname)) && !isIP(hostname);
const defaultResolveHost = async (hostname: string): Promise<ResolvedAddress[]> => (await dnsLookup(hostname, { all: true, verbatim: true }))
  .flatMap(item => item.family === 4 || item.family === 6 ? [{ address: item.address, family: item.family }] : []);
const privateIpv4 = (address: string) => {
  const parts = address.split('.').map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254)
    || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0)
    || (a === 198 && (b === 18 || b === 19)) || a >= 224;
};
const publicAddress = (address: string) => {
  const family = isIP(address);
  if (family === 4) return !privateIpv4(address);
  if (family !== 6) return false;
  const lower = address.toLowerCase();
  if (lower === '::' || lower === '::1' || lower.startsWith('fe80:') || lower.startsWith('fc') || lower.startsWith('fd')) return false;
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  return !mapped || !privateIpv4(mapped[1]!);
};

function validateUrl(input: string | URL): URL {
  let url: URL;
  try { url = input instanceof URL ? new URL(input.href) : new URL(input); } catch { throw new PublicPageError('invalid_url', 'Source URL is not valid'); }
  if (url.protocol !== 'https:' || url.port && url.port !== '443' || url.username || url.password || !allowedHost(url.hostname)) throw new PublicPageError('unregistered_host', `Public source host is not registered: ${url.hostname}`);
  return url;
}

export async function resolvePublicHost(hostname: string, resolveHost: PublicPageOptions['resolveHost'] = defaultResolveHost, signal?: AbortSignal): Promise<ResolvedAddress> {
  const addresses = await awaitWithAbort(resolveHost!(normalizedHost(hostname)), signal);
  if (!addresses.length || addresses.some(item => !publicAddress(item.address))) throw new PublicPageError('private_address', 'Public source host resolved to a private or invalid address.');
  return addresses[0]!;
}

/** Node 26 asks custom lookups for all records; preserve the pinned address in that shape. */
export function pinnedLookup(pinned: ResolvedAddress) {
  return (_host: string, options: { all?: boolean }, callback: (error: Error | null, address: string | ResolvedAddress[], family?: 4 | 6) => void) => {
    if (options.all) callback(null, [pinned]);
    else callback(null, pinned.address, pinned.family);
  };
}

async function requestPage(url: URL, pinned: ResolvedAddress, signal: AbortSignal): Promise<{ status: number; location: string | undefined; html: string }> {
  throwIfAborted(signal);
  return new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error, value?: { status: number; location: string | undefined; html: string }) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(value!);
    };
    const request = httpsRequest(url, { headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' }, lookup: pinnedLookup(pinned) as never });
    const abort = () => request.destroy(new PublicPageError('timeout', `Source request exceeded ${REQUEST_TIMEOUT_MS}ms`));
    signal.addEventListener('abort', abort, { once: true });
    request.once('error', error => finish(error));
    request.once('response', response => {
      const status = response.statusCode ?? 0;
      const location = typeof response.headers.location === 'string' ? response.headers.location : undefined;
      if (status >= 300 && status < 400) { response.resume(); finish(undefined, { status, location, html: '' }); return; }
      const chunks: Buffer[] = []; let total = 0;
      response.on('data', (chunk: Buffer) => {
        total += chunk.length;
        if (total > MAX_BYTES) request.destroy(new PublicPageError('too_large', `Source response exceeds ${MAX_BYTES} bytes`));
        else chunks.push(chunk);
      });
      response.once('error', error => finish(error));
      response.once('end', () => finish(undefined, { status, location, html: Buffer.concat(chunks).toString('utf8') }));
    });
    request.end();
  });
}

async function fetchPublicPageOnce(input: string | URL, signal?: AbortSignal, options: PublicPageOptions = {}): Promise<Capture> {
  throwIfAborted(signal);
  const url = validateUrl(input);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) onAbort();
  try {
    const first = await requestPage(url, await resolvePublicHost(url.hostname, options.resolveHost, controller.signal), controller.signal);
    let finalUrl = url; let response = first;
    if (first.status >= 300 && first.status < 400) {
      if (!first.location) throw new PublicPageError('network', 'Redirect missing location');
      finalUrl = validateUrl(new URL(first.location, url));
      response = await requestPage(finalUrl, await resolvePublicHost(finalUrl.hostname, options.resolveHost, controller.signal), controller.signal);
      if (response.status >= 300 && response.status < 400) throw new PublicPageError('network', 'More than one redirect is not accepted');
    }
    if (response.status === 401 || response.status === 403 || response.status === 429) throw new PublicPageError('access_denied', `Source denied access (${response.status})`);
    if (response.status < 200 || response.status >= 300) throw new PublicPageError('network', `Source returned ${response.status}`);
    return { url: finalUrl.href, fetchedAt: new Date().toISOString(), html: response.html, captureHash: createHash('sha256').update(response.html).digest('hex'), sourceId: sourceIdFor(finalUrl) };
  } catch (error) {
    if (error instanceof PublicPageError) throw error;
    throw new PublicPageError('network', (error as Error).message || 'Source request failed');
  } finally { clearTimeout(timer); signal?.removeEventListener('abort', onAbort); }
}

/** One bounded retry is allowed for transient network/timeouts; denied/private hosts never retry. */
export async function fetchPublicPage(input: string | URL, signal?: AbortSignal, options: PublicPageOptions = {}): Promise<Capture> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try { return await fetchPublicPageOnce(input, signal, options); }
    catch (error) {
      if (attempt === 1 || !(error instanceof PublicPageError) || (error.code !== 'network' && error.code !== 'timeout')) throw error;
      if (signal?.aborted) throw error;
    }
  }
  throw new PublicPageError('network', 'Source request failed after retry');
}

export function sourceIdFor(url: URL | string): string {
  const hostname = normalizedHost(url instanceof URL ? url.hostname : new URL(url).hostname);
  return SOURCE_IDS[hostname] ?? hostname;
}
