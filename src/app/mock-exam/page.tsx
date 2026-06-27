'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { TOPICS, DIFFICULTY_LABELS, Difficulty } from '@/lib/types';
import { questions } from '@/lib/questions';
import MathDisplay from '@/components/Math';
import { addQuizResult, recordPractice, markQuestionViewed, getQuizResults, getViewedQuestionIds, getStreak, getTotalStats, getBookmarkedIds } from '@/lib/progress';
import { addXP, XP_REWARDS, checkAndUnlockAchievements, ACHIEVEMENTS, getMotivationalMessage, getXP } from '@/lib/gamification';
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

const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  foundation: 0,
  intermediate: 1,
  hard: 2,
  'exam-hard': 3,
};

type ExamType = 'paper1' | 'paper2' | 'mixed';

interface ExamConfig {
  type: ExamType;
  label: string;
  desc: string;
  questionCount: number;
  timeMinutes: number;
  totalMarks: string;
}

const EXAM_CONFIGS: ExamConfig[] = [
  { type: 'paper1', label: 'Paper 1 Style', desc: 'Short questions, broad coverage', questionCount: 12, timeMinutes: 60, totalMarks: '~50' },
  { type: 'paper2', label: 'Paper 2 Style', desc: 'Longer multi-part questions', questionCount: 8, timeMinutes: 60, totalMarks: '~50' },
  { type: 'mixed', label: 'Full Mixed', desc: 'All question types, all topics', questionCount: 15, timeMinutes: 90, totalMarks: '~70' },
];

export default function MockExamPage() {
  const [examType, setExamType] = useState<ExamType | null>(null);
  const [started, setStarted] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [score, setScore] = useState(0);
  const [answered, setAnswered] = useState(0);
  const [finished, setFinished] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerRef, setTimerRef] = useState<ReturnType<typeof setInterval> | null>(null);
  const [marksEarned, setMarksEarned] = useState(0);
  const [totalMarks, setTotalMarks] = useState(0);
  const [perQuestion, setPerQuestion] = useState<{ earned: number; marks: number; topic: string }[]>([]);
  const [resultsSaved, setResultsSaved] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [xpToast, setXPToast] = useState<{ amount: number; reason: string } | null>(null);
  const [achievementToast, setAchievementToast] = useState<{ name: string; icon: string } | null>(null);

  const examQuestions = useMemo(() => {
    if (!examType) return [];
    const config = EXAM_CONFIGS.find(c => c.type === examType)!;
    let pool = [...questions];

    if (examType === 'paper1') {
      pool = pool.filter(q => q.type === 'short-answer' || q.marks <= 4);
    } else if (examType === 'paper2') {
      pool = pool.filter(q => q.type === 'multi-part' || q.marks >= 5);
    }

    const shuffled = shuffleArray(pool);

    // Try to get good topic coverage
    const selected: typeof pool = [];
    const topicCounts = new Map<string, number>();

    for (const q of shuffled) {
      if (selected.length >= config.questionCount) break;
      const count = topicCounts.get(q.topic) || 0;
      if (count < 2) {
        selected.push(q);
        topicCounts.set(q.topic, count + 1);
      }
    }

    // Fill remaining if needed
    if (selected.length < config.questionCount) {
      for (const q of shuffled) {
        if (selected.length >= config.questionCount) break;
        if (!selected.includes(q)) selected.push(q);
      }
    }

    // Sort by difficulty
    return selected.sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]);
  }, [examType]);

  const startExam = useCallback(() => {
    if (!examType) return;
    const config = EXAM_CONFIGS.find(c => c.type === examType)!;
    setStarted(true);
    setCurrentIndex(0);
    setShowAnswer(false);
    setScore(0);
    setAnswered(0);
    setFinished(false);
    setMarksEarned(0);
    setTotalMarks(examQuestions.reduce((sum, q) => sum + q.marks, 0));
    setPerQuestion([]);
    setResultsSaved(false);
    recordPractice();

    const totalSeconds = config.timeMinutes * 60;
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
  }, [examType, examQuestions]);

  const handleMark = (earned: number) => {
    const q = examQuestions[currentIndex];
    const clamped = globalThis.Math.max(0, globalThis.Math.min(earned, q.marks));
    if (clamped === q.marks) setScore(s => s + 1);
    setMarksEarned(m => m + clamped);
    setAnswered(a => a + 1);
    setPerQuestion(prev => [...prev, { earned: clamped, marks: q.marks, topic: q.topic }]);
    markQuestionViewed(q.id);
    // Seed the spaced-repetition deck from exam performance too.
    recordReview(q.id, gradeFromMarks(clamped, q.marks));
  };

  const submitMarks = (earned: number) => {
    handleMark(earned);
    if (currentIndex + 1 >= examQuestions.length) {
      setFinished(true);
      if (timerRef) clearInterval(timerRef);
    } else {
      setCurrentIndex(i => i + 1);
      setShowAnswer(false);
    }
  };

  useEffect(() => {
    return () => { if (timerRef) clearInterval(timerRef); };
  }, [timerRef]);

  // Save mock exam results per topic when finished
  useEffect(() => {
    if (!finished || resultsSaved || perQuestion.length === 0) return;

    // Group results by topic and save a quiz result for each
    const topicResults = new Map<string, { earned: number; totalMarks: number }>();
    for (const pq of perQuestion) {
      const existing = topicResults.get(pq.topic) || { earned: 0, totalMarks: 0 };
      existing.earned += pq.earned;
      existing.totalMarks += pq.marks;
      topicResults.set(pq.topic, existing);
    }

    for (const [topicSlug, { earned, totalMarks: tm }] of topicResults) {
      const pct = tm > 0 ? globalThis.Math.round((earned / tm) * 100) : 0;
      addQuizResult({
        topicSlug,
        score: earned,
        total: tm,
        percentage: pct,
        date: new Date().toLocaleDateString(),
      });
    }

    // Gamification
    const totalEarnedAll = perQuestion.reduce((s, p) => s + p.earned, 0);
    const totalMarksAll = perQuestion.reduce((s, p) => s + p.marks, 0);
    const overallPct = totalMarksAll > 0 ? globalThis.Math.round((totalEarnedAll / totalMarksAll) * 100) : 0;

    let xpGained = XP_REWARDS.mockExamCompleted;
    let reason = 'Mock exam completed';
    if (overallPct >= 70) {
      xpGained += XP_REWARDS.mockExamGoodScore;
      reason = 'Great mock exam score!';
      setShowConfetti(true);
    }
    if (overallPct >= 90) {
      setShowConfetti(true);
    }

    const xpResult = addXP(xpGained, reason);
    window.dispatchEvent(new Event('formu-xp-update'));
    setXPToast({ amount: xpGained, reason });
    setTimeout(() => setXPToast(null), 3500);

    // Achievements
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
      isFirstMock: true,
      isMock70: overallPct >= 70,
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

    setResultsSaved(true);
  }, [finished, resultsSaved, perQuestion]);

  const formatTime = (s: number) => {
    const m = globalThis.Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${String(sec).padStart(2, '0')}`;
  };

  // ── SELECT EXAM TYPE ──
  const EXAM_ICONS = { paper1: '📝', paper2: '📋', mixed: '📑' };
  const EXAM_COLORS = { paper1: '#6c5ce7', paper2: '#4485c7', mixed: '#d48a3c' };

  if (!examType) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-10">
        <div className="mb-10">
          <h1 className="text-2xl font-bold tracking-tight mb-1">Mock Exam</h1>
          <p className="text-sm text-muted">Simulate exam conditions with a timed paper</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {EXAM_CONFIGS.map((config) => (
            <button
              key={config.type}
              onClick={() => setExamType(config.type)}
              className="relative text-left rounded-xl border border-border p-5 hover:border-transparent hover:shadow-lg hover:shadow-black/5 transition-all duration-200 group overflow-hidden"
            >
              <div
                className="absolute top-0 left-0 right-0 h-1 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ backgroundColor: EXAM_COLORS[config.type] }}
              />
              <div className="text-2xl mb-3">{EXAM_ICONS[config.type]}</div>
              <h3 className="text-sm font-semibold group-hover:text-accent transition-colors mb-1">{config.label}</h3>
              <p className="text-[11px] text-muted mb-4 leading-relaxed">{config.desc}</p>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="font-semibold text-foreground">{config.questionCount}q</span>
                <span className="text-muted">·</span>
                <span className="text-muted">{config.timeMinutes} min</span>
                <span className="text-muted">·</span>
                <span className="text-muted">{config.totalMarks} marks</span>
              </div>
            </button>
          ))}
        </div>

        <div className="mt-10 rounded-xl bg-surface/60 border border-border p-5">
          <h3 className="text-[11px] font-bold text-muted uppercase tracking-widest mb-3">How it works</h3>
          <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
            {[
              { step: '1', text: 'Pick a paper' },
              { step: '2', text: 'Random questions across topics' },
              { step: '3', text: 'Timer starts' },
              { step: '4', text: 'Self-mark each answer' },
              { step: '5', text: 'Get your breakdown' },
            ].map((s) => (
              <div key={s.step} className="flex sm:flex-col items-center sm:items-center gap-2 sm:text-center">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent text-[10px] font-bold">{s.step}</span>
                <span className="text-[11px] text-muted">{s.text}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ── PRE-START SCREEN ──
  if (!started) {
    const config = EXAM_CONFIGS.find(c => c.type === examType)!;
    return (
      <div className="mx-auto max-w-lg px-6 py-20 text-center">
        <button onClick={() => setExamType(null)} className="text-sm text-muted hover:text-accent mb-8 inline-block">&larr; Change paper</button>

        <h1 className="text-2xl font-bold mb-2">{config.label}</h1>
        <p className="text-muted mb-2 text-sm">{examQuestions.length} questions · {config.timeMinutes} minutes</p>
        <p className="text-muted mb-8 text-sm">Total: {examQuestions.reduce((s, q) => s + q.marks, 0)} marks</p>

        <div className="rounded-lg bg-surface p-4 mb-8 text-left">
          <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Topics covered</p>
          <div className="flex flex-wrap gap-1.5">
            {[...new Set(examQuestions.map(q => q.topic))].map(slug => {
              const t = TOPICS.find(t => t.slug === slug);
              return t ? (
                <span key={slug} className="rounded px-2 py-0.5 text-[11px] font-medium" style={{ backgroundColor: t.color + '12', color: t.color }}>
                  {t.name}
                </span>
              ) : null;
            })}
          </div>
        </div>

        <button
          onClick={startExam}
          className="rounded-lg bg-accent px-8 py-3 text-sm font-semibold text-white hover:bg-accent-hover transition-colors"
        >
          Start exam
        </button>
      </div>
    );
  }

  // ── RESULTS SCREEN ──
  if (finished) {
    const markPct = totalMarks > 0 ? globalThis.Math.round((marksEarned / totalMarks) * 100) : 0;
    const grade = markPct >= 90 ? '9' : markPct >= 80 ? '8' : markPct >= 70 ? '7' : markPct >= 60 ? '6' : markPct >= 50 ? '5' : markPct >= 40 ? '4' : markPct >= 30 ? '3' : markPct >= 20 ? '2' : '1';

    const msg = getMotivationalMessage(markPct);

    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Confetti trigger={showConfetti} />
        {xpToast && <XPToast amount={xpToast.amount} reason={xpToast.reason} visible />}
        {achievementToast && <AchievementToast name={achievementToast.name} icon={achievementToast.icon} visible />}

        <div className="text-center mb-10">
          <p className="text-xs font-bold text-muted uppercase tracking-widest mb-4">Exam complete</p>
          <div className="text-7xl font-bold text-accent mb-2 animate-count-up">{markPct}%</div>
          <p className="text-lg text-muted mb-1">{marksEarned} / {totalMarks} marks</p>
          <p className="text-sm text-muted mb-3">{score} / {answered} questions full marks · estimated grade {grade}</p>
          <p className="text-base font-medium">
            <span className="mr-1">{msg.emoji}</span> {msg.message}
          </p>
        </div>

        {/* Per-question breakdown */}
        <div className="rounded-lg border border-border p-5 mb-8">
          <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Question breakdown</p>
          <div className="grid grid-cols-5 sm:grid-cols-8 gap-2">
            {perQuestion.map((pq, i) => {
              const pct = pq.marks > 0 ? pq.earned / pq.marks : 0;
              const color = pct >= 1 ? 'bg-emerald-50 text-emerald-700' : pct > 0 ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-700';
              return (
                <div key={i} className={`rounded-md p-2 text-center text-xs font-medium ${color}`}>
                  <div className="font-bold">Q{i + 1}</div>
                  <div className="text-[10px] mt-0.5">{pq.earned}/{pq.marks}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Topic breakdown */}
        <div className="rounded-lg border border-border p-5 mb-8">
          <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">By topic</p>
          <div className="space-y-2">
            {[...new Set(examQuestions.map(q => q.topic))].map(slug => {
              const topicQs = examQuestions.map((q, i) => ({ ...q, idx: i })).filter(q => q.topic === slug);
              const topicMarks = topicQs.reduce((s, q) => s + q.marks, 0);
              const earned = topicQs.reduce((s, q) => {
                const result = perQuestion[q.idx];
                return s + (result?.earned ?? 0);
              }, 0);
              const t = TOPICS.find(t => t.slug === slug);
              if (!t) return null;

              return (
                <div key={slug} className="flex items-center gap-3">
                  <span className="text-xs font-medium w-48 truncate" style={{ color: t.color }}>{t.name}</span>
                  <div className="flex-1 h-2 rounded-full bg-surface">
                    <div className="h-full rounded-full bg-accent" style={{ width: `${topicMarks > 0 ? (earned / topicMarks) * 100 : 0}%` }} />
                  </div>
                  <span className="text-xs text-muted w-16 text-right">{earned}/{topicMarks}</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="flex justify-center gap-3">
          <button
            onClick={() => { setExamType(null); setStarted(false); setFinished(false); }}
            className="rounded-lg bg-accent px-6 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
          >
            New exam
          </button>
          <Link
            href="/questions"
            className="rounded-lg border border-border px-6 py-2.5 text-sm font-medium text-foreground hover:bg-surface transition-colors"
          >
            Question bank
          </Link>
        </div>
      </div>
    );
  }

  // ── ACTIVE EXAM ──
  const current = examQuestions[currentIndex];
  const currentTopic = TOPICS.find(t => t.slug === current.topic);
  const timeWarning = timeLeft < 300;

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      {/* Timer + Progress */}
      <div className="mb-8">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-muted font-medium">
            Question {currentIndex + 1} of {examQuestions.length}
          </span>
          <div className="flex items-center gap-4">
            <span className="font-medium text-accent">{marksEarned} marks earned</span>
            <span className={`font-mono font-bold text-sm ${timeWarning ? 'text-red-500' : 'text-foreground'}`}>
              {formatTime(timeLeft)}
            </span>
          </div>
        </div>
        <div className="h-1 rounded-full bg-surface">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${((currentIndex + 1) / examQuestions.length) * 100}%` }}
          />
        </div>
      </div>

      {/* Question */}
      <div>
        <div className="flex items-center gap-2 mb-6">
          <span
            className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: (currentTopic?.color || '#6c5ce7') + '12', color: currentTopic?.color }}
          >
            {currentTopic?.name}
          </span>
          <span className="text-xs text-muted">{current.subtopic}</span>
          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold diff-${current.difficulty}`}>
            {DIFFICULTY_LABELS[current.difficulty]}
          </span>
          <span className="ml-auto text-sm font-semibold text-accent">{current.marks} marks</span>
        </div>

        <div className="text-lg leading-[2] mb-10">
          <MathDisplay text={current.body} className="text-foreground" />
        </div>

        {!showAnswer ? (
          <button
            onClick={() => setShowAnswer(true)}
            className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
          >
            Reveal answer
          </button>
        ) : (
          <div>
            <div className="mb-5 rounded-lg bg-emerald-50/50 border border-emerald-100 p-6">
              <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-3">Mark Scheme</p>
              <MathDisplay text={current.markScheme} className="text-base text-foreground/75 leading-[1.8]" />
            </div>
            <div className="mb-5 rounded-lg bg-accent-light/50 border border-accent/10 p-6">
              <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-3">Worked Solution</p>
              <MathDisplay text={current.workedSolution} className="text-base text-foreground/75 leading-[1.8]" />
            </div>

            <p className="text-xs text-muted mb-2 font-medium">How many marks did you earn?</p>
            <div className="flex items-center gap-2">
              {/* Quick-pick buttons for each possible mark value */}
              {Array.from({ length: current.marks + 1 }, (_, i) => i).map((m) => (
                <button
                  key={m}
                  onClick={() => submitMarks(m)}
                  className={`flex h-9 w-9 items-center justify-center rounded-lg border text-sm font-semibold transition-all ${
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
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
