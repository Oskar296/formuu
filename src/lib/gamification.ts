'use client';

// ── XP & Levels ──
const XP_KEY = 'formu-xp';

export interface XPData {
  totalXP: number;
  weeklyXP: number;
  weekStart: string; // YYYY-MM-DD (Monday)
  achievements: string[]; // unlocked achievement IDs
  lastXPGain: { amount: number; reason: string; timestamp: number } | null;
}

function getMonday(): string {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, '0')}-${String(monday.getDate()).padStart(2, '0')}`;
}

function getXPData(): XPData {
  if (typeof window === 'undefined') return { totalXP: 0, weeklyXP: 0, weekStart: '', achievements: [], lastXPGain: null };
  try {
    const raw = localStorage.getItem(XP_KEY);
    if (!raw) return { totalXP: 0, weeklyXP: 0, weekStart: getMonday(), achievements: [], lastXPGain: null };
    const data: XPData = JSON.parse(raw);
    // Reset weekly XP if new week
    const currentMonday = getMonday();
    if (data.weekStart !== currentMonday) {
      data.weeklyXP = 0;
      data.weekStart = currentMonday;
    }
    return data;
  } catch {
    return { totalXP: 0, weeklyXP: 0, weekStart: getMonday(), achievements: [], lastXPGain: null };
  }
}

function saveXPData(data: XPData) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(XP_KEY, JSON.stringify(data));
}

// XP amounts
export const XP_REWARDS = {
  questionViewed: 2,
  quizCompleted: 15,
  quizPerfect: 50,
  quizGoodScore: 25, // 80%+
  mockExamCompleted: 30,
  mockExamGoodScore: 50, // 70%+
  streakDay: 10,
  firstQuiz: 20,
  bookmark: 1,
  reviewCard: 3, // per question reviewed in a spaced-repetition session
  reviewSession: 15, // bonus for clearing all due reviews
} as const;

export function addXP(amount: number, reason: string): { newTotal: number; leveledUp: boolean; newLevel: number } {
  const data = getXPData();
  const oldLevel = getLevel(data.totalXP);
  data.totalXP += amount;
  data.weeklyXP += amount;
  data.lastXPGain = { amount, reason, timestamp: Date.now() };
  const newLevel = getLevel(data.totalXP);
  saveXPData(data);
  return { newTotal: data.totalXP, leveledUp: newLevel > oldLevel, newLevel };
}

export function getXP(): XPData {
  return getXPData();
}

// Level thresholds - exponential curve
export const LEVELS = [
  { level: 1, name: 'Beginner', xp: 0, icon: '🌱' },
  { level: 2, name: 'Learner', xp: 50, icon: '📖' },
  { level: 3, name: 'Student', xp: 150, icon: '✏️' },
  { level: 4, name: 'Scholar', xp: 350, icon: '🎓' },
  { level: 5, name: 'Practitioner', xp: 600, icon: '⚡' },
  { level: 6, name: 'Skilled', xp: 1000, icon: '💪' },
  { level: 7, name: 'Expert', xp: 1500, icon: '🧠' },
  { level: 8, name: 'Master', xp: 2200, icon: '👑' },
  { level: 9, name: 'Grandmaster', xp: 3200, icon: '🏆' },
  { level: 10, name: 'Legend', xp: 5000, icon: '⭐' },
] as const;

export function getLevel(xp: number): number {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (xp >= LEVELS[i].xp) return LEVELS[i].level;
  }
  return 1;
}

export function getLevelInfo(xp: number) {
  const level = getLevel(xp);
  const current = LEVELS[level - 1];
  const next = level < LEVELS.length ? LEVELS[level] : null;
  const xpIntoLevel = xp - current.xp;
  const xpForNextLevel = next ? next.xp - current.xp : 0;
  const progress = next ? globalThis.Math.min(xpIntoLevel / xpForNextLevel, 1) : 1;

  return {
    level: current.level,
    name: current.name,
    icon: current.icon,
    xpIntoLevel,
    xpForNextLevel,
    progress,
    totalXP: xp,
    isMaxLevel: !next,
  };
}

// ── Achievements ──
export interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  secret?: boolean;
}

export const ACHIEVEMENTS: Achievement[] = [
  { id: 'first-question', name: 'First Steps', description: 'View your first question', icon: '👣' },
  { id: 'first-quiz', name: 'Quiz Starter', description: 'Complete your first quiz', icon: '🎯' },
  { id: 'first-mock', name: 'Exam Ready', description: 'Complete your first mock exam', icon: '📝' },
  { id: 'perfect-quiz', name: 'Perfectionist', description: 'Score 100% on a quiz', icon: '💯' },
  { id: 'ten-quizzes', name: 'Quiz Machine', description: 'Complete 10 quizzes', icon: '⚙️' },
  { id: 'fifty-questions', name: 'Half Century', description: 'View 50 questions', icon: '5️⃣' },
  { id: 'hundred-questions', name: 'Century', description: 'View 100 questions', icon: '💯' },
  { id: 'all-topics', name: 'Well-Rounded', description: 'Attempt all 10 topics', icon: '🌍' },
  { id: 'streak-3', name: 'On a Roll', description: 'Maintain a 3-day streak', icon: '🔥' },
  { id: 'streak-7', name: 'Weekly Warrior', description: 'Maintain a 7-day streak', icon: '⚔️' },
  { id: 'streak-30', name: 'Monthly Master', description: 'Maintain a 30-day streak', icon: '📅' },
  { id: 'bookmark-5', name: 'Collector', description: 'Bookmark 5 questions', icon: '⭐' },
  { id: 'night-owl', name: 'Night Owl', description: 'Practice after 11pm', icon: '🦉', secret: true },
  { id: 'early-bird', name: 'Early Bird', description: 'Practice before 7am', icon: '🐦', secret: true },
  { id: 'speed-demon', name: 'Speed Demon', description: 'Complete a timed quiz with time left', icon: '⏱️' },
  { id: 'level-5', name: 'Halfway There', description: 'Reach level 5', icon: '🏔️' },
  { id: 'level-10', name: 'Legend', description: 'Reach level 10', icon: '🏆' },
  { id: 'mock-70', name: 'Exam Grade', description: 'Score 70%+ on a mock exam', icon: '📊' },
  { id: 'first-review', name: 'Spaced Out', description: 'Complete your first review session', icon: '🔁' },
  { id: 'review-50', name: 'Memory Athlete', description: 'Review 50 questions', icon: '🧩' },
  { id: 'mastered-10', name: 'Locked In', description: 'Master 10 questions through review', icon: '🔐' },
];

export function unlockAchievement(id: string): boolean {
  const data = getXPData();
  if (data.achievements.includes(id)) return false;
  data.achievements.push(id);
  saveXPData(data);
  return true;
}

export function getUnlockedAchievements(): string[] {
  return getXPData().achievements;
}

export function checkAndUnlockAchievements(context: {
  questionsViewed?: number;
  quizzesCompleted?: number;
  topicsAttempted?: number;
  currentStreak?: number;
  bookmarkCount?: number;
  level?: number;
  isPerfectQuiz?: boolean;
  isFirstQuiz?: boolean;
  isFirstMock?: boolean;
  isMock70?: boolean;
  isTimedQuizWithTimeLeft?: boolean;
  isFirstReview?: boolean;
  reviewsCompleted?: number;
  questionsMastered?: number;
}): string[] {
  const newlyUnlocked: string[] = [];

  const tryUnlock = (id: string, condition: boolean) => {
    if (condition && unlockAchievement(id)) newlyUnlocked.push(id);
  };

  tryUnlock('first-question', (context.questionsViewed ?? 0) >= 1);
  tryUnlock('fifty-questions', (context.questionsViewed ?? 0) >= 50);
  tryUnlock('hundred-questions', (context.questionsViewed ?? 0) >= 100);
  tryUnlock('first-quiz', context.isFirstQuiz === true);
  tryUnlock('ten-quizzes', (context.quizzesCompleted ?? 0) >= 10);
  tryUnlock('perfect-quiz', context.isPerfectQuiz === true);
  tryUnlock('all-topics', (context.topicsAttempted ?? 0) >= 10);
  tryUnlock('streak-3', (context.currentStreak ?? 0) >= 3);
  tryUnlock('streak-7', (context.currentStreak ?? 0) >= 7);
  tryUnlock('streak-30', (context.currentStreak ?? 0) >= 30);
  tryUnlock('bookmark-5', (context.bookmarkCount ?? 0) >= 5);
  tryUnlock('first-mock', context.isFirstMock === true);
  tryUnlock('mock-70', context.isMock70 === true);
  tryUnlock('level-5', (context.level ?? 0) >= 5);
  tryUnlock('level-10', (context.level ?? 0) >= 10);
  tryUnlock('speed-demon', context.isTimedQuizWithTimeLeft === true);
  tryUnlock('first-review', context.isFirstReview === true);
  tryUnlock('review-50', (context.reviewsCompleted ?? 0) >= 50);
  tryUnlock('mastered-10', (context.questionsMastered ?? 0) >= 10);

  // Time-based achievements
  const hour = new Date().getHours();
  tryUnlock('night-owl', hour >= 23 || hour < 4);
  tryUnlock('early-bird', hour >= 4 && hour < 7);

  return newlyUnlocked;
}

// ── Motivational messages ──
export function getMotivationalMessage(score: number): { emoji: string; message: string } {
  if (score === 100) {
    const msgs = [
      { emoji: '🎯', message: 'PERFECT SCORE! You absolutely smashed it!' },
      { emoji: '👑', message: 'Flawless! You\'re built different.' },
      { emoji: '🔥', message: '100%! That topic fears you now.' },
      { emoji: '💯', message: 'Full marks. Nothing more to say.' },
    ];
    return msgs[globalThis.Math.floor(globalThis.Math.random() * msgs.length)];
  }
  if (score >= 80) {
    const msgs = [
      { emoji: '⚡', message: 'Excellent work! Nearly perfect!' },
      { emoji: '💪', message: 'Strong performance! Keep this up!' },
      { emoji: '🌟', message: 'Impressive! You clearly know your stuff.' },
      { emoji: '🎉', message: 'Great score! The exam won\'t know what hit it.' },
    ];
    return msgs[globalThis.Math.floor(globalThis.Math.random() * msgs.length)];
  }
  if (score >= 60) {
    const msgs = [
      { emoji: '👍', message: 'Solid effort! A bit more practice and you\'ll nail it.' },
      { emoji: '📈', message: 'Good progress! You\'re heading in the right direction.' },
      { emoji: '💡', message: 'Not bad! Review the ones you missed and try again.' },
    ];
    return msgs[globalThis.Math.floor(globalThis.Math.random() * msgs.length)];
  }
  if (score >= 40) {
    const msgs = [
      { emoji: '🔄', message: 'Room to improve — check the worked solutions.' },
      { emoji: '📝', message: 'Keep going! Focus on the topics you found tricky.' },
      { emoji: '🧠', message: 'Every mistake is a lesson. You\'ve got this!' },
    ];
    return msgs[globalThis.Math.floor(globalThis.Math.random() * msgs.length)];
  }
  const msgs = [
    { emoji: '💪', message: 'Tough round — but now you know what to focus on!' },
    { emoji: '🌱', message: 'Everyone starts somewhere. Review and retry!' },
    { emoji: '📚', message: 'Check the concepts page for this topic, then try again.' },
  ];
  return msgs[globalThis.Math.floor(globalThis.Math.random() * msgs.length)];
}
