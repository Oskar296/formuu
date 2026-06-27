'use client';

import { useState, useEffect } from 'react';
import { Question, TOPICS, DIFFICULTY_LABELS } from '@/lib/types';
import Math from './Math';
import { toggleBookmark, isBookmarked, markQuestionViewed, recordPractice, getViewedQuestionIds, getBookmarkedIds } from '@/lib/progress';
import { addXP, XP_REWARDS, checkAndUnlockAchievements } from '@/lib/gamification';

export default function QuestionCard({ question, index }: { question: Question; index?: number }) {
  const [showMarkScheme, setShowMarkScheme] = useState(false);
  const [showSolution, setShowSolution] = useState(false);
  const [bookmarked, setBookmarked] = useState(false);

  const topic = TOPICS.find((t) => t.slug === question.topic);

  useEffect(() => {
    setBookmarked(isBookmarked(question.id));
    markQuestionViewed(question.id);
    recordPractice();
    addXP(XP_REWARDS.questionViewed, 'Question viewed');
    window.dispatchEvent(new Event('formu-xp-update'));
    // Check question-count achievements
    const viewed = getViewedQuestionIds();
    checkAndUnlockAchievements({ questionsViewed: viewed.length });
  }, [question.id]);

  const handleBookmark = () => {
    const nowBookmarked = toggleBookmark(question.id);
    setBookmarked(nowBookmarked);
    if (nowBookmarked) {
      addXP(XP_REWARDS.bookmark, 'Bookmarked question');
      window.dispatchEvent(new Event('formu-xp-update'));
      const bookmarks = getBookmarkedIds();
      checkAndUnlockAchievements({ bookmarkCount: bookmarks.length });
    }
  };

  return (
    <div className="border-b border-border py-16 first:pt-2 last:border-b-0">
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {index !== undefined && (
          <span className="text-xs font-mono text-muted/50 mr-1">
            {String(index + 1).padStart(2, '0')}
          </span>
        )}
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
            title={bookmarked ? 'Remove bookmark' : 'Bookmark this question'}
          >
            {bookmarked ? '★' : '☆'}
          </button>
        </div>
      </div>

      {/* Question body — large and roomy */}
      <div className="mb-12 text-xl leading-[2.1]">
        <Math text={question.body} className="text-foreground" />
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={() => setShowMarkScheme(!showMarkScheme)}
          className={`rounded-md px-4 py-1.5 text-xs font-medium transition-all ${
            showMarkScheme
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-surface text-muted hover:text-foreground border border-transparent'
          }`}
        >
          {showMarkScheme ? 'Hide' : 'Mark scheme'}
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

      {/* Mark Scheme */}
      {showMarkScheme && (
        <div className="mt-6 rounded-xl bg-emerald-50/50 border border-emerald-100 p-7">
          <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-widest mb-4">Mark Scheme</p>
          <Math text={question.markScheme} className="text-lg text-foreground/80 leading-[2]" />
        </div>
      )}

      {/* Worked Solution */}
      {showSolution && (
        <div className="mt-6 rounded-xl bg-accent-light/50 border border-accent/10 p-7">
          <p className="text-[10px] font-bold text-accent uppercase tracking-widest mb-4">Worked Solution</p>
          <Math text={question.workedSolution} className="text-lg text-foreground/80 leading-[2]" />
        </div>
      )}
    </div>
  );
}
