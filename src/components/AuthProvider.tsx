'use client';

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { syncProgress, pushToCloud } from '@/lib/cloud-sync';
import type { User } from '@supabase/supabase-js';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  syncing: boolean;
  configured: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithMagicLink: (email: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  sync: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  syncing: false,
  configured: false,
  signInWithGoogle: async () => {},
  signInWithMagicLink: async () => ({ error: null }),
  signOut: async () => {},
  sync: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const configured = isSupabaseConfigured();

  useEffect(() => {
    if (!supabase || !configured) {
      setLoading(false);
      return;
    }

    // Get initial session
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
      setLoading(false);
      if (user) {
        // Auto-sync on load when logged in
        setSyncing(true);
        syncProgress().finally(() => setSyncing(false));
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        const newUser = session?.user ?? null;
        setUser(newUser);
        if (newUser) {
          setSyncing(true);
          await syncProgress();
          setSyncing(false);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [configured]);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    if (!supabase) return { error: 'Supabase not configured' };
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    return { error: error?.message ?? null };
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    // Push local state before signing out
    await pushToCloud();
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const sync = useCallback(async () => {
    setSyncing(true);
    await syncProgress();
    setSyncing(false);
  }, []);

  // Auto-sync every 2 minutes when logged in
  useEffect(() => {
    if (!user) return;
    const interval = setInterval(() => {
      pushToCloud();
    }, 120_000);
    return () => clearInterval(interval);
  }, [user]);

  // Push to cloud before tab closes
  useEffect(() => {
    if (!user) return;
    const handler = () => { pushToCloud(); };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, syncing, configured, signInWithGoogle, signInWithMagicLink, signOut, sync }}>
      {children}
    </AuthContext.Provider>
  );
}
