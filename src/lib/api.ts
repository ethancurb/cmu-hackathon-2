import type { Criteria, Destination, NicheResult, Snapshot } from '../domain/schema.js';

export type Job = {
  id: string; type: 'discovery' | 'routes';
  status: 'queued' | 'running' | 'partial' | 'succeeded' | 'failed' | 'cancelled';
  createdAt: string; updatedAt: string;
  progress: { completed: number; total: number | null; message: string };
  snapshotId: string | null; error: { code: string; message: string } | null;
};

export type Bootstrap = { snapshot: Snapshot; seed: Criteria; capabilities: { discovery: boolean; routing: boolean } };

async function json<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.message ?? `${response.status} ${response.statusText}`);
  return body as T;
}

export const api = {
  bootstrap: () => json<Bootstrap>('/api/bootstrap'),
  snapshot: (id: string) => json<{ snapshot: Snapshot }>(`/api/snapshots/${encodeURIComponent(id)}`),
  search: (snapshotId: string, requestId: string, criteria: Criteria) => json<unknown>('/api/search', { method: 'POST', body: JSON.stringify({ snapshotId, requestId, criteria }) }),
  discovery: (criteria: Criteria) => json<{ job: Job }>('/api/discovery', { method: 'POST', body: JSON.stringify({ criteria }) }),
  routes: (snapshotId: string, destination: Destination, homeIds: string[]) => json<{ job: Job }>('/api/routes', { method: 'POST', body: JSON.stringify({ snapshotId, destination, homeIds }) }),
  destination: (query: string, market: Criteria['market']) => json<{ candidates: Destination[] }>('/api/destination', { method: 'POST', body: JSON.stringify({ query, market }) }),
  pinDestination: (label: string, coordinate: Destination['coordinate']) => json<{ candidates: Destination[] }>('/api/destination', { method: 'POST', body: JSON.stringify({ label, coordinate }) }),
  job: (id: string) => json<{ job: Job }>(`/api/jobs/${encodeURIComponent(id)}`),
  import: (sourceId: string, url: string, text: string, criteria: Criteria, snapshotId: string) => json<{ job: Job }>('/api/import', { method: 'POST', body: JSON.stringify({ sourceId, url, text: text.trim() || undefined, criteria, snapshotId }) }),
  // Aborting `signal` cancels the model call server-side; there is no job to poll.
  niche: (snapshotId: string, query: string, signal: AbortSignal) => json<NicheResult>('/api/niche', { method: 'POST', body: JSON.stringify({ snapshotId, query }), signal }),
};
