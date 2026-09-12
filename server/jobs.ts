import { randomUUID } from 'node:crypto';
import type { Job } from '../src/domain/jobs.js';
import type { Snapshot } from '../src/domain/schema.js';
import { AppError } from './errors.js';
export type JobOutput = { snapshot: Snapshot; partial?: boolean; message?: string };
export type JobWorker = (signal: AbortSignal, progress: (message: string, completed?: number, total?: number | null) => void) => Promise<JobOutput>;
export function createJobManager(publish: (snapshot: Snapshot) => Promise<void>, options: { timeoutMs?: number } = {}) {
  type Entry = { job: Job; key: string; controller: AbortController; completion: Promise<void> };
  const entries = new Map<string, Entry>();
  let queue: Promise<void> = Promise.resolve();
  const active = (entry: Entry) => entry.job.status === 'queued' || entry.job.status === 'running';
  const getEntry = (id: string) => {
    const entry = entries.get(id);
    if (!entry) throw new AppError('JOB_NOT_FOUND', 'That research job is unavailable.', 404);
    return entry;
  };
  const get = (id: string) => structuredClone(getEntry(id).job);
  const start = (type: Job['type'], key: string, worker: JobWorker): Job => {
    const duplicate = [...entries.values()].find(entry => active(entry) && entry.job.type === type && entry.key === key);
    if (duplicate) return get(duplicate.job.id);
    if ([...entries.values()].filter(active).length >= 3) throw new AppError('RESEARCH_BUSY', 'Research is already queued. Please wait for the current searches to finish.', 429);
    const now = new Date().toISOString();
    const job: Job = { id: randomUUID(), type, status: 'queued', createdAt: now, updatedAt: now, progress: { completed: 0, total: null, message: 'Queued for research' }, snapshotId: null, error: null };
    const entry: Entry = { job, key, controller: new AbortController(), completion: Promise.resolve() };
    entries.set(job.id, entry);
    const run = async () => {
      if (entry.controller.signal.aborted) return;
      job.status = 'running';
      job.updatedAt = new Date().toISOString();
      job.progress.message = type === 'routes' ? 'Computing walking routes' : 'Checking housing sources';
      let timer: ReturnType<typeof setTimeout> | undefined;
      const progress = (message: string, completed = job.progress.completed, total = job.progress.total) => {
        if (entry.controller.signal.aborted || job.status !== 'running') return;
        job.progress = { message, completed, total };
        job.updatedAt = new Date().toISOString();
      };
      try {
        const timeout = new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            entry.controller.abort();
            reject(new AppError('JOB_TIMEOUT', 'Research reached its time limit. Your previous results are preserved.', 504));
          }, options.timeoutMs ?? 6 * 60 * 1000);
        });
        const output = await Promise.race([worker(entry.controller.signal, progress), timeout]);
        clearTimeout(timer);
        if (entry.controller.signal.aborted) throw new AppError('JOB_CANCELLED', 'Research was cancelled.', 499);
        await publish(output.snapshot);
        job.snapshotId = output.snapshot.id;
        job.status = output.partial ? 'partial' : 'succeeded';
        job.progress = { completed: output.snapshot.homes.length, total: output.snapshot.homes.length, message: output.message ?? `${output.snapshot.homes.length} researched options ready` };
      } catch (error) {
        const detail = error instanceof AppError ? error : new AppError('RESEARCH_FAILED', 'Research could not complete. Your previous results are preserved.');
        job.status = detail.code === 'JOB_CANCELLED' || detail.code === 'PROCESS_CANCELLED' ? 'cancelled' : 'failed';
        job.error = { code: detail.code, message: detail.message };
        job.progress.message = detail.message;
      } finally {
        clearTimeout(timer);
        job.updatedAt = new Date().toISOString();
      }
    };
    entry.completion = queue.then(run);
    queue = entry.completion.catch(() => undefined);
    if (entries.size > 100) {
      for (const [id, old] of entries) {
        if (!active(old) && id !== job.id) entries.delete(id);
        if (entries.size <= 80) break;
      }
    }
    return get(job.id);
  };
  return { start, get, settled: (id: string) => getEntry(id).completion };
}

export type JobManager = ReturnType<typeof createJobManager>;
