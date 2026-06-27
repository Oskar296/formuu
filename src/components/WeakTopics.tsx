'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TOPICS } from '@/lib/types';
import { getWeakTopics } from '@/lib/progress';

export default function WeakTopics() {
  const [weak, setWeak] = useState<ReturnType<typeof getWeakTopics>>([]);

  useEffect(() => {
    setWeak(getWeakTopics());
  }, []);

  if (weak.length === 0) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5">
      <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3">Focus areas</p>
      <p className="text-sm text-amber-800/70 mb-4">
        These topics need more practice based on your quiz scores
      </p>
      <div className="flex flex-wrap gap-2">
        {weak.slice(0, 4).map(w => {
          const topic = TOPICS.find(t => t.slug === w.topicSlug);
          if (!topic) return null;
          return (
            <Link
              key={w.topicSlug}
              href={`/quizzes/${w.topicSlug}`}
              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2 hover:border-accent/30 transition-colors group"
            >
              <span
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded text-xs font-bold"
                style={{ backgroundColor: topic.color + '12', color: topic.color }}
              >
                {topic.icon}
              </span>
              <div>
                <p className="text-xs font-medium text-foreground group-hover:text-accent transition-colors">{topic.name}</p>
                <p className="text-[10px] text-muted">avg {w.avgScore}% · {w.attempts} quiz{w.attempts !== 1 ? 'zes' : ''}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
