'use client';

import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import { TOPICS, DIFFICULTY_LABELS, TYPE_LABELS, Topic, Difficulty, QuestionType } from '@/lib/types';
import { questions } from '@/lib/questions';
import QuestionCard from '@/components/QuestionCard';
import { Suspense } from 'react';
import { getBookmarkedIds } from '@/lib/progress';

const DIFFICULTY_ORDER: Record<Difficulty, number> = {
  foundation: 0,
  intermediate: 1,
  hard: 2,
  'exam-hard': 3,
};

const DIFFICULTIES: { key: Difficulty; label: string; dot: string }[] = [
  { key: 'foundation', label: 'Foundation', dot: 'bg-emerald-400' },
  { key: 'intermediate', label: 'Intermediate', dot: 'bg-blue-400' },
  { key: 'hard', label: 'Hard', dot: 'bg-amber-400' },
  { key: 'exam-hard', label: 'Exam Hard', dot: 'bg-red-400' },
];

function QuestionBankContent() {
  const searchParams = useSearchParams();
  const initialTopic = searchParams.get('topic') as Topic | null;
  const showBookmarked = searchParams.get('bookmarked') === '1';

  const [selectedTopic, setSelectedTopic] = useState<Topic | 'all'>(initialTopic || 'all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<Difficulty | 'all'>('all');
  const [selectedType, setSelectedType] = useState<QuestionType | 'all'>('all');
  const [selectedSubtopic, setSelectedSubtopic] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [onlyBookmarked, setOnlyBookmarked] = useState(showBookmarked);
  const [bookmarkedIds, setBookmarkedIds] = useState<string[]>([]);

  useEffect(() => {
    setBookmarkedIds(getBookmarkedIds());
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setBookmarkedIds(getBookmarkedIds());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const availableSubtopics = useMemo(() => {
    if (selectedTopic === 'all') return [];
    const topic = TOPICS.find((t) => t.slug === selectedTopic);
    return topic?.subtopics || [];
  }, [selectedTopic]);

  const filtered = useMemo(() => {
    const result = questions.filter((q) => {
      if (selectedTopic !== 'all' && q.topic !== selectedTopic) return false;
      if (selectedDifficulty !== 'all' && q.difficulty !== selectedDifficulty) return false;
      if (selectedType !== 'all' && q.type !== selectedType) return false;
      if (selectedSubtopic !== 'all' && q.subtopic !== selectedSubtopic) return false;
      if (onlyBookmarked && !bookmarkedIds.includes(q.id)) return false;
      if (search) {
        const s = search.toLowerCase();
        const matchBody = q.body.toLowerCase().includes(s);
        const matchSubtopic = q.subtopic.toLowerCase().includes(s);
        if (!matchBody && !matchSubtopic) return false;
      }
      return true;
    });
    return result.sort((a, b) => DIFFICULTY_ORDER[a.difficulty] - DIFFICULTY_ORDER[b.difficulty]);
  }, [selectedTopic, selectedDifficulty, selectedType, selectedSubtopic, search, onlyBookmarked, bookmarkedIds]);

  const topicInfo = selectedTopic !== 'all' ? TOPICS.find(t => t.slug === selectedTopic) : null;

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight mb-1">
          {onlyBookmarked ? '★ Saved Questions' : 'Question Bank'}
        </h1>
        <p className="text-sm text-muted">
          {filtered.length} question{filtered.length !== 1 ? 's' : ''} · easiest first
        </p>
      </div>

      {/* Search */}
      <div className="mb-5">
        <div className="relative">
          <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search questions..."
            className="w-full rounded-xl border border-border bg-white pl-10 pr-4 py-3 text-sm placeholder:text-muted/40 focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>
      </div>

      {/* Topic selector — all topics visible (wraps) */}
      <div className="mb-4">
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => { setSelectedTopic('all'); setSelectedSubtopic('all'); }}
            className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
              selectedTopic === 'all'
                ? 'bg-foreground text-white'
                : 'bg-surface text-muted hover:text-foreground hover:bg-surface'
            }`}
          >
            All topics
          </button>
          {TOPICS.map((t) => (
            <button
              key={t.slug}
              onClick={() => { setSelectedTopic(t.slug); setSelectedSubtopic('all'); }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all ${
                selectedTopic === t.slug
                  ? 'text-white'
                  : 'bg-surface text-muted hover:text-foreground'
              }`}
              style={selectedTopic === t.slug ? { backgroundColor: t.color } : undefined}
            >
              <span className="text-[10px]">{t.icon}</span>
              {t.name}
            </button>
          ))}
        </div>
      </div>

      {/* Subtopic chips (show when topic selected) */}
      {availableSubtopics.length > 0 && (
        <div className="mb-4">
          <div className="flex flex-wrap gap-1.5">
            <button
              onClick={() => setSelectedSubtopic('all')}
              className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                selectedSubtopic === 'all'
                  ? 'bg-accent text-white'
                  : 'bg-accent-light/60 text-accent hover:bg-accent-light'
              }`}
            >
              All subtopics
            </button>
            {availableSubtopics.map((s) => (
              <button
                key={s}
                onClick={() => setSelectedSubtopic(s)}
                className={`rounded-full px-3 py-1 text-[11px] font-medium transition-all ${
                  selectedSubtopic === s
                    ? 'bg-accent text-white'
                    : 'bg-accent-light/60 text-accent/70 hover:bg-accent-light hover:text-accent'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Difficulty pills + Type + Bookmark */}
      <div className="flex flex-wrap items-center gap-2 mb-8">
        {/* Difficulty pills */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setSelectedDifficulty('all')}
            className={`px-3 py-1.5 text-[11px] font-medium transition-all ${
              selectedDifficulty === 'all'
                ? 'bg-foreground text-white'
                : 'bg-white text-muted hover:bg-surface'
            }`}
          >
            All
          </button>
          {DIFFICULTIES.map((d) => (
            <button
              key={d.key}
              onClick={() => setSelectedDifficulty(selectedDifficulty === d.key ? 'all' : d.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium border-l border-border transition-all ${
                selectedDifficulty === d.key
                  ? 'bg-foreground text-white'
                  : 'bg-white text-muted hover:bg-surface hover:text-foreground'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${selectedDifficulty === d.key ? 'bg-white' : d.dot}`} />
              {d.label}
            </button>
          ))}
        </div>

        {/* Type dropdown */}
        <select
          value={selectedType}
          onChange={(e) => setSelectedType(e.target.value as QuestionType | 'all')}
          className="rounded-lg border border-border bg-white px-3 py-1.5 text-[11px] font-medium text-muted focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent cursor-pointer hover:border-accent/30 transition-all"
        >
          <option value="all">All types</option>
          {(Object.entries(TYPE_LABELS) as [QuestionType, string][]).map(([key, label]) => (
            <option key={key} value={key}>{label}</option>
          ))}
        </select>

        {/* Bookmark toggle */}
        <button
          onClick={() => setOnlyBookmarked(!onlyBookmarked)}
          className={`rounded-lg px-3 py-1.5 text-[11px] font-medium transition-all ${
            onlyBookmarked
              ? 'bg-amber-400 text-white border border-amber-400'
              : 'border border-border text-muted hover:text-amber-500 hover:border-amber-300'
          }`}
        >
          {onlyBookmarked ? '★ Saved' : `☆ Saved · ${bookmarkedIds.length}`}
        </button>
      </div>

      {/* Topic banner when filtered */}
      {topicInfo && (
        <div className="flex items-center gap-3 mb-8 pb-6 border-b border-border">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-lg text-base font-bold"
            style={{ backgroundColor: topicInfo.color + '15', color: topicInfo.color }}
          >
            {topicInfo.icon}
          </span>
          <div>
            <h2 className="text-sm font-semibold">{topicInfo.name}</h2>
            <p className="text-xs text-muted">{filtered.length} questions in this topic</p>
          </div>
        </div>
      )}

      {/* Questions */}
      <div>
        {filtered.length === 0 ? (
          <div className="text-center py-20 text-muted">
            {onlyBookmarked ? (
              <>
                <p className="text-3xl mb-3">☆</p>
                <p className="text-base mb-1">No saved questions yet</p>
                <p className="text-sm">Click the star on any question to save it for later</p>
              </>
            ) : (
              <>
                <p className="text-base mb-1">No questions match these filters</p>
                <p className="text-sm">Try broadening your selection</p>
              </>
            )}
          </div>
        ) : (
          filtered.map((q, i) => <QuestionCard key={q.id} question={q} index={i} />)
        )}
      </div>
    </div>
  );
}

export default function QuestionsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-6 py-10"><p className="text-muted">Loading...</p></div>}>
      <QuestionBankContent />
    </Suspense>
  );
}
