// ============================================
// QuizNova X — storage.js
// localStorage wrapper with error handling
// ============================================

const APP_KEY = "quiznovaX";
const STATE_KEY = `${APP_KEY}.state`;

// ---- Save: stringify + catch quota/security errors ----
function saveToLS(key, value) {
  try {
    const serialized = JSON.stringify(value);
    localStorage.setItem(key, serialized);
    return true;
  } catch (err) {
    if (err && err.name === "QuotaExceededError") {
      console.warn("[QuizNova] Storage quota exceeded for key:", key);
    } else {
      console.warn("[QuizNova] Failed to save key:", key, err);
    }
    return false;
  }
}

// ---- Load: parse + catch, return fallback on any failure ----
function loadFromLS(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (raw === null || raw === undefined) return fallback;
    return JSON.parse(raw);
  } catch (err) {
    console.warn("[QuizNova] Failed to load key:", key, err);
    return fallback;
  }
}

// ---- Clear every key owned by this app ----
function clearAllData() {
  try {
    const owned = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(APP_KEY)) owned.push(key);
    }
    owned.forEach((key) => localStorage.removeItem(key));
    return true;
  } catch (err) {
    console.warn("[QuizNova] Failed to clear app data:", err);
    return false;
  }
}

// ---- Export full state as a JSON string ----
function exportData() {
  try {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(APP_KEY)) {
        data[key] = JSON.parse(localStorage.getItem(key));
      }
    }
    return JSON.stringify(data, null, 2);
  } catch (err) {
    console.warn("[QuizNova] Export failed:", err);
    return "{}";
  }
}

// ---- Merge helper for import (nested objects merged, arrays replaced) ----
function mergeDeep(base, override) {
  if (Array.isArray(base) || Array.isArray(override)) {
    return Array.isArray(override) ? override.slice() : base;
  }
  if (
    base !== null && typeof base === "object" &&
    override !== null && typeof override === "object"
  ) {
    const out = { ...base };
    for (const key of Object.keys(override)) {
      out[key] = key in base ? mergeDeep(base[key], override[key]) : override[key];
    }
    return out;
  }
  return override === undefined ? base : override;
}

// ---- Import: parse + validate + merge into existing state ----
// Accepts either {"quiznovaX.state": {...}} (export format) or a bare state object.
function importData(jsonString) {
  try {
    if (typeof jsonString !== "string" || !jsonString.trim()) {
      console.warn("[QuizNova] Import aborted: empty input");
      return false;
    }
    const parsed = JSON.parse(jsonString);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("Root value must be a JSON object");
    }

    // Normalize into a map of { appKey: value }
    let incoming;
    const hasAppKeys = Object.keys(parsed).some((k) => k.startsWith(APP_KEY));
    if (hasAppKeys) {
      incoming = parsed;
    } else {
      // Bare state object → wrap under the state key
      incoming = { [STATE_KEY]: parsed };
    }

    // Read current owned values, then merge each incoming key over it
    const current = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(APP_KEY)) {
        current[key] = JSON.parse(localStorage.getItem(key));
      }
    }

    for (const [key, value] of Object.entries(incoming)) {
      if (!key.startsWith(APP_KEY)) continue;
      const merged = key in current ? mergeDeep(current[key], value) : value;
      localStorage.setItem(key, JSON.stringify(merged));
    }
    return true;
  } catch (err) {
    console.warn("[QuizNova] Import failed:", err);
    return false;
  }
}

export { APP_KEY, STATE_KEY, saveToLS, loadFromLS, clearAllData, exportData, importData };
