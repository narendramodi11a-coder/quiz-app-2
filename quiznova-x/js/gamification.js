// ============================================
// QuizNova X — gamification.js
// XP & levels, titles, achievements, daily challenges
// ============================================

import { appState, saveState } from "./state.js";
import { shuffleArray } from "./utils.js";
import { showToast } from "./ui.js";
import { mascot } from "./mascot.js";
import { burstConfetti } from "./confetti.js";

// ---- XP & leveling constants ----
const XP_PER_LEVEL = 150;
const MAX_ACTIVITY_LOG = 50;
const MAX_XP_HISTORY = 200;

// ---- Local date key (YYYY-MM-DD) ----
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ---- Notify app.js to refresh the current view ----
function dispatchUpdate() {
  try {
    window.dispatchEvent(new CustomEvent("quiznova:statechange"));
  } catch (_) {
    // no-op outside a browser
  }
}

// ---- Derived stats helpers (shared by titles/achievements) ----
function averageAccuracy(s) {
  const history = s.history || [];
  if (!history.length) return 0;
  return history.reduce((sum, h) => sum + (h.accuracy || 0), 0) / history.length;
}

function uniqueTopics(s) {
  return new Set((s.history || []).map((h) => h.topic).filter(Boolean)).size;
}

function totalFCReviews(s) {
  let total = 0;
  for (const deck of s.flashcardDecks || []) {
    total += deck.reviews || 0;
    for (const card of deck.cards || []) {
      total += card.reviews || card.reviewCount || 0;
    }
  }
  return total;
}

// ============================================
// XP & Leveling
// ============================================

// Level L is reached once 150 * (1 + 2 + ... + (L-1)) XP is earned.
function getLevel(xp) {
  let level = 1;
  let remaining = Math.max(0, xp);
  while (remaining >= level * XP_PER_LEVEL) {
    remaining -= level * XP_PER_LEVEL;
    level++;
  }
  return level;
}

// Progress toward the NEXT level.
function getXPProgress(xp) {
  const level = getLevel(xp);
  let spent = 0;
  for (let l = 1; l < level; l++) spent += l * XP_PER_LEVEL;
  const current = xp - spent;
  const needed = level * XP_PER_LEVEL;
  const percent = needed > 0 ? Math.min(100, Math.round((current / needed) * 100)) : 0;
  return { current, needed, percent };
}

function addXP(amount, reason = "") {
  const prevLevel = appState.profile.level;
  appState.profile.xp += Math.max(0, amount);

  const newLevel = getLevel(appState.profile.xp);
  appState.profile.level = newLevel;

  if (newLevel > prevLevel) {
    showToast(`Level Up! 🎉 You reached level ${newLevel}`, "success", 4000);
    mascot.react("celebrating");
    burstConfetti(140);
  }

  if (reason) {
    appState.activityLog.push({
      title: `+${amount} XP — ${reason}`,
      timestamp: Date.now(),
    });
    if (appState.activityLog.length > MAX_ACTIVITY_LOG) {
      appState.activityLog.splice(0, appState.activityLog.length - MAX_ACTIVITY_LOG);
    }
  }

  // XP history (cumulative) for the XP growth chart
  appState.xpHistory = appState.xpHistory || [];
  appState.xpHistory.push({ timestamp: Date.now(), amount: Math.max(0, amount), total: appState.profile.xp });
  if (appState.xpHistory.length > MAX_XP_HISTORY) {
    appState.xpHistory.splice(0, appState.xpHistory.length - MAX_XP_HISTORY);
  }

  saveState();
  evaluateTitles();
  checkAchievements();
  return newLevel;
}

// ---- Record an important action in the activity log (no XP) ----
function logActivity(title, source = "") {
  try {
    appState.activityLog = appState.activityLog || [];
    appState.activityLog.push({ title: source ? `${source} · ${title}` : title, timestamp: Date.now() });
    if (appState.activityLog.length > MAX_ACTIVITY_LOG) {
      appState.activityLog.splice(0, appState.activityLog.length - MAX_ACTIVITY_LOG);
    }
    saveState();
  } catch (err) {
    console.warn("[QuizNova] logActivity failed:", err);
  }
}

// ============================================
// Titles
// ============================================

const TITLES = [
  { name: "Beginner Explorer", icon: "🎒", req: (s) => true },
  { name: "Quiz Rookie", icon: "🎯", req: (s) => s.history.length >= 1 },
  { name: "Curious Learner", icon: "🔍", req: (s) => s.history.length >= 5 },
  {
    name: "Fast Thinker",
    icon: "⚡",
    req: (s) => s.history.some((h) => h.time < 60 && h.accuracy > 80),
  },
  { name: "Knowledge Seeker", icon: "📖", req: (s) => s.history.length >= 10 },
  { name: "Accuracy Hunter", icon: "🧲", req: (s) => averageAccuracy(s) >= 85 },
  { name: "Consistency Builder", icon: "🏗️", req: (s) => s.bestStreak >= 5 },
  { name: "Topic Tamer", icon: "🐯", req: (s) => uniqueTopics(s) >= 5 },
  { name: "Flashcard Ninja", icon: "🥷", req: (s) => totalFCReviews(s) >= 50 },
  { name: "Roadmap Runner", icon: "🗺️", req: (s) => s.roadmap && s.roadmap.completed },
  { name: "Insight Collector", icon: "💡", req: (s) => s.notes.length >= 5 },
  { name: "Deep Thinker", icon: "🧠", req: (s) => s.history.length >= 25 },
  { name: "Scholar in Motion", icon: "🏃", req: (s) => s.bestStreak >= 10 },
  {
    name: "Quiz Strategist",
    icon: "♟️",
    req: (s) => s.history.filter((h) => h.mode === "Exam").length >= 5,
  },
  { name: "Memory Architect", icon: "🧱", req: (s) => totalFCReviews(s) >= 200 },
  { name: "Study Commander", icon: "🪖", req: (s) => s.profile.level >= 10 },
  { name: "Master Analyst", icon: "📊", req: (s) => averageAccuracy(s) >= 90 },
  { name: "Knowledge Master", icon: "🏆", req: (s) => s.profile.level >= 15 },
  { name: "Grand Scholar", icon: "🎓", req: (s) => s.bestStreak >= 30 },
  { name: "Legendary Mind", icon: "🌟", req: (s) => s.profile.level >= 20 },
  { name: "Nova Sage", icon: "✨", req: (s) => s.mindMaps.length >= 3 },
  {
    name: "Titan of Learning",
    icon: "🛡️",
    req: (s) => s.profile.level >= 25 && s.bestStreak >= 30,
  },
];

function evaluateTitles() {
  const newly = [];
  for (const t of TITLES) {
    if (!appState.titlesUnlocked.includes(t.name) && t.req(appState)) {
      appState.titlesUnlocked.push(t.name);
      newly.push(t);
    }
  }

  if (newly.length) {
    saveState();
    newly.forEach((t) => showToast(`Title unlocked: ${t.icon} ${t.name}`, "success", 4000));
    mascot.react("celebrating");
    burstConfetti(110);
    dispatchUpdate();
  }

  const current = getCurrentTitle();
  if (current && current !== appState.profile.title) {
    appState.profile.title = current;
    saveState();
    dispatchUpdate();
  }
}

function getCurrentTitle() {
  for (let i = TITLES.length - 1; i >= 0; i--) {
    if (appState.titlesUnlocked.includes(TITLES[i].name)) return TITLES[i].name;
  }
  return appState.titlesUnlocked[0] || TITLES[0].name;
}

function getTitleGallery() {
  return TITLES.map((t) => ({
    name: t.name,
    icon: t.icon,
    unlocked: appState.titlesUnlocked.includes(t.name),
  }));
}

// ============================================
// Achievements
// ============================================

const ACHIEVEMENTS = {
  firstQuiz: { name: "First Steps", icon: "🎯", check: (s) => s.history.length >= 1 },
  fiveQuizzes: { name: "Quiz Fan", icon: "🎮", check: (s) => s.history.length >= 5 },
  tenQuizzes: { name: "Quiz Pro", icon: "🏆", check: (s) => s.history.length >= 10 },
  fiftyQuizzes: { name: "Quiz Master", icon: "👑", check: (s) => s.history.length >= 50 },
  first90: {
    name: "Sharp Mind",
    icon: "🧠",
    check: (s) => s.history.some((h) => h.accuracy >= 90),
  },
  first100: {
    name: "Perfect Score",
    icon: "💯",
    check: (s) => s.history.some((h) => h.accuracy === 100),
  },
  streak5: { name: "5-Day Warrior", icon: "🔥", check: (s) => s.bestStreak >= 5 },
  streak10: { name: "10-Day Champion", icon: "⚡", check: (s) => s.bestStreak >= 10 },
  streak30: { name: "30-Day Legend", icon: "🌟", check: (s) => s.bestStreak >= 30 },
  firstRoadmap: { name: "Path Finder", icon: "🗺️", check: (s) => !!s.roadmap },
  roadmapDone: { name: "Journey Complete", icon: "🏁", check: (s) => s.roadmap?.completed },
  firstSummary: { name: "Summarizer", icon: "📝", check: (s) => s.summaryHistory.length >= 1 },
  firstNote: { name: "Note Taker", icon: "📓", check: (s) => s.notes.length >= 1 },
  fc100: { name: "Card Master", icon: "🎴", check: (s) => totalFCReviews(s) >= 100 },
  correct50: {
    name: "Mistake Crusher",
    icon: "💪",
    check: (s) => s.mistakeJournal.filter((m) => m.corrected).length >= 50,
  },
  level5: { name: "Rising Star", icon: "⭐", check: (s) => s.profile.level >= 5 },
  level10: { name: "Scholar", icon: "🎓", check: (s) => s.profile.level >= 10 },
  level20: { name: "Sage", icon: "🧙", check: (s) => s.profile.level >= 20 },
  skillTree: { name: "Skill Seeker", icon: "🌳", check: (s) => !!s.skillTree },
  mindMap: { name: "Mind Mapper", icon: "🧩", check: (s) => s.mindMaps.length >= 1 },
};

function checkAchievements() {
  const newly = [];
  for (const [id, ach] of Object.entries(ACHIEVEMENTS)) {
    if (!appState.achievements[id] && ach.check(appState)) {
      appState.achievements[id] = {
        name: ach.name,
        icon: ach.icon,
        unlockedAt: Date.now(),
      };
      newly.push(ach);
    }
  }

  if (newly.length) {
    saveState();
    newly.forEach((a) => showToast(`Achievement unlocked: ${a.icon} ${a.name}`, "success", 4000));
    mascot.react("celebrating");
    burstConfetti(100);
    dispatchUpdate();
  }
}

function getAchievementStats() {
  const total = Object.keys(ACHIEVEMENTS).length;
  const unlocked = Object.keys(appState.achievements).length;
  return {
    unlocked,
    total,
    percent: total ? Math.round((unlocked / total) * 100) : 0,
  };
}

// ============================================
// Daily Challenges
// ============================================

const CHALLENGE_POOL = [
  { id: "quiz", text: "Complete 1 quiz" },
  { id: "flashcards", text: "Review 5 flashcards" },
  { id: "note", text: "Save 1 note" },
  { id: "summarize", text: "Summarize 1 text" },
  { id: "roadmap", text: "Complete 1 roadmap task" },
];

function generateDailyChallenges() {
  const dc = appState.dailyChallenges;
  const picked = shuffleArray(CHALLENGE_POOL).slice(0, 3);
  dc.date = todayKey();
  dc.goals = picked.map((c) => ({ id: c.id, text: c.text, completed: false }));
  dc.completed = [];
  saveState();
  return dc;
}

// Regenerate if the stored date is not today. Returns true when regenerated.
function checkDailyReset() {
  const dc = appState.dailyChallenges;
  if (!dc || dc.date !== todayKey()) {
    generateDailyChallenges();
    return true;
  }
  // Normalize legacy string-only goals into objects
  if (Array.isArray(dc.goals) && dc.goals.some((g) => typeof g === "string")) {
    dc.goals = dc.goals.map((g) =>
      typeof g === "string"
        ? { id: g.toLowerCase().replace(/[^a-z0-9]/g, ""), text: g, completed: false }
        : g
    );
    dc.completed = dc.completed || [];
    saveState();
  }
  return false;
}

function completeChallenge(id) {
  const dc = appState.dailyChallenges;
  if (!dc || dc.date !== todayKey()) generateDailyChallenges();

  const goal = (dc.goals || []).find((g) => g.id === id);
  if (!goal || goal.completed) return false;

  goal.completed = true;
  if (!dc.completed.includes(id)) dc.completed.push(id);
  saveState();

  addXP(25, "Daily challenge completed");
  dispatchUpdate();
  return true;
}

// ============================================

export {
  XP_PER_LEVEL,
  addXP,
  logActivity,
  getLevel,
  getXPProgress,
  TITLES,
  evaluateTitles,
  getCurrentTitle,
  getTitleGallery,
  ACHIEVEMENTS,
  checkAchievements,
  getAchievementStats,
  CHALLENGE_POOL,
  generateDailyChallenges,
  checkDailyReset,
  completeChallenge,
  averageAccuracy,
  uniqueTopics,
  totalFCReviews,
};
