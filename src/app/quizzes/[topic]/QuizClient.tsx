'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { TOPICS, Topic, DIFFICULTY_LABELS } from '@/lib/types';
import { questions } from '@/lib/questions';
import MathDisplay from '@/components/Math';
import { addQuizResult, recordPractice, markQuestionViewed, getQuizResults, getViewedQuestionIds, getStreak, getTotalStats, getBookmarkedIds } from '@/lib/progress';
import { addXP, XP_REWARDS, checkAndUnlockAchievements, ACHIEVEMENTS, getMotivationalMessage } from '@/lib/gamification';
import { recordReview, gradeFromMarks } from '@/lib/review';
import Confetti, { XPToast, AchievementToast } from '@/components/Confetti';

function shuffleArray<T>(arr: T[]): T[] {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = globalThis.Math.floor(globalThis.Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export default function QuizClient({ topicSlug }: { topicSlug: Topic }) {
  const topic = TOPICS.find((t) => t.slug === topicSlug);

  const quizQuestions = useMemo(() => {
    const topicQs = questions.filter((q) => q.topic === topicSlug);
    return shuffleArray(topicQs).slice(0, 15);
  }, [topicSlug]);

  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [perQuestion, setPerQuestion] = useState<{ earned: number; marks: number }[]>([]);
  const [finished, setFinished] = useState(false);
  const [timed, setTimed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null);
  const [saved, setSaved] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [xpToast, setXPToast] = useState<{ amount: number; reason: string } | null>(null);
  const [achievementToast, setAchievementToast] = useState<{ name: string; icon: string } | null>(null);

  const totalEarned = perQuestion.reduce((s, p) => s + p.earned, 0);

  const startQuiz = useCallback((useTimed: boolean) => {
    setTimed(useTimed);
    setStarted(true);
    setCurrentIndex(0);
    setShowAnswer(false);
    setPerQuestion([]);
    setFinished(false);
    setSaved(false);
    setShowConfetti(false);
    recordPractice();
    if (useTimed) {
      const totalSeconds = quizQuestions.length * 90;
      setTimeLeft(totalSeconds);
      const interval = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(interval);
            setFinished(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      setTimerRef(interval);
    }
  }, [quizQuestions.length]);

  const submitMarks = useCallback((earned: number) => {
    const current = quizQuestions[currentIndex];
    const clamped = globalThis.Math.max(0, globalThis.Math.min(earned, current.marks));
    setPerQuestion((prev) => [...prev, { earned: clamped, marks: current.marks }]);
    markQuestionViewed(current.id);
    // Seed the spaced-repetition deck from how well this question went.
    recordReview(current.id, gradeFromMarks(clamped, current.marks));

    // XP for viewing question
    addXP(XP_REWARDS.questionViewed, 'Question practiced');
    window.dispatchEvent(new Event('formu-xp-update'));

    if (currentIndex + 1 >= quizQuestions.length) {
      setFinished(true);
      if (timerRef) clearInterval(timerRef);
    } else {
      setCurrentIndex((i) => i + 1);
      setShowAnswer(false);
    }
  }, [currentIndex, quizQuestions, timerRef]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!started || finished) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' && !showAnswer) {
        e.preventDefault();
        setShowAnswer(true);
      } else if (showAnswer) {
        const current = quizQuestions[currentIndex];
        // Number keys for quick marks
        const num = parseInt(e.key, 10);
        if (!isNaN(num) && num >= 0 && num <= current.marks) {
          e.preventDefault();
          submitMarks(num);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [started, finished, showAnswer, submitMarks, currentIndex, quizQuestions]);

  // Save result + gamification when quiz finishes
  useEffect(() => {
    if (finished && !saved && perQuestion.length > 0) {
      const earned = perQuestion.reduce((s, p) => s + p.earned, 0);
      const total = perQuestion.reduce((s, p) => s + p.marks, 0);
      const pct = total > 0 ? globalThis.Math.round((earned / total) * 100) : 0;

      addQuizResult({
        topicSlug: topicSlug,
        score: earned,
        total: total,
        percentage: pct,
        date: new Date().toLocaleDateString(),
      });

      // XP rewards
      let xpGained = XP_REWARDS.quizCompleted;
      let reason = 'Quiz completed';
      if (pct === 100) {
        xpGained += XP_REWARDS.quizPerfect;
        reason = 'Perfect quiz! 💯';
        setShowConfetti(true);
      } else if (pct >= 80) {
        xpGained += XP_REWARDS.quizGoodScore;
        reason = 'Great quiz score!';
      }
      if (pct >= 70) {
        setShowConfetti(true);
      }

      const xpResult = addXP(xpGained, reason);
      window.dispatchEvent(new Event('formu-xp-update'));
      setXPToast({ amount: xpGained, reason });
      setTimeout(() => setXPToast(null), 3500);

      // Check achievements
      const stats = getTotalStats();
      const streak = getStreak();
      const viewed = getViewedQuestionIds();
      const allResults = getQuizResults();
      const bookmarks = getBookmarkedIds();

      const newAchievements = checkAndUnlockAchievements({
        questionsViewed: viewed.length,
        quizzesCompleted: allResults.length,
        topicsAttempted: stats.topicsAttempted,
        currentStreak: streak.current,
        bookmarkCount: bookmarks.length,
        level: xpResult.newLevel,
        isPerfectQuiz: pct === 100,
        isFirstQuiz: allResults.length === 1,
        isTimedQuizWithTimeLeft: timed && timeLeft > 0,
      });

      if (newAchievements.length > 0) {
        const ach = ACHIEVEMENTS.find(a => a.id === newAchievements[0]);
        if (ach) {
          setTimeout(() => {
            setAchievementToast({ name: ach.name, icon: ach.icon });
            setTimeout(() => setAchievementToast(null), 4000);
          }, 1500);
        }
      }

      setSaved(true);
    }
  }, [finished, saved, perQuestion, topicSlug, timed, timeLeft]);

  if (!topic) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <p className="text-muted">Topic not found.</p>
        <Link href="/quizzes" className="text-accent hover:underline mt-2 inline-block text-sm">Back to quizzes</Link>
      </div>
    );
  }

  if (!started) {
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <Link href="/quizzes" className="text-sm text-muted hover:text-accent mb-8 inline-block">&larr; All quizzes</Link>
        <div
          className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl text-2xl font-bold mb-5"
          style={{ backgroundColor: topic.color + '12', color: topic.color }}
        >
          {topic.icon}
        </div>
        <h1 className="text-2xl font-bold mb-2">{topic.name}</h1>
        <p className="text-muted mb-8 text-sm">{quizQuestions.length} questions · self-marked</p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => startQuiz(false)}
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
          >
            Start
          </button>
          <button
            onClick={() => startQuiz(true)}
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-surface transition-colors"
          >
            Timed
          </button>
        </div>
      </div>
    );
  }

  if (finished) {
    const earned = perQuestion.reduce((s, p) => s + p.earned, 0);
    const total = perQuestion.reduce((s, p) => s + p.marks, 0);
    const pct = total > 0 ? globalThis.Math.round((earned / total) * 100) : 0;
    const msg = getMotivationalMessage(pct);
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <Confetti trigger={showConfetti} />
        {xpToast && <XPToast amount={xpToast.amount} reason={xpToast.reason} visible />}
        {achievementToast && <AchievementToast name={achievementToast.name} icon={achievementToast.icon} visible />}

        <p className="text-sm text-muted mb-6">Quiz complete</p>
        <div
          className="text-6xl font-bold mb-2 animate-count-up"
          style={{ color: pct >= 70 ? '#00b894' : pct >= 40 ? '#fdcb6e' : '#e17055' }}
        >
          {pct}%
        </div>
        <p className="text-muted mb-3">{earned} / {total} marks</p>
        <p className="text-base font-medium mb-8">
          <span className="mr-1">{msg.emoji}</span> {msg.message}
        </p>

        {/* Per-question breakdown */}
        <div className="flex justify-center gap-1 mb-8 flex-wrap">
          {perQuestion.map((p, i) => (
            <div
              key={i}
              className="h-2 w-6 rounded-full"
              style={{
                backgroundColor: p.earned === p.marks ? '#00b894' : p.earned > 0 ? '#fdcb6e' : '#e17055',
              }}
              title={`Q${i + 1}: ${p.earned}/${p.marks}`}
            />
          ))}
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => { setStarted(false); }}
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
          >
            Try again
          </button>
          <Link
            href="/quizzes"
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-surface transition-colors"
          >
            All quizzes
          </Link>
        </div>
      </div>
    );
  }

  const current = quizQuestions[currentIndex];
  const formatTime = (s: number) => `${globalThis.Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted font-medium">
            {currentIndex + 1} / {quizQuestions.length}
          </span>
          <div className="flex items-center gap-3">
            <span className="font-medium text-accent">{totalEarned} marks</span>
            {timed && <span className="font-mono text-foreground">{formatTime(timeLeft)}</span>}
          </div>
        </div>
        <div className="h-1 rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${((currentIndex + 1) / quizQuestions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div>
        <div className="flex items-center gap-2 mb-5">
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
            <span className="text-[11px] text-muted/50 ml-3">or press <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">Space</kbd></span>
          </div>
        ) : (
          <div>
            <div className="mb-5 rounded-lg bg-emerald-50/50 border border-emerald-100 p-5">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3">Mark Scheme</p>
              <MathDisplay text={current.markScheme} className="text-sm text-foreground/75 leading-relaxed" />
            </div>
            <div className="mb-5 rounded-lg bg-accent-light/50 border border-accent/10 p-5">
              <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3">Worked Solution</p>
              <MathDisplay text={current.workedSolution} className="text-sm text-foreground/75 leading-relaxed" />
            </div>

            <p className="text-xs text-muted mb-2 font-medium">How many marks did you earn?</p>
            <div className="flex gap-1.5 items-center flex-wrap">
              {Array.from({ length: current.marks + 1 }, (_, i) => i).map((m) => (
                <button
                  key={m}
                  onClick={() => submitMarks(m)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition-all hover:scale-105 ${
                    m === 0
                      ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
                      : m === current.marks
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                      : 'border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100'
                  }`}
                >
                  {m}
                </button>
              ))}
              <span className="text-xs text-muted ml-1">/ {current.marks}</span>
              <span className="text-[10px] text-muted/40 ml-2">
                or press <kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">0</kbd>-<kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">{current.marks}</kbd>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
