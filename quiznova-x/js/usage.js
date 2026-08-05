// ============================================
// QuizNova X — usage.js
// Material usage statistics (Prompt 6/7: Integration)
// Tracks how often each uploaded material drives
// quizzes, flashcards, summaries, mind maps and notes.
// ============================================

import { appState, saveState } from "./state.js";

export const USAGE_KEYS = ["quizzes", "flashcards", "summaries", "mindmaps", "notes"];
const MAX_TRACKED_MATERIALS = 100;

// ---- Record an action performed on a material ----
function trackUsage(materialId, action) {
  if (!materialId || !USAGE_KEYS.includes(action)) return;
  try {
    appState.materialUsage = appState.materialUsage || {};
    if (!appState.materialUsage[materialId]) {
      // Prune when the map grows too large to keep storage small.
      const keys = Object.keys(appState.materialUsage);
      if (keys.length >= MAX_TRACKED_MATERIALS) {
        delete appState.materialUsage[keys[0]];
      }
      appState.materialUsage[materialId] = {};
    }
    appState.materialUsage[materialId][action] =
      (appState.materialUsage[materialId][action] || 0) + 1;
    saveState();
  } catch (err) {
    console.warn("[QuizNova] trackUsage failed:", err);
  }
}

// ---- Usage per material (only materials with recorded activity) ----
function getMaterialUsage() {
  const out = [];
  for (const m of appState.studyMaterial || []) {
    const u = appState.materialUsage && appState.materialUsage[m.id];
    if (!u) continue;
    const total = USAGE_KEYS.reduce((s, k) => s + (u[k] || 0), 0);
    if (total <= 0) continue;
    out.push({
      id: m.id,
      name: m.name || "Untitled material",
      total,
      quizzes: u.quizzes || 0,
      flashcards: u.flashcards || 0,
      summaries: u.summaries || 0,
      mindmaps: u.mindmaps || 0,
      notes: u.notes || 0,
    });
  }
  return out.sort((a, b) => b.total - a.total).slice(0, 8);
}

// ---- Aggregate usage across all materials ----
function materialUsageTotals() {
  const list = getMaterialUsage();
  return {
    total: list.reduce((s, x) => s + x.total, 0),
    quizzes: list.reduce((s, x) => s + x.quizzes, 0),
    flashcards: list.reduce((s, x) => s + x.flashcards, 0),
    summaries: list.reduce((s, x) => s + x.summaries, 0),
    mindmaps: list.reduce((s, x) => s + x.mindmaps, 0),
    notes: list.reduce((s, x) => s + x.notes, 0),
  };
}

export { trackUsage, getMaterialUsage, materialUsageTotals };
