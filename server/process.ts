export type ProcessRequest = {
  binary: string; args: string[]; input: string; timeoutMs: number;
  cwd?: string; env?: NodeJS.ProcessEnv; maxOutputBytes?: number; signal?: AbortSignal;
};
export type ProcessResult = { exitCode: number; stdout: string; stderr: string };
export function workerEnvironment(): NodeJS.ProcessEnv {
  return Object.fromEntries(
    ['PATH', 'HOME', 'TMPDIR', 'LANG', 'XDG_CONFIG_HOME', 'XDG_DATA_HOME']
      .flatMap(key => process.env[key] === undefined ? [] : [[key, process.env[key]!]]),
  );
}

export async function runBoundedProcess(request: ProcessRequest): Promise<ProcessResult> {
  if (request.signal?.aborted) throw new AppError('PROCESS_CANCELLED', 'Research was cancelled.', 499);
  if (Buffer.byteLength(request.input) > 1024 * 1024) throw new AppError('PROCESS_INPUT_LIMIT', 'Research request is too large.', 400);
  if (!Number.isFinite(request.timeoutMs) || request.timeoutMs <= 0) throw new AppError('PROCESS_CONFIGURATION', 'A finite worker timeout is required.');
  return new Promise((resolve, reject) => {
    const child = spawn(request.binary, request.args, {
      cwd: request.cwd, env: request.env ?? workerEnvironment(), shell: false,
      detached: process.platform !== 'win32', stdio: ['pipe', 'pipe', 'pipe'],
    });
    let finished = false;
    let failure: AppError | null = null;
    let byteCount = 0;
    const out: Buffer[] = [];
    const err: Buffer[] = [];
    let forceTimer: ReturnType<typeof setTimeout> | undefined;
    let finalTimer: ReturnType<typeof setTimeout> | undefined;

    const terminate = (signal: NodeJS.Signals) => {
      if (!child.pid) return;
      try {
        if (process.platform !== 'win32') process.kill(-child.pid, signal);
        else child.kill(signal);
      } catch { /* An already exited process has nothing left to terminate. */ }
    };
    const finish = (result?: ProcessResult, error?: Error) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      clearTimeout(forceTimer);
      clearTimeout(finalTimer);
      request.signal?.removeEventListener('abort', abort);
      if (error) reject(error); else resolve(result!);
    };
    const stop = (error: AppError) => {
      if (failure || finished) return;
      failure = error;
      terminate('SIGTERM');
      forceTimer = setTimeout(() => terminate('SIGKILL'), 2000);
      finalTimer = setTimeout(() => finish(undefined, error), 2500);
    };
    const abort = () => stop(new AppError('PROCESS_CANCELLED', 'Research was cancelled.', 499));
    const timeout = setTimeout(() => stop(new AppError('PROCESS_TIMEOUT', 'The research worker exceeded its time limit.', 504)), request.timeoutMs);
    request.signal?.addEventListener('abort', abort, { once: true });
    if (request.signal?.aborted) abort();

    const append = (target: Buffer[], chunk: Buffer) => {
      if (failure) return;
      byteCount += chunk.length;
      if (byteCount > (request.maxOutputBytes ?? 2 * 1024 * 1024)) {
        stop(new AppError('PROCESS_OUTPUT_LIMIT', 'The research worker returned too much data.', 502));
        return;
      }
      target.push(chunk);
    };
    child.stdout.on('data', chunk => append(out, Buffer.from(chunk)));
    child.stderr.on('data', chunk => append(err, Buffer.from(chunk)));
    child.on('error', () => finish(undefined, new AppError('PROCESS_UNAVAILABLE', 'The configured research worker could not start.', 503)));
    child.on('close', code => finish({ exitCode: code ?? -1, stdout: Buffer.concat(out).toString('utf8'), stderr: Buffer.concat(err).toString('utf8') }, failure ?? undefined));
    child.stdin.on('error', () => { /* Closing stdin is normal when a worker exits early. */ });
    child.stdin.end(request.input);
  });
}
import { spawn } from 'node:child_process';
import { AppError } from './errors.js';
