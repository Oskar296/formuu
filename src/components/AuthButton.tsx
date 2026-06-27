'use client';

import { useState } from 'react';
import { useAuth } from './AuthProvider';

export default function AuthButton() {
  const { user, loading, syncing, configured, signInWithGoogle, signInWithMagicLink, signOut, sync } = useAuth();
  const [showMenu, setShowMenu] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [error, setError] = useState('');

  // Don't show anything if Supabase isn't configured
  if (!configured) return null;

  if (loading) {
    return <div className="h-7 w-7 rounded-full bg-surface animate-pulse" />;
  }

  // Logged in state
  if (user) {
    const initial = (user.email?.[0] || user.user_metadata?.name?.[0] || '?').toUpperCase();
    return (
      <div className="relative">
        <button
          onClick={() => setShowMenu(!showMenu)}
          className="flex items-center gap-1.5 text-xs"
          title={user.email || 'Account'}
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white text-[11px] font-bold">
            {initial}
          </span>
          {syncing && (
            <span className="text-[10px] text-muted animate-pulse">syncing…</span>
          )}
        </button>
        {showMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowMenu(false)} />
            <div className="absolute right-0 top-9 z-50 w-56 rounded-lg border border-border bg-white shadow-lg p-3 space-y-2">
              <p className="text-[11px] text-muted truncate px-1">{user.email}</p>
              <button
                onClick={() => { sync(); setShowMenu(false); }}
                className="w-full text-left rounded-md px-2 py-1.5 text-xs hover:bg-surface transition-colors"
              >
                🔄 Sync now
              </button>
              <button
                onClick={() => { signOut(); setShowMenu(false); }}
                className="w-full text-left rounded-md px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 transition-colors"
              >
                Sign out
              </button>
            </div>
          </>
        )}
      </div>
    );
  }

  // Logged out state
  if (showLogin) {
    return (
      <>
        <div className="fixed inset-0 z-40 bg-black/20" onClick={() => { setShowLogin(false); setError(''); setMagicLinkSent(false); }} />
        <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-80 rounded-xl border border-border bg-white shadow-xl p-6">
          <h3 className="text-sm font-bold mb-1">Sign in to sync progress</h3>
          <p className="text-[11px] text-muted mb-5">Your data syncs across all your devices.</p>

          <button
            onClick={signInWithGoogle}
            className="w-full rounded-lg border border-border px-3 py-2.5 text-xs font-medium hover:bg-surface transition-colors flex items-center justify-center gap-2 mb-3"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Continue with Google
          </button>

          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-[10px] text-muted">or</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {magicLinkSent ? (
            <div className="text-center py-3">
              <p className="text-xs text-emerald-600 font-medium">✓ Check your email</p>
              <p className="text-[11px] text-muted mt-1">Click the link we sent to sign in.</p>
            </div>
          ) : (
            <form onSubmit={async (e) => {
              e.preventDefault();
              setError('');
              const { error } = await signInWithMagicLink(email);
              if (error) setError(error);
              else setMagicLinkSent(true);
            }}>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                className="w-full rounded-lg border border-border px-3 py-2 text-xs mb-2 focus:border-accent focus:outline-none"
              />
              <button
                type="submit"
                className="w-full rounded-lg bg-accent px-3 py-2 text-xs font-medium text-white hover:bg-accent-hover transition-colors"
              >
                Send magic link
              </button>
            </form>
          )}

          {error && <p className="text-[11px] text-red-500 mt-2">{error}</p>}

          <button
            onClick={() => { setShowLogin(false); setError(''); setMagicLinkSent(false); }}
            className="w-full mt-3 text-[11px] text-muted hover:text-foreground transition-colors"
          >
            Cancel
          </button>
        </div>
      </>
    );
  }

  return (
    <button
      onClick={() => setShowLogin(true)}
      className="rounded-md border border-border px-2.5 py-1 text-[11px] font-medium text-muted hover:text-foreground hover:border-foreground/20 transition-colors"
    >
      Sign in
    </button>
  );
}
