// ============================================
// QuizNova X — state.js
// Global app state + persistence via storage.js
// ============================================

import { saveToLS, loadFromLS, clearAllData, STATE_KEY } from "./storage.js";

// ---- Defaults (single source of truth) ----
const defaultState = {
  profile: {
    name: "Learner",
    avatar: "🧑‍🎓",
    avatarType: "preset", // preset | custom | initials | emoji
    presetAvatar: "gold-pioneer",
    customAvatar: null, // base64 image data
    initials: "MF",
    initialsBg: "gold", // gold | dark | emerald | amethyst
    avatarFrame: "gold-anvil", // gold-anvil | stealth-ring | pulse-glow | hexagon
    goal: "Study daily",
    level: 1,
    xp: 0,
    title: "Beginner Explorer",
  },
  streak: 0,
  bestStreak: 0,
  lastLogin: null,
  history: [],
  flashcardDecks: [],
  notes: [],
  studyMaterial: [],
  weakTopics: [],
  roadmap: null,
  mistakeJournal: [],
  summaryHistory: [],
  mindMaps: [],
  skillTree: null,
  achievements: {},
  titlesUnlocked: ["Beginner Explorer"],
  dailyChallenges: { date: null, goals: [], completed: [] },
  activityLog: [],
  xpHistory: [], // [{ timestamp, amount, total }] cumulative XP history
  studyMinutes: {}, // { "YYYY-MM-DD": minutes }
  deletedItems: [], // history entries removed for later restore
  materialUsage: {}, // { materialId: { quizzes, flashcards, summaries, mindmaps, notes } }
  settings: {
    theme: "dark",
    language: "English",
    showMascot: true,
    reducedMotion: false,
    soundEnabled: false,
    notifications: true,
    fontSize: "md", // sm | md | lg
    accentColor: "#C8A15A", // --primary Warm Gold default
    cardStyle: "gold-accent", // default | gold-accent | stealth-dark | glass-elevated
    cardRadius: "16", // 8 | 12 | 16 | 20
    cardDensity: "standard", // compact | standard | spacious
    cardAccentBar: "top-gold", // none | top-gold | left-gold | hover-glow
    cardHoverAnimation: "lift", // lift | scale | flat
    dailyGoalMinutes: 30,
    shortcutEnabled: true,
  },
};

// ---- Deep clone (structuredClone with JSON fallback) ----
function clone(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

// ---- Deep merge: fills in missing keys from defaults (migration), keeps saved values ----
function deepMerge(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return Array.isArray(override) ? override.slice() : base;
  }
  if (
    base !== null && typeof base === "object" &&
    override !== null && typeof override === "object"
  ) {
    const out = { ...base };
    for (const key of Object.keys(override)) {
      out[key] = key in base ? deepMerge(base[key], override[key]) : override[key];
    }
    return out;
  }
  return override === undefined ? base : override;
}

// ---- Live appState. ES module live binding: importers always see reassignments. ----
let appState = clone(defaultState);

// ---- Load from localStorage, merged over defaults ----
function loadState() {
  const saved = loadFromLS(STATE_KEY, null);
  appState = deepMerge(clone(defaultState), saved || {});
  return appState;
}

// ---- Persist current appState ----
function saveState() {
  if (!appState) return false;
  return saveToLS(STATE_KEY, appState);
}

// ---- Wipe and reload defaults ----
function resetState() {
  clearAllData();
  appState = clone(defaultState);
  saveState();
  return appState;
}

export { appState, defaultState, STATE_KEY, loadState, saveState, resetState, deepMerge, clone };
