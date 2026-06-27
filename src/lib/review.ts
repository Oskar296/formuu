'use client';

// ── Spaced Repetition (Leitner box system) ──
//
// Every question the student self-marks (in a quiz or a review session) is
// scheduled for future review. Recall it well and it moves up a box with a
// longer interval; forget it and it drops back to box 1. The /review page
// surfaces whatever is "due" today, so weak questions resurface often and
// mastered ones fade into the background.

const REVIEW_KEY = 'formu-review';
const REVIEW_COUNT_KEY = 'formu-review-count'; // lifetime cards reviewed in sessions

export type ReviewGrade = 'forgot' | 'almost' | 'got';

export interface ReviewEntry {
  box: number; // 1-5
  due: string; // YYYY-MM-DD — next time this question should be seen
  last: string; // YYYY-MM-DD — last reviewed
  reps: number; // total times reviewed
  lapses: number; // times forgotten
}

type ReviewMap = Record<string, ReviewEntry>;

export const MAX_BOX = 5;

// Days until the next review for each box — an expanding schedule.
const BOX_INTERVALS: Record<number, number> = {
  1: 1,
  2: 2,
  3: 4,
  4: 9,
  5: 21,
};

// ── Date helpers (local YYYY-MM-DD, lexicographically comparable) ──
function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function fmt(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function todayStr(): string {
  return fmt(new Date());
}

function addDaysToToday(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return fmt(d);
}

// ── Storage ──
function getMap(): ReviewMap {
  if (typeof window === 'undefined') return {};
  try {
    const raw = localStorage.getItem(REVIEW_KEY);
    return raw ? (JSON.parse(raw) as ReviewMap) : {};
  } catch {
    return {};
  }
}

function saveMap(map: ReviewMap) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(REVIEW_KEY, JSON.stringify(map));
}

// ── Recording reviews ──
export function recordReview(questionId: string, grade: ReviewGrade): ReviewEntry {
  const map = getMap();
  const existing = map[questionId];
  const today = todayStr();

  let box = existing?.box ?? 1;
  let lapses = existing?.lapses ?? 0;
  const reps = (existing?.reps ?? 0) + 1;

  if (grade === 'forgot') {
    box = 1;
    lapses += 1;
  } else if (grade === 'almost') {
    // Stay in the current box — needs more reinforcement before advancing.
    box = globalThis.Math.max(1, box);
  } else {
    // Recalled cleanly — promote to a longer interval.
    box = globalThis.Math.min(MAX_BOX, box + 1);
  }

  const interval = BOX_INTERVALS[box] ?? 1;
  const entry: ReviewEntry = {
    box,
    due: addDaysToToday(interval),
    last: today,
    reps,
    lapses,
  };
  map[questionId] = entry;
  saveMap(map);
  return entry;
}

// Translate a quiz mark fraction into a review grade so quizzes seed the deck.
export function gradeFromMarks(earned: number, total: number): ReviewGrade {
  if (total <= 0) return 'almost';
  const frac = earned / total;
  if (frac >= 0.8) return 'got';
  if (frac > 0) return 'almost';
  return 'forgot';
}

// ── Queries ──
export function getDueQuestionIds(): string[] {
  const map = getMap();
  const today = todayStr();
  return Object.entries(map)
    .filter(([, e]) => e.due <= today)
    // Most overdue / lowest box first, so the weakest questions come up first.
    .sort((a, b) => {
      if (a[1].box !== b[1].box) return a[1].box - b[1].box;
      return a[1].due < b[1].due ? -1 : 1;
    })
    .map(([id]) => id);
}

export function getDueCount(): number {
  const map = getMap();
  const today = todayStr();
  let count = 0;
  for (const e of Object.values(map)) {
    if (e.due <= today) count++;
  }
  return count;
}

export function getReviewEntry(questionId: string): ReviewEntry | null {
  return getMap()[questionId] ?? null;
}

export function getReviewStats(): {
  total: number;
  due: number;
  mastered: number;
  learning: number;
  nextDue: string | null;
} {
  const map = getMap();
  const today = todayStr();
  const entries = Object.values(map);
  const total = entries.length;
  const due = entries.filter((e) => e.due <= today).length;
  const mastered = entries.filter((e) => e.box >= MAX_BOX).length;
  const learning = total - mastered;
  const upcoming = entries
    .filter((e) => e.due > today)
    .map((e) => e.due)
    .sort();
  return { total, due, mastered, learning, nextDue: upcoming[0] ?? null };
}

// Lifetime count of cards graded in review sessions (for achievements/stats).
export function incrementReviewCount(n = 1): number {
  if (typeof window === 'undefined') return 0;
  const cur = parseInt(localStorage.getItem(REVIEW_COUNT_KEY) || '0', 10) || 0;
  const next = cur + n;
  localStorage.setItem(REVIEW_COUNT_KEY, String(next));
  return next;
}

export function getReviewCount(): number {
  if (typeof window === 'undefined') return 0;
  return parseInt(localStorage.getItem(REVIEW_COUNT_KEY) || '0', 10) || 0;
}

export function clearReview() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(REVIEW_KEY);
  localStorage.removeItem(REVIEW_COUNT_KEY);
}
