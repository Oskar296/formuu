'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { TOPICS } from '@/lib/types';
import { questions } from '@/lib/questions';
import { getTotalStats, getQuizResults, getTopicBestScore, getTopicAttemptCount, getViewedQuestionIds, getStreak, getBookmarkedIds, getWeakTopics, clearProgress } from '@/lib/progress';
import { getXP, getLevelInfo, getUnlockedAchievements, ACHIEVEMENTS } from '@/lib/gamification';
import { getReviewStats, clearReview } from '@/lib/review';

export default function ProgressPage() {
  const [stats, setStats] = useState({ totalQuizzes: 0, avgScore: 0, questionsViewed: 0, topicsAttempted: 0 });
  const [results, setResults] = useState<ReturnType<typeof getQuizResults>>([]);
  const [viewedIds, setViewedIds] = useState<string[]>([]);
  const [streak, setStreak] = useState({ current: 0, longest: 0, practicedToday: false });
  const [bookmarkCount, setBookmarkCount] = useState(0);
  const [weak, setWeak] = useState<ReturnType<typeof getWeakTopics>>([]);
  const [mounted, setMounted] = useState(false);
  const [levelInfo, setLevelInfo] = useState<ReturnType<typeof getLevelInfo> | null>(null);
  const [weeklyXP, setWeeklyXP] = useState(0);
  const [unlockedAchievements, setUnlockedAchievements] = useState<string[]>([]);
  const [reviewStats, setReviewStats] = useState<ReturnType<typeof getReviewStats> | null>(null);

  useEffect(() => {
    setStats(getTotalStats());
    setResults(getQuizResults());
    setViewedIds(getViewedQuestionIds());
    setStreak(getStreak());
    setBookmarkCount(getBookmarkedIds().length);
    setWeak(getWeakTopics());
    const xpData = getXP();
    setLevelInfo(getLevelInfo(xpData.totalXP));
    setWeeklyXP(xpData.weeklyXP);
    setUnlockedAchievements(getUnlockedAchievements());
    setReviewStats(getReviewStats());
    setMounted(true);
  }, []);

  if (!mounted) {
    return <div className="mx-auto max-w-4xl px-6 py-10"><p className="text-muted">Loading...</p></div>;
  }

  const recentResults = [...results].reverse().slice(0, 10);

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <div className="mb-10">
        <h1 className="text-2xl font-bold tracking-tight mb-1">Your Progress</h1>
        <p className="text-sm text-muted">Track your revision across all topics · stored locally</p>
      </div>

      {/* Streak */}
      {(streak.current > 0 || streak.longest > 0) && (
        <div className="flex items-center gap-6 rounded-xl border border-border p-5 mb-6">
          <div className="flex items-center gap-3">
            <span className="text-3xl">{streak.practicedToday ? '🔥' : '❄️'}</span>
            <div>
              <p className="text-2xl font-bold text-foreground leading-tight">
                {streak.current} day{streak.current !== 1 ? 's' : ''}
              </p>
              <p className="text-xs text-muted">
                {streak.practicedToday ? 'Current streak — keep it going!' : 'Streak paused — practice today!'}
              </p>
            </div>
          </div>
          {streak.longest > 1 && (
            <div className="text-center border-l border-border pl-6">
              <p className="text-lg font-bold text-accent">{streak.longest}</p>
              <p className="text-[11px] text-muted">Best streak</p>
            </div>
          )}
        </div>
      )}

      {/* XP & Level */}
      {levelInfo && levelInfo.totalXP > 0 && (
        <div className="rounded-xl border border-accent/20 bg-gradient-to-r from-accent/5 to-accent/10 p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <span className="text-3xl">{levelInfo.icon}</span>
              <div>
                <p className="text-lg font-bold text-foreground">Level {levelInfo.level} · {levelInfo.name}</p>
                <p className="text-xs text-muted">{levelInfo.totalXP} XP total · {weeklyXP} XP this week</p>
              </div>
            </div>
            {!levelInfo.isMaxLevel && (
              <p className="text-sm text-accent font-medium">
                {levelInfo.xpForNextLevel - levelInfo.xpIntoLevel} XP to Level {levelInfo.level + 1}
              </p>
            )}
          </div>
          <div className="h-2.5 rounded-full bg-white/60 overflow-hidden">
            <div className="h-full rounded-full bg-accent transition-all duration-700" style={{ width: `${levelInfo.progress * 100}%` }} />
          </div>
        </div>
      )}

      {/* Spaced-repetition review */}
      {reviewStats && reviewStats.total > 0 && (
        <div className="rounded-xl border border-border p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-bold text-muted uppercase tracking-widest">Smart Review</p>
            <Link href="/review" className="text-xs text-accent hover:underline">
              {reviewStats.due > 0 ? `Review ${reviewStats.due} due →` : 'Open review →'}
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-px bg-border rounded-lg overflow-hidden border border-border">
            <div className="bg-white p-4">
              <span className="text-2xl font-bold" style={{ color: reviewStats.due > 0 ? 'var(--accent)' : 'var(--muted)' }}>
                {reviewStats.due}
              </span>
              <p className="text-[11px] text-muted mt-1">Due now</p>
            </div>
            <div className="bg-white p-4">
              <span className="text-2xl font-bold text-emerald-600">{reviewStats.mastered}</span>
              <p className="text-[11px] text-muted mt-1">Mastered</p>
            </div>
            <div className="bg-white p-4">
              <span className="text-2xl font-bold text-amber-500">{reviewStats.learning}</span>
              <p className="text-[11px] text-muted mt-1">Learning</p>
            </div>
            <div className="bg-white p-4">
              <span className="text-2xl font-bold text-foreground">{reviewStats.total}</span>
              <p className="text-[11px] text-muted mt-1">In rotation</p>
            </div>
          </div>
        </div>
      )}

      {/* Achievements */}
      {unlockedAchievements.length > 0 && (
        <div className="rounded-xl border border-border p-5 mb-6">
          <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">
            Achievements · {unlockedAchievements.length}/{ACHIEVEMENTS.filter(a => !a.secret).length + unlockedAchievements.filter(id => ACHIEVEMENTS.find(a => a.id === id)?.secret).length}
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
            {ACHIEVEMENTS.map((ach) => {
              const unlocked = unlockedAchievements.includes(ach.id);
              if (ach.secret && !unlocked) return null;
              return (
                <div
                  key={ach.id}
                  className={`rounded-lg border p-3 text-center transition-all ${
                    unlocked
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-border bg-surface/50 opacity-40'
                  }`}
                >
                  <span className="text-2xl block mb-1">{unlocked ? ach.icon : '🔒'}</span>
                  <p className="text-xs font-semibold truncate">{ach.name}</p>
                  <p className="text-[10px] text-muted">{ach.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Stats overview */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-px bg-border rounded-xl overflow-hidden border border-border mb-10">
        <div className="bg-white p-5">
          <span className="text-3xl font-bold text-accent">{stats.totalQuizzes}</span>
          <p className="text-xs text-muted mt-1">Quizzes taken</p>
        </div>
        <div className="bg-white p-5">
          <span className="text-3xl font-bold text-accent">{stats.avgScore}%</span>
          <p className="text-xs text-muted mt-1">Average score</p>
        </div>
        <div className="bg-white p-5">
          <span className="text-3xl font-bold text-accent">{stats.questionsViewed}</span>
          <p className="text-xs text-muted mt-1">Questions seen</p>
        </div>
        <div className="bg-white p-5">
          <span className="text-3xl font-bold text-accent">{stats.topicsAttempted}/10</span>
          <p className="text-xs text-muted mt-1">Topics covered</p>
        </div>
        <div className="bg-white p-5">
          <span className="text-3xl font-bold text-amber-500">{bookmarkCount}</span>
          <p className="text-xs text-muted mt-1">
            <Link href="/questions?bookmarked=1" className="hover:text-accent transition-colors">
              Saved questions →
            </Link>
          </p>
        </div>
      </div>

      {/* Weak topics */}
      {weak.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-5 mb-10">
          <p className="text-xs font-bold text-amber-700 uppercase tracking-widest mb-3">Needs work</p>
          <div className="space-y-2">
            {weak.map(w => {
              const topic = TOPICS.find(t => t.slug === w.topicSlug);
              if (!topic) return null;
              return (
                <div key={w.topicSlug} className="flex items-center gap-3">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                    style={{ backgroundColor: topic.color + '12', color: topic.color }}
                  >
                    {topic.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{topic.name}</p>
                    <p className="text-[11px] text-muted">{w.attempts} quiz{w.attempts !== 1 ? 'zes' : ''} · avg {w.avgScore}%</p>
                  </div>
                  <div className="flex-1 h-2 rounded-full bg-amber-100">
                    <div className="h-full rounded-full bg-amber-400" style={{ width: `${w.avgScore}%` }} />
                  </div>
                  <Link
                    href={`/quizzes/${w.topicSlug}`}
                    className="text-xs text-accent hover:underline shrink-0"
                  >
                    Practice →
                  </Link>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Per-topic progress */}
      <div className="mb-10">
        <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">Topic progress</h2>
        <div className="space-y-2">
          {TOPICS.map(topic => {
            const topicQuestionCount = questions.filter(q => q.topic === topic.slug).length;
            const viewedCount = viewedIds.filter(id => {
              const q = questions.find(q => q.id === id);
              return q?.topic === topic.slug;
            }).length;
            const best = getTopicBestScore(topic.slug);
            const attempts = getTopicAttemptCount(topic.slug);
            const coverage = topicQuestionCount > 0 ? globalThis.Math.round((viewedCount / topicQuestionCount) * 100) : 0;

            return (
              <div key={topic.slug} className="rounded-lg border border-border p-4">
                <div className="flex items-center gap-3 mb-2">
                  <span
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-xs font-bold"
                    style={{ backgroundColor: topic.color + '12', color: topic.color }}
                  >
                    {topic.icon}
                  </span>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-medium truncate">{topic.name}</h3>
                    <p className="text-[11px] text-muted">
                      {attempts > 0 ? `${attempts} quiz${attempts > 1 ? 'zes' : ''} · best: ${best}%` : 'Not attempted yet'}
                      {' · '}{viewedCount}/{topicQuestionCount} questions seen
                    </p>
                  </div>
                  <Link
                    href={`/quizzes/${topic.slug}`}
                    className="text-xs text-accent hover:underline shrink-0"
                  >
                    {attempts > 0 ? 'Retry' : 'Start'} &rarr;
                  </Link>
                </div>
                <div className="h-1.5 rounded-full bg-surface">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${coverage}%`,
                      backgroundColor: topic.color,
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent quiz results */}
      {recentResults.length > 0 && (
        <div className="mb-10">
          <h2 className="text-xs font-bold text-muted uppercase tracking-widest mb-4">Recent quizzes</h2>
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface text-left">
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted">Topic</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted">Score</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-muted text-right">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentResults.map((r, i) => {
                  const topic = TOPICS.find(t => t.slug === r.topicSlug);
                  return (
                    <tr key={i} className="border-b border-border last:border-b-0">
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium" style={{ color: topic?.color }}>{topic?.name || r.topicSlug}</span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-sm font-semibold ${r.percentage >= 70 ? 'text-emerald-600' : r.percentage >= 40 ? 'text-amber-600' : 'text-red-600'}`}>
                          {r.percentage}%
                        </span>
                        <span className="text-xs text-muted ml-1">({r.score}/{r.total})</span>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted text-right">{r.date}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {stats.totalQuizzes === 0 && (
        <div className="text-center py-12 rounded-lg bg-surface">
          <p className="text-base font-medium mb-1">No progress yet</p>
          <p className="text-sm text-muted mb-6">Take a quiz or browse questions to start tracking</p>
          <div className="flex justify-center gap-3">
            <Link href="/quizzes" className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors">
              Start a quiz
            </Link>
            <Link href="/random" className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-surface transition-colors">
              🎲 Random question
            </Link>
          </div>
        </div>
      )}

      {/* Reset */}
      {stats.totalQuizzes > 0 && (
        <div className="text-center">
          <button
            onClick={() => {
              if (confirm('Reset all progress? This cannot be undone.')) {
                clearProgress();
                clearReview();
                setStats(getTotalStats());
                setResults([]);
                setViewedIds([]);
                setStreak({ current: 0, longest: 0, practicedToday: false });
                setBookmarkCount(0);
                setWeak([]);
                setReviewStats(getReviewStats());
              }
            }}
            className="text-xs text-muted hover:text-red-500 transition-colors"
          >
            Reset all progress
          </button>
        </div>
      )}
    </div>
  );
}
