import { describe, expect, it } from 'vitest';
import { fetchPublicPage, pinnedLookup, sourceIdFor } from '../../jobs/sources/public-page.js';

describe('public source host boundary', () => {
  it('does not assign a registered source identity to a lookalike host', () => {
    expect(sourceIdFor('https://cmu.edu.evil.example/listing')).toBe('cmu.edu.evil.example');
  });
  it('rejects a registered host when resolution yields a loopback address', async () => {
    await expect(fetchPublicPage('https://lobosmanagement.com/units', undefined, {
      resolveHost: async () => [{ address: '127.0.0.1', family: 4 }],
    })).rejects.toMatchObject({ code: 'private_address' });
  });
  it('returns an address array when Node requests all lookup records', async () => {
    const lookup = pinnedLookup({ address: '93.184.216.34', family: 4 });
    const result = await new Promise<unknown>((resolve, reject) => {
      lookup('lobosmanagement.com', { all: true }, (error, address) => error ? reject(error) : resolve(address));
    });
    expect(result).toEqual([{ address: '93.184.216.34', family: 4 }]);
  });
  it('does not begin DNS resolution for an already-aborted source request', async () => {
    const controller = new AbortController();
    controller.abort();
    let resolved = false;
    await expect(fetchPublicPage('https://lobosmanagement.com/units', controller.signal, {
      resolveHost: async () => { resolved = true; return [{ address: '93.184.216.34', family: 4 }]; },
    })).rejects.toMatchObject({ code: 'timeout' });
    expect(resolved).toBe(false);
  });
  it('stops waiting for injected DNS resolution when the source request aborts', async () => {
    const controller = new AbortController();
    let release!: (addresses: Array<{ address: string; family: 4 }>) => void;
    const lookup = new Promise<Array<{ address: string; family: 4 }>>(resolve => { release = resolve; });
    const pending = fetchPublicPage('https://lobosmanagement.com/units', controller.signal, { resolveHost: async () => lookup });
    controller.abort();
    release([{ address: '127.0.0.1', family: 4 }]);
    await expect(pending).rejects.toMatchObject({ code: 'timeout' });
  });
});
