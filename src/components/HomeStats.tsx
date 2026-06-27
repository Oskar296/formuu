'use client';

import { useState, useEffect } from 'react';

import Link from 'next/link';
import { getXP, getLevelInfo, LEVELS, getUnlockedAchievements, ACHIEVEMENTS } from '@/lib/gamification';
import { getTotalStats, getStreak } from '@/lib/progress';

export default function HomeStats() {
  const [mounted, setMounted] = useState(false);
  const [levelInfo, setLevelInfo] = useState<ReturnType<typeof getLevelInfo> | null>(null);
  const [weeklyXP, setWeeklyXP] = useState(0);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [recentAchievements, setRecentAchievements] = useState<typeof ACHIEVEMENTS>([]);
  const [stats, setStats] = useState({ totalQuizzes: 0, avgScore: 0, questionsViewed: 0, topicsAttempted: 0 });

  useEffect(() => {
    const xpData = getXP();
    setLevelInfo(getLevelInfo(xpData.totalXP));
    setWeeklyXP(xpData.weeklyXP);
    const unlocked = getUnlockedAchievements();
    setUnlockedCount(unlocked.length);
    setRecentAchievements(
      unlocked.slice(-3).reverse().map(id => ACHIEVEMENTS.find(a => a.id === id)!).filter(Boolean)
    );
    setStats(getTotalStats());
    setMounted(true);
  }, []);

  if (!mounted || !levelInfo) return null;

  // Don't show if user hasn't started yet
  if (levelInfo.totalXP === 0 && stats.totalQuizzes === 0) return null;

  return (
    <div className="mb-4 rounded-xl border border-border overflow-hidden">
      {/* XP & Level bar */}
      <div className="bg-gradient-to-r from-accent/5 to-accent/10 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <span className="text-2xl">{levelInfo.icon}</span>
            <div>
              <p className="text-sm font-bold text-foreground">
                Level {levelInfo.level} · {levelInfo.name}
              </p>
              <p className="text-xs text-muted">
                {levelInfo.totalXP} XP total · {weeklyXP} XP this week
              </p>
            </div>
          </div>
          {!levelInfo.isMaxLevel && (
            <span className="text-xs text-accent font-medium">
              {levelInfo.xpForNextLevel - levelInfo.xpIntoLevel} XP to Level {levelInfo.level + 1}
            </span>
          )}
        </div>
        <div className="h-2 rounded-full bg-white/50 overflow-hidden">
          <div
            className="h-full rounded-full bg-accent transition-all duration-700"
            style={{ width: `${levelInfo.progress * 100}%` }}
          />
        </div>
      </div>

      {/* Quick stats + achievements */}
      <div className="flex items-center justify-between px-5 py-3 bg-white">
        <div className="flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-bold text-accent">{stats.totalQuizzes}</p>
            <p className="text-[10px] text-muted">Quizzes</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-accent">{stats.questionsViewed}</p>
            <p className="text-[10px] text-muted">Questions</p>
          </div>
          <div className="text-center">
            <p className="text-lg font-bold text-accent">{stats.avgScore}%</p>
            <p className="text-[10px] text-muted">Avg score</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {recentAchievements.length > 0 && (
            <div className="flex -space-x-1">
              {recentAchievements.map((a) => (
                <span
                  key={a.id}
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-50 border border-amber-200 text-sm"
                  title={a.name}
                >
                  {a.icon}
                </span>
              ))}
            </div>
          )}
          <Link
            href="/progress"
            className="text-[11px] text-accent hover:underline ml-1"
          >
            {unlockedCount}/{ACHIEVEMENTS.length} 🏆
          </Link>
        </div>
      </div>
    </div>
  );
}
