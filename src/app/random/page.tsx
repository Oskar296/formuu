'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import Link from 'next/link';
import { TOPICS, DIFFICULTY_LABELS } from '@/lib/types';
import { questions } from '@/lib/questions';
import MathDisplay from '@/components/Math';
import { toggleBookmark, isBookmarked, recordPractice, markQuestionViewed, getViewedQuestionIds, getBookmarkedIds } from '@/lib/progress';
import { addXP, XP_REWARDS, checkAndUnlockAchievements } from '@/lib/gamification';

function getRandomQuestion() {
  const idx = globalThis.Math.floor(globalThis.Math.random() * questions.length);
  return questions[idx];
}

export default function RandomQuestionPage() {
  const [question, setQuestion] = useState<typeof questions[0] | null>(null);
  const [showMarkScheme, setShowMarkScheme] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);
  const [count, setCount] = useState(1);

  // Defer random selection to client to avoid hydration mismatch
  useEffect(() => {
    if (!question) setQuestion(getRandomQuestion());
  }, [question]);

  const topic = question ? TOPICS.find(t => t.slug === question.topic) : null;

  useEffect(() => {
    if (question) {
      setBookmarked(isBookmarked(question.id));
      recordPractice();
      markQuestionViewed(question.id);
      addXP(XP_REWARDS.questionViewed, 'Random question');
      window.dispatchEvent(new Event('formu-xp-update'));
      const viewed = getViewedQuestionIds();
      checkAndUnlockAchievements({ questionsViewed: viewed.length });
    }
  }, [question?.id]);

  const nextRandom = useCallback(() => {
    setQuestion(getRandomQuestion());
    setShowMarkScheme(false);
    setShowSolution(false);
    setCount(c => c + 1);
  }, []);

  // Keyboard shortcut: Space to reveal, N for next
  useEffect(() => {
    if (!question) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.code === 'Space' && !showMarkScheme && !showSolution) {
        e.preventDefault();
        setShowMarkScheme(true);
      } else if (e.code === 'KeyN' || e.code === 'ArrowRight') {
        e.preventDefault();
        nextRandom();
      } else if (e.code === 'KeyB') {
        e.preventDefault();
        const now = toggleBookmark(question.id);
        setBookmarked(now);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showMarkScheme, showSolution, nextRandom, question?.id]);

  const handleBookmark = () => {
    if (!question) return;
    const now = toggleBookmark(question.id);
    setBookmarked(now);
  };

  if (!question) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-20 text-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">Random Practice</h1>
          <p className="text-sm text-muted">Question #{count} · press <kbd className="px-1.5 py-0.5 rounded bg-surface border border-border text-[11px] font-mono">N</kbd> for next</p>
        </div>
        <button
          onClick={nextRandom}
          className="rounded-lg bg-accent px-5 py-2.5 text-sm font-medium text-white hover:bg-accent-hover transition-colors"
        >
          Next →
        </button>
      </div>

      {/* Question */}
      <div>
        <div className="flex flex-wrap items-center gap-2 mb-6">
          <span
            className="rounded px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide"
            style={{ backgroundColor: (topic?.color || '#6c5ce7') + '12', color: topic?.color }}
          >
            {topic?.name}
          </span>
          <span className="text-xs text-muted">{question.subtopic}</span>
          <span className={`rounded px-2 py-0.5 text-[11px] font-semibold diff-${question.difficulty}`}>
            {DIFFICULTY_LABELS[question.difficulty]}
          </span>
          <div className="ml-auto flex items-center gap-3">
            <span className="text-sm text-muted tabular-nums">{question.marks} marks</span>
            <button
              onClick={handleBookmark}
              className={`text-lg transition-all hover:scale-110 ${
                bookmarked ? 'text-amber-500' : 'text-muted/30 hover:text-amber-400'
              }`}
              title={bookmarked ? 'Remove bookmark' : 'Bookmark (B)'}
            >
              {bookmarked ? '★' : '☆'}
            </button>
          </div>
        </div>

        <div className="text-lg leading-[2] mb-10">
          <MathDisplay text={question.body} className="text-foreground" />
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setShowMarkScheme(!showMarkScheme)}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition-all ${
              showMarkScheme
                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                : 'bg-surface text-muted hover:text-foreground border border-transparent'
            }`}
          >
            {showMarkScheme ? 'Hide' : 'Mark scheme'} <span className="text-muted/50 ml-1 text-[10px]">Space</span>
          </button>
          <button
            onClick={() => setShowSolution(!showSolution)}
            className={`rounded-md px-4 py-1.5 text-xs font-medium transition-all ${
              showSolution
                ? 'bg-accent-light text-accent border border-accent/20'
                : 'bg-surface text-muted hover:text-foreground border border-transparent'
            }`}
          >
            {showSolution ? 'Hide' : 'Worked solution'}
          </button>
        </div>

        {showMarkScheme && (
          <div className="mb-6 rounded-lg bg-emerald-50/50 border border-emerald-100 p-6">
            <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-4">Mark Scheme</p>
            <MathDisplay text={question.markScheme} className="text-base text-foreground/75 leading-[1.8]" />
          </div>
        )}

        {showSolution && (
          <div className="mb-6 rounded-lg bg-accent-light/50 border border-accent/10 p-6">
            <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-4">Worked Solution</p>
            <MathDisplay text={question.workedSolution} className="text-base text-foreground/75 leading-[1.8]" />
          </div>
        )}
      </div>

      {/* Bottom shortcut hints */}
      <div className="mt-16 flex justify-center gap-6 text-[11px] text-muted/50">
        <span><kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">Space</kbd> reveal</span>
        <span><kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">N</kbd> next</span>
        <span><kbd className="px-1 py-0.5 rounded bg-surface border border-border font-mono">B</kbd> bookmark</span>
      </div>
    </div>
  );
}
