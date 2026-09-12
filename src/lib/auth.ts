export type AuthUser = {
  sub: string;
  name?: string;
  email?: string;
  emailVerified: boolean;
};

export type SessionState =
  | { status: 'disabled' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthUser };

function isUser(value: unknown): value is AuthUser {
  if (!value || typeof value !== 'object') return false;
  const user = value as Record<string, unknown>;
  return typeof user.sub === 'string'
    && typeof user.emailVerified === 'boolean'
    && (user.name === undefined || typeof user.name === 'string')
    && (user.email === undefined || typeof user.email === 'string');
}

function isSession(value: unknown): value is SessionState {
  if (!value || typeof value !== 'object') return false;
  const session = value as Record<string, unknown>;
  return session.status === 'disabled' || session.status === 'anonymous'
    || (session.status === 'authenticated' && isUser(session.user));
}

export async function getSession(signal?: AbortSignal): Promise<SessionState> {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  signal?.addEventListener('abort', onAbort, { once: true });
  if (signal?.aborted) controller.abort();
  const timeout = window.setTimeout(() => { timedOut = true; controller.abort(); }, 8_000);
  try {
    const response = await fetch('/api/session', {
      credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
      headers: { accept: 'application/json' },
    });
    if (!response.ok) throw new Error(`Account check failed (${response.status}).`);
    const value: unknown = await response.json();
    if (!isSession(value)) throw new Error('Account check returned an invalid response.');
    return value;
  } catch (error) {
    if (timedOut) throw new Error('Account check timed out. Try again.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
    signal?.removeEventListener('abort', onAbort);
  }
}
