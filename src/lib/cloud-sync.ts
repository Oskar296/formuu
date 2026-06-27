'use client';

import { supabase, isSupabaseConfigured } from './supabase';
import type { ProgressData, QuizResult } from './progress';

const STORAGE_KEY = 'formu-progress';
const STREAK_KEY = 'formu-streak';

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastPracticeDate: string;
}

function getLocalProgress(): ProgressData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { quizResults: [], questionsViewed: [], bookmarkedQuestions: [] };
    return JSON.parse(raw);
  } catch {
    return { quizResults: [], questionsViewed: [], bookmarkedQuestions: [] };
  }
}

function getLocalStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STREAK_KEY);
    if (!raw) return { currentStreak: 0, longestStreak: 0, lastPracticeDate: '' };
    return JSON.parse(raw);
  } catch {
    return { currentStreak: 0, longestStreak: 0, lastPracticeDate: '' };
  }
}

function saveLocalProgress(data: ProgressData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

function saveLocalStreak(data: StreakData) {
  localStorage.setItem(STREAK_KEY, JSON.stringify(data));
}

/** Merge two progress objects, keeping the union of all data */
function mergeProgress(local: ProgressData, cloud: ProgressData): ProgressData {
  // Merge quiz results (deduplicate by date+topic+score combo)
  const quizKey = (r: QuizResult) => `${r.topicSlug}|${r.date}|${r.score}|${r.total}`;
  const seenQuizzes = new Set<string>();
  const mergedQuizzes: QuizResult[] = [];
  for (const r of [...local.quizResults, ...cloud.quizResults]) {
    const key = quizKey(r);
    if (!seenQuizzes.has(key)) {
      seenQuizzes.add(key);
      mergedQuizzes.push(r);
    }
  }

  // Merge viewed questions (union of IDs)
  const mergedViewed = [...new Set([...local.questionsViewed, ...cloud.questionsViewed])];

  // Merge bookmarks (union of IDs)
  const mergedBookmarks = [...new Set([...local.bookmarkedQuestions, ...cloud.bookmarkedQuestions])];

  return {
    quizResults: mergedQuizzes,
    questionsViewed: mergedViewed,
    bookmarkedQuestions: mergedBookmarks,
  };
}

/** Merge two streak objects, keeping the best data */
function mergeStreak(local: StreakData, cloud: StreakData): StreakData {
  // Keep whichever has the more recent practice date
  const localDate = local.lastPracticeDate || '0000-00-00';
  const cloudDate = cloud.lastPracticeDate || '0000-00-00';
  const latest = localDate >= cloudDate ? local : cloud;

  return {
    currentStreak: latest.currentStreak,
    longestStreak: globalThis.Math.max(local.longestStreak, cloud.longestStreak),
    lastPracticeDate: latest.lastPracticeDate,
  };
}

/** Push local data to Supabase */
export async function pushToCloud(): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured()) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const progress = getLocalProgress();
  const streak = getLocalStreak();

  const { error } = await supabase
    .from('user_progress')
    .upsert({
      user_id: user.id,
      progress_data: progress,
      streak_data: streak,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  return !error;
}

/** Pull cloud data and merge with local */
export async function pullFromCloud(): Promise<boolean> {
  if (!supabase || !isSupabaseConfigured()) return false;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabase
    .from('user_progress')
    .select('progress_data, streak_data')
    .eq('user_id', user.id)
    .single();

  if (error || !data) {
    // No cloud data yet — push local to cloud
    await pushToCloud();
    return true;
  }

  const cloudProgress = data.progress_data as ProgressData;
  const cloudStreak = data.streak_data as StreakData;

  const localProgress = getLocalProgress();
  const localStreak = getLocalStreak();

  // Merge
  const mergedProgress = mergeProgress(localProgress, cloudProgress);
  const mergedStreak = mergeStreak(localStreak, cloudStreak);

  // Save merged data locally
  saveLocalProgress(mergedProgress);
  saveLocalStreak(mergedStreak);

  // Push merged data to cloud
  await supabase
    .from('user_progress')
    .upsert({
      user_id: user.id,
      progress_data: mergedProgress,
      streak_data: mergedStreak,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

  return true;
}

/** Sync: pull from cloud, merge, push back. Call on login and periodically. */
export async function syncProgress(): Promise<boolean> {
  return pullFromCloud();
}
