'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getDueCount } from '@/lib/review';

export default function ReviewPrompt() {
  const [mounted, setMounted] = useState(false);
  const [due, setDue] = useState(0);

  useEffect(() => {
    setDue(getDueCount());
    setMounted(true);
  }, []);

  if (!mounted || due === 0) return null;

  return (
    <Link
      href="/review"
      className="group mb-4 flex items-center gap-4 rounded-xl border border-accent/30 bg-gradient-to-r from-accent/10 to-accent/5 p-5 transition-all hover:border-accent/50 hover:shadow-sm animate-pulse-glow"
    >
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-accent/15 text-2xl">
        🔁
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-foreground">
          {due} question{due !== 1 ? 's' : ''} due for review
        </p>
        <p className="text-xs text-muted">
          A quick spaced-repetition session locks these into memory.
        </p>
      </div>
      <span className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white transition-colors group-hover:bg-accent-hover">
        Review now →
      </span>
    </Link>
  );
}
