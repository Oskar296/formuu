'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { TOPICS, Question, DIFFICULTY_LABELS } from '@/lib/types';
import { questions } from '@/lib/questions';
import MathDisplay from '@/components/Math';
import { recordPractice, getStreak } from '@/lib/progress';
import {
  getDueQuestionIds,
  getReviewStats,
  recordReview,
  incrementReviewCount,
  getReviewCount,
  ReviewGrade,
} from '@/lib/review';
import {
  addXP,
  XP_REWARDS,
  checkAndUnlockAchievements,
  ACHIEVEMENTS,
} from '@/lib/gamification';
import Confetti, { XPToast, AchievementToast } from '@/components/Confetti';

const byId = new Map(questions.map((q) => [q.id, q]));

function formatNextDue(dateStr: string | null): string {
  if (!dateStr) return '';
  const [y, m, d] = dateStr.split('-').map(Number);
  const target = new Date(y, m - 1, d);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffDays = globalThis.Math.round((target.getTime() - today.getTime()) / 86400000);
  if (diffDays <= 0) return 'today';
  if (diffDays === 1) return 'tomorrow';
  if (diffDays < 7) return `in ${diffDays} days`;
  return target.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export default function ReviewPage() {
  const [mounted, setMounted] = useState(false);
  const [deck, setDeck] = useState<Question[]>([]);
  const [index, setIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [finished, setFinished] = useState(false);
  const [tally, setTally] = useState({ got: 0, almost: 0, forgot: 0 });
  const [stats, setStats] = useState<ReturnType<typeof getReviewStats> | null>(null);
  const [saved, setSaved] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [xpToast, setXPToast] = useState<{ amount: number; reason: string } | null>(null);
  const [achievementToast, setAchievementToast] = useState<{ name: string; icon: string } | null>(null);

  // Build the session deck once on mount, from whatever is due today.
  useEffect(() => {
    const dueIds = getDueQuestionIds();
    const dueQs = dueIds.map((id) => byId.get(id)).filter((q): q is Question => Boolean(q));
    setDeck(dueQs);
    setStats(getReviewStats());
    setMounted(true);
  }, []);

  const total = deck.length;
  const current = deck[index];

  const grade = useCallback(
    (g: ReviewGrade) => {
      if (!current) return;
      recordReview(current.id, g);
      incrementReviewCount(1);
      recordPractice();
      setTally((t) => ({ ...t, [g]: t[g] + 1 }));

      addXP(XP_REWARDS.reviewCard, 'Question reviewed');
      window.dispatchEvent(new Event('formu-xp-update'));

      if (index + 1 >= deck.length) {
        setFinished(true);
      } else {
        setIndex((i) => i + 1);
        setShowAnswer(false);
      }
    },
    [current, index, deck.length],
  );

  // Keyboard: Space to reveal, then 1/2/3 to grade.
  useEffect(() => {
    if (!mounted || finished || deck.length === 0) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (!showAnswer) {
        if (e.code === 'Space') {
          e.preventDefault();
          setShowAnswer(true);
        }
        return;
      }
      if (e.key === '1') {
        e.preventDefault();
        grade('forgot');
      } else if (e.key === '2') {
        e.preventDefault();
        grade('almost');
      } else if (e.key === '3') {
        e.preventDefault();
        grade('got');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [mounted, finished, showAnswer, grade, deck.length]);

  // Award the session bonus + check achievements once, when the deck is cleared.
  useEffect(() => {
    if (!finished || saved) return;

    const bonus = XP_REWARDS.reviewSession;
    addXP(bonus, 'Review session complete');
    window.dispatchEvent(new Event('formu-xp-update'));
    setXPToast({ amount: bonus, reason: 'Review session complete' });
    setTimeout(() => setXPToast(null), 3500);
    setShowConfetti(true);

    const freshStats = getReviewStats();
    setStats(freshStats);
    const streak = getStreak();

    const newAchievements = checkAndUnlockAchievements({
      currentStreak: streak.current,
      isFirstReview: true,
      reviewsCompleted: getReviewCount(),
      questionsMastered: freshStats.mastered,
    });

    if (newAchievements.length > 0) {
      const ach = ACHIEVEMENTS.find((a) => a.id === newAchievements[0]);
      if (ach) {
        setTimeout(() => {
          setAchievementToast({ name: ach.name, icon: ach.icon });
          setTimeout(() => setAchievementToast(null), 4000);
        }, 1500);
      }
    }

    setSaved(true);
  }, [finished, saved]);

  if (!mounted) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16">
        <p className="text-muted">Loading…</p>
      </div>
    );
  }

  // ── Empty state: nothing due ──
  if (deck.length === 0 && !finished) {
    return <EmptyState stats={stats} />;
  }

  // ── Completion screen ──
  if (finished) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <Confetti trigger={showConfetti} />
        {xpToast && <XPToast amount={xpToast.amount} reason={xpToast.reason} visible />}
        {achievementToast && <AchievementToast name={achievementToast.name} icon={achievementToast.icon} visible />}

        <div className="text-5xl mb-4 animate-count-up">🎉</div>
        <h1 className="text-2xl font-bold mb-2">Review complete!</h1>
        <p className="text-muted mb-8 text-sm">
          You reviewed {total} question{total !== 1 ? 's' : ''} today. Spaced practice is how it sticks.
        </p>

        <div className="flex justify-center gap-3 mb-8">
          <Tally label="Got it" value={tally.got} color="#00b894" />
          <Tally label="Almost" value={tally.almost} color="#fdcb6e" />
          <Tally label="Forgot" value={tally.forgot} color="#e17055" />
        </div>

        {stats && (
          <p className="text-xs text-muted mb-8">
            {stats.mastered} mastered · {stats.learning} still learning
            {stats.nextDue && ` · next review ${formatNextDue(stats.nextDue)}`}
          </p>
        )}

        <div className="flex justify-center gap-3">
          <Link
            href="/"
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
          >
            Done
          </Link>
          <Link
            href="/quizzes"
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-surface transition-colors"
          >
            Take a quiz
          </Link>
        </div>
      </div>
    );
  }

  // ── Active review session ──
  const topic = TOPICS.find((t) => t.slug === current.topic);

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted font-medium">
            🔁 Review · {index + 1} / {total}
          </span>
          <Link href="/" className="text-muted/60 hover:text-accent transition-colors">
            End session
          </Link>
        </div>
        <div className="h-1 rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${(index / total) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-5">
          {topic && (
            <span
              className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
              style={{ backgroundColor: topic.color + '12', color: topic.color }}
            >
              {topic.name}
            </span>
          )}
          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold diff-${current.difficulty}`}>
            {DIFFICULTY_LABELS[current.difficulty]}
          </span>
          <span className="text-xs text-muted">{current.subtopic}</span>
          <span className="ml-auto text-xs text-muted">{current.marks} marks</span>
        </div>

        <div className="text-base leading-[1.8] mb-8">
          <MathDisplay text={current.body} className="text-foreground" />
        </div>

        {!showAnswer ? (
          <div>
            <button
              onClick={() => setShowAnswer(true)}
              className="rounded-lg bg-accent px-5 py-2 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
            >
              Reveal answer
            </button>
            <span className="text-[11px] text-muted/50 ml-3">
              or press <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">Space</kbd>
            </span>
          </div>
        ) : (
          <div>
            <div className="mb-5 rounded-lg bg-emerald-50/50 border border-emerald-100 p-5">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3">Mark Scheme</p>
              <MathDisplay text={current.markScheme} className="text-sm text-foreground/75 leading-relaxed" />
            </div>
            <div className="mb-6 rounded-lg bg-accent-light/50 border border-accent/10 p-5">
              <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3">Worked Solution</p>
              <MathDisplay text={current.workedSolution} className="text-sm text-foreground/75 leading-relaxed" />
            </div>

            <p className="text-xs text-muted mb-2 font-medium">How well did you recall this?</p>
            <div className="grid grid-cols-3 gap-2">
              <GradeButton
                onClick={() => grade('forgot')}
                label="Forgot"
                sub="see again tomorrow"
                kbd="1"
                className="border-red-200 bg-red-50 text-red-600 hover:bg-red-100"
              />
              <GradeButton
                onClick={() => grade('almost')}
                label="Almost"
                sub="repeat soon"
                kbd="2"
                className="border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100"
              />
              <GradeButton
                onClick={() => grade('got')}
                label="Got it"
                sub="push it back"
                kbd="3"
                className="border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GradeButton({
  onClick,
  label,
  sub,
  kbd,
  className,
}: {
  onClick: () => void;
  label: string;
  sub: string;
  kbd: string;
  className: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center justify-center rounded-lg border py-3 transition-all hover:scale-[1.02] ${className}`}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-[10px] opacity-70 mt-0.5">{sub}</span>
      <kbd className="mt-1.5 px-1.5 py-0.5 rounded bg-white/60 border border-current/20 font-mono text-[10px]">{kbd}</kbd>
    </button>
  );
}

function Tally({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="text-center">
      <div className="text-2xl font-bold" style={{ color }}>
        {value}
      </div>
      <div className="text-[11px] text-muted">{label}</div>
    </div>
  );
}

function EmptyState({ stats }: { stats: ReturnType<typeof getReviewStats> | null }) {
  const hasDeck = stats && stats.total > 0;
  return (
    <div className="mx-auto max-w-lg px-6 py-20 text-center">
      <div className="text-5xl mb-4">{hasDeck ? '✅' : '🔁'}</div>
      <h1 className="text-2xl font-bold mb-2">
        {hasDeck ? 'All caught up!' : 'Smart Review'}
      </h1>

      {hasDeck ? (
        <>
          <p className="text-muted mb-8 text-sm">
            Nothing due right now. Your weakest questions automatically come back when it&apos;s time to
            review them.
          </p>
          <div className="flex justify-center gap-6 mb-8">
            <Tally label="In review" value={stats!.total} color="var(--accent)" />
            <Tally label="Mastered" value={stats!.mastered} color="#00b894" />
            <Tally label="Learning" value={stats!.learning} color="#fdcb6e" />
          </div>
          {stats!.nextDue && (
            <p className="text-xs text-muted mb-8">Next review {formatNextDue(stats!.nextDue)}.</p>
          )}
        </>
      ) : (
        <p className="text-muted mb-8 text-sm">
          Take a quiz and your questions are scheduled for spaced review here — the proven way to make
          revision actually stick. Weak questions come back often; mastered ones fade away.
        </p>
      )}

      <div className="flex justify-center gap-3">
        <Link
          href="/quizzes"
          className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          {hasDeck ? 'Practice more' : 'Start a quiz'}
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-surface transition-colors"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
