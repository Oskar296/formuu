'use client';

import { useState, useEffect } from 'react';
import { getXP, getLevelInfo, LEVELS } from '@/lib/gamification';

export default function XPBar() {
  const [info, setInfo] = useState<ReturnType<typeof getLevelInfo> | null>(null);

  useEffect(() => {
    const update = () => {
      const xpData = getXP();
      setInfo(getLevelInfo(xpData.totalXP));
    };
    update();
    // Listen for XP updates
    window.addEventListener('formu-xp-update', update);
    return () => window.removeEventListener('formu-xp-update', update);
  }, []);

  if (!info) return null;

  return (
    <div className="flex items-center gap-2 group relative">
      <span className="text-sm" title={`Level ${info.level}: ${info.name}`}>
        {info.icon}
      </span>
      <div className="w-16 h-1.5 rounded-full bg-surface overflow-hidden">
        <div
          className="h-full rounded-full bg-accent transition-all duration-500"
          style={{ width: `${info.progress * 100}%` }}
        />
      </div>
      <span className="text-[10px] font-bold text-muted tabular-nums">
        {info.level}
      </span>

      {/* Tooltip on hover */}
      <div className="absolute top-full right-0 mt-2 w-48 rounded-lg bg-white shadow-lg border border-border p-3 opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-opacity z-50">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">{info.icon}</span>
          <div>
            <p className="text-xs font-bold text-foreground">Level {info.level} · {info.name}</p>
            <p className="text-[10px] text-muted">{info.totalXP} XP total</p>
          </div>
        </div>
        {!info.isMaxLevel && (
          <>
            <div className="h-1.5 rounded-full bg-surface overflow-hidden mb-1">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: `${info.progress * 100}%` }}
              />
            </div>
            <p className="text-[10px] text-muted text-right">
              {info.xpIntoLevel} / {info.xpForNextLevel} XP to Level {info.level + 1}
            </p>
          </>
        )}
        {info.isMaxLevel && (
          <p className="text-[10px] text-accent font-medium">Max level reached! 🏆</p>
        )}
      </div>
    </div>
  );
}
