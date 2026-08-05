// ============================================
// QuizNova X — progress.js
// Study time, daily goal, weekly/monthly stats,
// XP series helpers (Prompt 6: Progress Tracking)
// ============================================

import { appState, saveState } from "./state.js";

// ---- Local date key (YYYY-MM-DD) ----
function dateKey(ts = Date.now()) {
  const d = ts instanceof Date ? ts : new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

// ---- Add study minutes for today (round to 1 decimal) ----
function recordStudy(minutes, reason = "") {
  try {
    const m = Math.max(0, Number(minutes) || 0);
    if (m <= 0) return;
    appState.studyMinutes = appState.studyMinutes || {};
    const key = dateKey();
    appState.studyMinutes[key] = Math.round(((appState.studyMinutes[key] || 0) + m) * 10) / 10;
    if (reason && appState.activityLog) {
      appState.activityLog.push({ title: `Study · ${reason}`, timestamp: Date.now() });
      if (appState.activityLog.length > 50) appState.activityLog.splice(0, appState.activityLog.length - 50);
    }
    saveState();
  } catch (err) {
    console.warn("[QuizNova] recordStudy failed:", err);
  }
}

function todayStudyMinutes() {
  return appState.studyMinutes ? appState.studyMinutes[dateKey()] || 0 : 0;
}

function totalStudyHours() {
  const minutes = Object.values(appState.studyMinutes || {}).reduce((s, v) => s + v, 0);
  return Math.round((minutes / 60) * 10) / 10;
}

function dailyGoalMinutes() {
  return Math.max(1, Number(appState.settings && appState.settings.dailyGoalMinutes) || 30);
}

function dailyGoalProgress() {
  const goal = dailyGoalMinutes();
  const today = todayStudyMinutes();
  return { current: today, goal, percent: goal ? Math.min(100, Math.round((today / goal) * 100)) : 0 };
}

// ---- Aggregate across the last `days` ----
function aggregateDays(days = 7) {
  const now = new Date();
  const result = { activeDays: 0, minutes: 0, quizzes: 0, notes: 0, fcReviews: 0 };
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1)).getTime();
  const sm = appState.studyMinutes || {};
  for (let i = 0; i < days; i++) {
    const key = dateKey(start + i * 86400000);
    const mins = sm[key] || 0;
    if (mins > 0) result.activeDays++;
    result.minutes += mins;
  }
  for (const h of appState.history || []) if (h.date >= start) result.quizzes++;
  for (const n of appState.notes || []) if ((n.createdAt || 0) >= start) result.notes++;
  for (const deck of appState.flashcardDecks || []) {
    for (const c of deck.cards || []) if (c.lastReview && c.lastReview >= start) result.fcReviews++;
  }
  return result;
}

function weeklyStats() {
  return aggregateDays(7);
}

function monthlyStats() {
  return aggregateDays(30);
}

// ---- Cumulative XP series for charts ----
// Returns [{ label, total }] from xpHistory (falls back to activityLog XP entries).
function getXPSeries(days = 30) {
  const entries = (appState.xpHistory || []).slice();
  const now = Date.now();
  const cutoff = now - days * 86400000;
  const filtered = entries.filter((e) => e && e.timestamp >= cutoff);
  const sorted = filtered.sort((a, b) => a.timestamp - b.timestamp);
  return sorted.map((e) => ({
    label: dateKey(e.timestamp),
    total: Number(e.total) || 0,
    amount: Number(e.amount) || 0,
  }));
}

// ---- Weekly activity series (minutes + active days per week) ----
function getWeekSeries(weeks = 8) {
  const sm = appState.studyMinutes || {};
  const days = [];
  const today = new Date();
  for (let i = 0; i < weeks; i++) {
    const weekStart = today.getTime() - i * 7 * 86400000;
    let active = 0;
    let minutes = 0;
    for (let d = 6; d >= 0; d--) {
      const key = dateKey(weekStart - d * 86400000);
      const mins = sm[key] || 0;
      if (mins > 0) active++;
      minutes += mins;
    }
    days.push({ label: dateKey(weekStart), active, minutes });
  }
  return days.reverse();
}

// ---- Flashcard statistics across all decks ----
function flashcardStats() {
  let total = 0, mastered = 0, newCards = 0, learning = 0, reviews = 0;
  const now = Date.now();
  for (const deck of appState.flashcardDecks || []) {
    reviews += deck.reviews || 0;
    for (const c of deck.cards || []) {
      total++;
      if (c.mastered) mastered++;
      else if ((c.reviews || 0) === 0) newCards++;
      else learning++;
    }
  }
  const due = (() => {
    let d = 0;
    for (const deck of appState.flashcardDecks || []) {
      for (const c of deck.cards || []) {
        if (!c.mastered && c.nextReview && c.nextReview <= now) d++;
      }
    }
    return d;
  })();
  return { total, mastered, newCards, learning, reviews, due };
}

// ---- Achievement progress ----
function achievementProgress() {
  const total = Object.keys(appState.achievements || {}).length;
  return { unlocked: total };
}

export {
  recordStudy,
  todayStudyMinutes,
  totalStudyHours,
  dailyGoalMinutes,
  dailyGoalProgress,
  weeklyStats,
  monthlyStats,
  getXPSeries,
  getWeekSeries,
  flashcardStats,
  achievementProgress,
  dateKey,
};
