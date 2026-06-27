'use client';

import { useState, useEffect } from 'react';
import { getStreak } from '@/lib/progress';

export default function StreakBadge() {
  const [streak, setStreak] = useState<{ current: number; longest: number; practicedToday: boolean } | null>(null);

  useEffect(() => {
    setStreak(getStreak());
  }, []);

  if (!streak || (streak.current === 0 && streak.longest === 0)) return null;

  return (
    <div className="flex items-center justify-center gap-6 rounded-xl border border-border p-4 mb-4">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{streak.practicedToday ? '🔥' : '❄️'}</span>
        <div>
          <p className="text-lg font-bold text-foreground leading-tight">
            {streak.current} day{streak.current !== 1 ? 's' : ''}
          </p>
          <p className="text-[11px] text-muted">
            {streak.practicedToday ? 'Current streak' : 'Practice today to keep it!'}
          </p>
        </div>
      </div>
      {streak.longest > 1 && (
        <div className="text-center border-l border-border pl-6">
          <p className="text-sm font-semibold text-accent">{streak.longest}</p>
          <p className="text-[11px] text-muted">Best streak</p>
        </div>
      )}
    </div>
  );
}
