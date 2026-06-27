'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';

export default function AuthCallbackPage() {
  const router = useRouter();
  const [error, setError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setError('Supabase is not configured');
      return;
    }

    // Supabase handles the token exchange from the URL hash automatically
    // Just wait for the session to be established then redirect home
    const handleCallback = async () => {
      const { error } = await supabase!.auth.getSession();
      if (error) {
        setError(error.message);
      } else {
        router.replace('/');
      }
    };

    handleCallback();
  }, [router]);

  if (error) {
    return (
      <div className="mx-auto max-w-sm px-6 py-20 text-center">
        <p className="text-sm text-red-600 mb-4">Sign in failed: {error}</p>
        <a href="/" className="text-sm text-accent hover:underline">Go home</a>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-6 py-20 text-center">
      <div className="h-6 w-6 mx-auto mb-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      <p className="text-sm text-muted">Signing you in…</p>
    </div>
  );
}
