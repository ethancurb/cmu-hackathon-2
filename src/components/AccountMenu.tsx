import { ChevronDown, CircleAlert, LogIn, LogOut, RefreshCw, UserRound } from 'lucide-react';
import type { SessionState } from '../lib/auth.js';

type Props = {
  session: SessionState | null;
  error: string | null;
  onRetry: () => void;
};

export function AccountMenu({ session, error, onRetry }: Props) {
  if (session === null && !error) return <span className="account-loading" aria-live="polite">Checking account…</span>;
  if (error) return <div className="account-error" role="status"><CircleAlert size={14}/><span>Account unavailable</span><button type="button" onClick={onRetry} aria-label="Retry account check"><RefreshCw size={13}/> Retry</button></div>;
  if (session?.status === 'disabled') return <span className="account-disabled" title="Auth0 has not been configured for this demo">Account unavailable</span>;
  if (!session || session.status === 'anonymous') return <details className="account-menu"><summary aria-label="Open account menu"><UserRound size={15}/><span>Account</span><ChevronDown size={13}/></summary><div className="account-popover"><p className="account-title">Keep your workspace separate</p><p className="account-copy">Saved on this browser</p><a className="account-link primary" href="/auth/login"><LogIn size={14}/> Sign in</a><a className="account-link" href="/auth/signup">Create account</a></div></details>;

  const { user } = session;
  const identity = user.name || user.email || 'Account';
  return <details className="account-menu"><summary aria-label="Open account menu"><UserRound size={15}/><span>{identity}</span><ChevronDown size={13}/></summary><div className="account-popover"><strong>{identity}</strong>{user.email && <span className="account-email">{user.email}</span>}{user.email && user.emailVerified && <span className="account-verified">Email verified</span>}<p className="account-copy">Saved on this browser</p><a className="account-link" href="/auth/logout"><LogOut size={14}/> Log out</a></div></details>;
}
