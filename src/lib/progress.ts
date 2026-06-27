'use client';

export interface QuizResult {
  topicSlug: string;
  score: number;
  total: number;
  percentage: number;
  date: string;
}

export interface ProgressData {
  quizResults: QuizResult[];
  questionsViewed: string[]; // question IDs
  bookmarkedQuestions: string[];
}

const STORAGE_KEY = 'formu-progress';

function getProgress(): ProgressData {
  if (typeof window === 'undefined') return { quizResults: [], questionsViewed: [], bookmarkedQuestions: [] };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { quizResults: [], questionsViewed: [], bookmarkedQuestions: [] };
    return JSON.parse(raw);
  } catch {
    return { quizResults: [], questionsViewed: [], bookmarkedQuestions: [] };
  }
}

function saveProgress(data: ProgressData) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function addQuizResult(result: QuizResult) {
  const data = getProgress();
  data.quizResults.push(result);
  saveProgress(data);
}

export function getQuizResults(): QuizResult[] {
  return getProgress().quizResults;
}

export function getTopicBestScore(topicSlug: string): number | null {
  const results = getProgress().quizResults.filter(r => r.topicSlug === topicSlug);
  if (results.length === 0) return null;
  return globalThis.Math.max(...results.map(r => r.percentage));
}

export function getTopicAttemptCount(topicSlug: string): number {
  return getProgress().quizResults.filter(r => r.topicSlug === topicSlug).length;
}

export function markQuestionViewed(questionId: string) {
  const data = getProgress();
  if (!data.questionsViewed.includes(questionId)) {
    data.questionsViewed.push(questionId);
    saveProgress(data);
  }
}

export function getViewedQuestionIds(): string[] {
  return getProgress().questionsViewed;
}

export function toggleBookmark(questionId: string): boolean {
  const data = getProgress();
  const idx = data.bookmarkedQuestions.indexOf(questionId);
  if (idx === -1) {
    data.bookmarkedQuestions.push(questionId);
    saveProgress(data);
    return true;
  } else {
    data.bookmarkedQuestions.splice(idx, 1);
    saveProgress(data);
    return false;
  }
}

export function isBookmarked(questionId: string): boolean {
  return getProgress().bookmarkedQuestions.includes(questionId);
}

export function getBookmarkedIds(): string[] {
  return getProgress().bookmarkedQuestions;
}

export function getTotalStats() {
  const data = getProgress();
  const totalQuizzes = data.quizResults.length;
  const avgScore = totalQuizzes > 0
    ? globalThis.Math.round(data.quizResults.reduce((sum, r) => sum + r.percentage, 0) / totalQuizzes)
    : 0;
  const questionsViewed = data.questionsViewed.length;
  const topicsAttempted = new Set(data.quizResults.map(r => r.topicSlug)).size;

  return { totalQuizzes, avgScore, questionsViewed, topicsAttempted };
}

// ── Streaks ──
const STREAK_KEY = 'formu-streak';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string; // YYYY-MM-DD
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getStreakData(): StreakData {
  if (typeof window === 'undefined') return { currentStreak: 0, longestStreak: 0, lastPracticeDate: '' };
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { currentStreak: 0, longestStreak: 0, lastPracticeDate: '' };
    return JSON.parse(raw);
  } catch {
    return { currentStreak: 0, longestStreak: 0, lastPracticeDate: '' };
  }
}

function saveStreakData(data: StreakData) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

export function recordPractice() {
  const today = getToday();
  const streak = getStreakData();

  if (streak.lastPracticeDate === today) return; // already counted today

  if (streak.lastPracticeDate === getYesterday()) {
    streak.currentStreak += 1;
  } else {
    streak.currentStreak = 1;
  }

  if (streak.currentStreak > streak.longestStreak) {
    streak.longestStreak = streak.currentStreak;
  }

  streak.lastPracticeDate = today;
  saveStreakData(streak);
}

export function getStreak(): { current: number; longest: number; practicedToday: boolean } {
  const streak = getStreakData();
  const today = getToday();
  const yesterday = getYesterday();

  // If last practice was before yesterday, streak is broken
  if (streak.lastPracticeDate !== today && streak.lastPracticeDate !== yesterday) {
    return { current: 0, longest: streak.longestStreak, practicedToday: false };
  }

  return {
    current: streak.currentStreak,
    longest: streak.longestStreak,
    practicedToday: streak.lastPracticeDate === today,
  };
}

// ── Weak topics ──
export function getWeakTopics(): { topicSlug: string; avgScore: number; attempts: number }[] {
  const data = getProgress();
  const topicMap = new Map<string, { total: number; sum: number }>();

  for (const r of data.quizResults) {
    const existing = topicMap.get(r.topicSlug) || { total: 0, sum: 0 };
    existing.total += 1;
    existing.sum += r.percentage;
    topicMap.set(r.topicSlug, existing);
  }

  const weak: { topicSlug: string; avgScore: number; attempts: number }[] = [];
  for (const [slug, { total, sum }] of topicMap) {
    const avg = globalThis.Math.round(sum / total);
    if (avg < 70) {
      weak.push({ topicSlug: slug, avgScore: avg, attempts: total });
    }
  }

  return weak.sort((a, b) => a.avgScore - b.avgScore);
}

export function clearProgress() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(STREAK_KEY);
}
