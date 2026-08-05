// ============================================
// QuizNova X — app.js (Entry Point)
// Bootstrap, navigation, theme, mobile menu
// ============================================

import * as Storage from "./storage.js";
import { appState, loadState, saveState, resetState, STATE_KEY } from "./state.js";
import * as Utils from "./utils.js";
import * as UI from "./ui.js";
import * as AI from "./ai.js";
import * as Gamification from "./gamification.js";
import { mascot } from "./mascot.js";
import { renderMaterial } from "./material.js";
import { renderNotes } from "./notes.js";
import { renderQuiz } from "./quiz.js";
import { renderFlashcards } from "./flashcards.js";
import { renderMistakes } from "./mistakes.js";
import { renderRoadmapUI, getNextTask } from "./roadmap.js";
import { renderTutor } from "./tutor.js";
import { renderHistory, renderProgress } from "./analytics.js";
import { renderSettings, applyReducedMotion, applyFontSize, applyAccentColor } from "./settings.js";
import { renderSummarizer } from "./summarizer.js";
import { renderMindmap } from "./mindmap.js";
import { renderSkilltree } from "./skilltree.js";
import { initSearch } from "./search.js";

// ---- View registry ----
const VIEW_TITLES = {
  home: "Home",
  profile: "Profile",
  material: "My Material",
  notes: "My Notes",
  quiz: "Create Quiz",
  flashcards: "Flashcards",
  roadmap: "Roadmap",
  tutor: "AI Tutor",
  summarizer: "Summarizer",
  mindmap: "Mind Maps",
  skilltree: "Skill Tree",
  mistakes: "Mistake Journal",
  history: "History",
  progress: "Progress",
  settings: "Settings",
};

// ---- Static content pools ----
const QUOTES = [
  "The expert in anything was once a beginner. 🌱",
  "Small steps every day lead to big results.",
  "Learning never exhausts the mind. — Leonardo da Vinci",
  "Knowledge is power. Share it and it multiplies.",
  "Don't watch the clock; do what it does. Keep going.",
  "The beautiful thing about learning is no one can take it away from you.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Curiosity is the wick in the candle of learning.",
  "Education is the most powerful weapon to change the world.",
  "Study while others sleep; work while others loaf.",
];

const AVATAR_EMOJIS = [
  "🧑‍🎓", "👨‍🎓", "👩‍🎓", "🦊", "🐼", "🦉", "🐯", "🤖",
  "🚀", "🐸", "🐙", "🦄", "😎", "🧙", "👑", "🌸",
];

// ---- Navigation state ----
let currentView = "home";
let viewStack = [];

// ---- Boot ----
async function init() {
  try {
    loadState();
    checkStreak();
    applyTheme();
    setupSidebarListeners();
    setupThemeToggle();
    setupBackButton();
    setupMobileMenu();
    setupStateListener();
    mascot.applySettings();

    const fresh = Gamification.checkDailyReset();
    if (fresh) UI.showToast("New daily challenges are available!", "success");

    applyReducedMotion();
    applyFontSize();
    applyAccentColor();
    initSearch();
    renderView("home");
  } catch (err) {
    console.error("[QuizNova] Init failed:", err);
    UI.showToast("Failed to initialize the app.", "error");
  }
}

// ---- Streak: compare lastLogin with today ----
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate()
  ).padStart(2, "0")}`;
}

function checkStreak() {
  const today = todayKey();
  const last = appState.lastLogin;

  if (!last) {
    appState.streak = 1;
  } else if (last !== today) {
    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayKey = `${yesterday.getFullYear()}-${String(
      yesterday.getMonth() + 1
    ).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    appState.streak = last === yesterdayKey ? appState.streak + 1 : 1;
  }
  // last === today → already counted for today, leave unchanged

  const streakGrew = !last || (appState.lastLogin !== today && appState.streak > 1);
  appState.bestStreak = Math.max(appState.bestStreak, appState.streak);
  appState.lastLogin = today;
  saveState();
  updateStreakBadge();

  if (streakGrew && appState.streak > 1) mascot.react("streak");
}

function updateStreakBadge() {
  const badge = document.getElementById("streakBadge");
  if (badge) badge.textContent = `🔥 ${appState.streak}`;
}

// ---- Theme ----
function applyTheme() {
  const theme = appState.settings.theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.querySelector("#themeToggle i");
  if (icon) {
    icon.className = theme === "light" ? "fa-solid fa-sun" : "fa-solid fa-moon";
  }
}

function toggleTheme() {
  appState.settings.theme = appState.settings.theme === "light" ? "dark" : "light";
  saveState();
  applyTheme();
  UI.showToast(
    `Theme switched to ${appState.settings.theme === "light" ? "light" : "dark"}.`,
    "info"
  );
}

// ---- Sidebar listeners ----
function setupSidebarListeners() {
  document.querySelectorAll(".nav-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.preventDefault();
      const viewId = item.dataset.view;
      if (viewId) nav(viewId);
    });
  });
  // Expose globally so inline onclick="nav('...')" in index.html still works
  window.nav = nav;
}

function setupThemeToggle() {
  const btn = document.getElementById("themeToggle");
  if (btn) btn.addEventListener("click", toggleTheme);
}

function setupBackButton() {
  const btn = document.getElementById("backBtn");
  if (btn) btn.addEventListener("click", goBack);
}

function setupMobileMenu() {
  const menuBtn = document.getElementById("menuBtn");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");

  if (menuBtn) {
    menuBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (sidebar) sidebar.classList.toggle("open");
      if (overlay) overlay.classList.toggle("show");
    });
  }
  if (overlay) {
    overlay.addEventListener("click", UI.closeMobileSidebar);
  }
}

// ---- Live refresh when state changes (XP, challenges, titles, etc.) ----
function setupStateListener() {
  window.addEventListener("quiznova:statechange", () => {
    if (currentView === "home") renderHome();
    updateStreakBadge();
  });
}

// ---- Navigation ----
function nav(viewId) {
  if (!VIEW_TITLES[viewId]) return;
  if (viewId === currentView) return;
  viewStack.push(currentView);
  renderView(viewId);
}

function goBack() {
  const previous = viewStack.pop() || "home";
  renderView(previous);
}

function renderView(viewId) {
  currentView = viewId;

  document.querySelectorAll(".view").forEach((v) => v.classList.remove("active"));
  const viewEl = document.getElementById(`view-${viewId}`);
  if (viewEl) viewEl.classList.add("active");

  document.querySelectorAll(".nav-item").forEach((item) => {
    item.classList.toggle("active", item.dataset.view === viewId);
  });

  UI.setViewTitle(VIEW_TITLES[viewId]);
  UI.closeMobileSidebar();
  updateBackButton();

  const renderFn = renderFunctions[viewId];
  if (renderFn) renderFn();
}

// ---- Shared render helpers ----
function statCard(icon, value, label) {
  return `<div class="card stat-card">
    <span class="stat-value">${Utils.escapeHTML(value)}</span>
    <span class="stat-label"><i class="fa-solid fa-${icon}"></i> ${Utils.escapeHTML(label)}</span>
  </div>`;
}

function recentActivityHTML() {
  const recent = appState.activityLog.slice(-3).reverse();
  if (!recent.length) return "";
  const items = recent
    .map(
      (a) => `<div class="timeline-card">
        <h4>${Utils.escapeHTML(a.title || "Activity")}</h4>
        <p>${Utils.timeAgo(a.timestamp || Date.now())}</p>
      </div>`
    )
    .join("");
  return `<div class="view-section">
    <div class="view-heading"><h2>Recent Activity</h2></div>
    ${items}
  </div>`;
}

// ---- Home data helpers ----
function pickQuote() {
  const day = Math.floor(Date.now() / 86400000);
  return QUOTES[day % QUOTES.length];
}

function countDueFlashcards() {
  const now = Date.now();
  let due = 0;
  for (const deck of appState.flashcardDecks) {
    for (const card of deck.cards || []) {
      if (card.nextReview && card.nextReview <= now) due++;
    }
  }
  return due;
}

function getWeakTopics(n = 3) {
  return (appState.weakTopics || [])
    .slice(0, n)
    .map((t) => (typeof t === "string" ? t : t.topic || t.name || "Unknown"));
}

function getNextRoadmapTask() {
  // Delegates to roadmap.js which understands both the new `days` structure
  // and legacy `tasks`/`nodes` shapes.
  return getNextTask();
}

function challengesHTML(challenges) {
  return challenges
    .map(
      (c) => `<label class="challenge-item" style="display:flex;align-items:center;gap:10px;padding:8px 0;cursor:pointer;">
        <input type="checkbox" ${c.completed ? "checked" : ""} data-challenge="${Utils.escapeAttr(
        c.id
      )}" style="width:18px;height:18px;accent-color:var(--primary);cursor:pointer;">
        <span style="text-decoration:${c.completed ? "line-through" : "none"};opacity:${c.completed ? 0.6 : 1};">${Utils.escapeHTML(c.text)}</span>
        <span class="badge badge-success" style="margin-left:auto;">+25 XP</span>
      </label>`
    )
    .join("");
}

// ---- renderHome ----
function renderHome() {
  const view = document.getElementById("view-home");
  if (!view) return;

  const p = appState.profile;
  const xp = Gamification.getXPProgress(p.xp);
  const due = countDueFlashcards();
  const pendingMistakes = appState.mistakeJournal.filter((m) => !m.corrected).length;
  const weakTopics = getWeakTopics(3);
  const nextTask = getNextRoadmapTask();
  const challenges = appState.dailyChallenges.goals || [];

  view.innerHTML = `
    <div class="home-hero">
      <h2>Hello, ${Utils.escapeHTML(p.name)}! 👋</h2>
      <p>${Utils.escapeHTML(pickQuote())}</p>
      <div class="hero-actions">
        <button class="btn btn-primary" data-nav="quiz"><i class="fa-solid fa-bolt"></i> Generate Quiz</button>
        <button class="btn btn-ghost" data-nav="flashcards"><i class="fa-solid fa-layer-group"></i> Review Flashcards</button>
        <button class="btn btn-ghost" data-nav="roadmap"><i class="fa-solid fa-map"></i> Continue Roadmap</button>
        <button class="btn btn-ghost" data-nav="tutor"><i class="fa-solid fa-robot"></i> Ask Tutor</button>
      </div>
    </div>

    <div class="home-grid">
      ${statCard("ranking-star", p.level, "Level")}
      ${statCard("coins", p.xp, `XP · ${xp.percent}% to level ${p.level + 1}`)}
      ${statCard("fire", appState.streak, "Day Streak")}
      ${statCard("clock", due, "Cards Due Today")}
    </div>

    <div class="home-grid" style="margin-top:18px;">
      <div class="card">
        <div class="card-title">Level Progress</div>
        <div class="progress-bar"><div class="progress-fill" style="width:${xp.percent}%"></div></div>
        <p class="card-subtitle" style="margin-top:8px;">${xp.current} / ${xp.needed} XP to level ${
    p.level + 1
  }</p>
      </div>
      <div class="card">
        <div class="card-title">Daily Challenges</div>
        ${
          challenges.length
            ? challengesHTML(challenges)
            : '<p class="card-subtitle">No challenges today.</p>'
        }
      </div>
    </div>

    ${
      weakTopics.length
        ? `<div class="card" style="margin-top:18px;">
            <div class="card-title">Weak Topics</div>
            <p class="card-subtitle">Focus on these to improve.</p>
            <div style="display:flex;flex-wrap:wrap;gap:8px;">${weakTopics
              .map((t) => `<span class="tag">⚠️ ${Utils.escapeHTML(t)}</span>`)
              .join("")}</div>
          </div>`
        : ""
    }

    ${
      nextTask
        ? `<div class="card" style="margin-top:18px;border-left:4px solid var(--primary);">
            <div class="card-title">Next on Your Roadmap</div>
            <p>${Utils.escapeHTML(nextTask.title || nextTask.name || "Next task")}</p>
            <button class="btn btn-primary btn-sm" data-nav="roadmap" style="margin-top:10px;">Continue Roadmap</button>
          </div>`
        : ""
    }

    <div class="home-grid" style="margin-top:18px;">
      ${statCard("book-open", pendingMistakes, "Mistakes to Review")}
      ${statCard("trophy", appState.bestStreak, "Best Streak")}
      ${statCard("note-sticky", appState.notes.length, "Notes Saved")}
      ${statCard("crown", p.title, "Current Title")}
    </div>

    <div class="card" style="margin-top:18px;text-align:center;color:var(--text-muted);font-size:.9rem;border-style:dashed;">
      💡 <em>Micro-tip:</em> A little review every day beats a big cram — spaced repetition wins.
    </div>

    ${recentActivityHTML()}
  `;

  view.querySelectorAll("[data-nav]").forEach((btn) => {
    btn.addEventListener("click", () => nav(btn.dataset.nav));
  });
  view.querySelectorAll("input[data-challenge]").forEach((cb) => {
    cb.addEventListener("change", () => {
      if (cb.checked) Gamification.completeChallenge(cb.dataset.challenge);
    });
  });
  updateStreakBadge();
}

// ---- renderProfile ----
function renderProfile() {
  const view = document.getElementById("view-profile");
  if (!view) return;

  const p = appState.profile;
  const xp = Gamification.getXPProgress(p.xp);
  const ach = Gamification.getAchievementStats();
  const avgAcc = Gamification.averageAccuracy(appState);
  const roadmaps = appState.roadmap ? 1 : 0;
  const titles = Gamification.getTitleGallery();

  view.innerHTML = `
    <div class="profile-header">
      <div id="profileAvatar" class="avatar avatar-xl" style="width:96px;height:96px;font-size:3rem;display:flex;align-items:center;justify-content:center;background:var(--card-bg);border:3px solid var(--primary);">${p.avatar}</div>
      <div style="flex:1;min-width:220px;">
        <div class="profile-name">${Utils.escapeHTML(p.name)}</div>
        <div class="profile-handle">${Utils.escapeHTML(p.title)} · Level ${p.level}</div>
        <div style="margin-top:14px;max-width:420px;">
          <label class="label" for="profileName">Display name</label>
          <input class="input" id="profileName" value="${Utils.escapeAttr(p.name)}" maxlength="30" autocomplete="off">
        </div>
        <div style="margin-top:10px;max-width:420px;">
          <label class="label" for="profileGoal">Learning goal</label>
          <input class="input" id="profileGoal" value="${Utils.escapeAttr(p.goal)}" maxlength="80" autocomplete="off">
        </div>
        <div style="margin-top:12px;">
          <span class="label">Avatar</span>
          <div style="display:flex;flex-wrap:wrap;gap:6px;">
            ${AVATAR_EMOJIS.map(
              (e) =>
                `<button type="button" class="avatar-option" data-avatar="${e}" aria-label="Choose avatar" style="width:44px;height:44px;font-size:1.4rem;border-radius:10px;border:2px solid var(--border);background:var(--bg);cursor:pointer;">${e}</button>`
            ).join("")}
          </div>
        </div>
      </div>
    </div>

    <div class="home-grid" style="margin-bottom:18px;">
      <div class="card">
        <div class="view-heading"><h2>Level Progress</h2><span class="badge badge-primary">Level ${p.level}</span></div>
        <div class="progress-bar"><div class="progress-fill" style="width:${xp.percent}%"></div></div>
        <p class="card-subtitle" style="margin-top:8px;">${xp.current} / ${xp.needed} XP to Level ${p.level + 1} · ${p.xp} XP total</p>
      </div>
      <div class="card">
        <div class="card-title">Achievements</div>
        <p class="card-subtitle">${ach.unlocked} of ${ach.total} unlocked (${ach.percent}%)</p>
        <div class="progress-bar"><div class="progress-fill" style="width:${ach.percent}%"></div></div>
      </div>
    </div>

    <div class="view-section">
      <div class="view-heading"><h2>Stats</h2></div>
      <div class="home-grid">
        ${statCard("list-check", appState.history.length, "Quizzes Taken")}
        ${statCard("bullseye", Math.round(avgAcc) + "%", "Avg Accuracy")}
        ${statCard("fire", appState.bestStreak, "Best Streak")}
        ${statCard("layer-group", Gamification.totalFCReviews(appState), "Cards Reviewed")}
        ${statCard("note-sticky", appState.notes.length, "Notes")}
        ${statCard("map", roadmaps, "Roadmaps")}
      </div>
    </div>

    <div class="view-section">
      <div class="view-heading"><h2>Titles</h2><span class="badge badge-primary">${appState.titlesUnlocked.length} / ${titles.length}</span></div>
      <div class="title-gallery">
        ${titles
          .map(
            (t) => `<div class="title-card ${t.unlocked ? "" : "locked"}">
              <span class="rarity">${t.unlocked ? "👑" : "🔒"}</span>
              <h3>${t.icon} ${Utils.escapeHTML(t.name)}</h3>
            </div>`
          )
          .join("")}
      </div>
    </div>

    <div class="view-section">
      <div class="view-heading"><h2>Achievements</h2><span class="badge badge-primary">${ach.unlocked} / ${ach.total}</span></div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:12px;">
        ${Object.entries(Gamification.ACHIEVEMENTS)
          .map(([id, a]) => {
            const unlocked = !!appState.achievements[id];
            return `<div class="card" style="text-align:center;padding:16px;opacity:${unlocked ? 1 : 0.45};filter:${unlocked ? "none" : "grayscale(1)"};">
              <div style="font-size:2rem;">${a.icon}</div>
              <div style="font-weight:600;font-size:.82rem;margin-top:6px;">${Utils.escapeHTML(a.name)}</div>
            </div>`;
          })
          .join("")}
      </div>
    </div>
  `;

  // ---- Editable profile fields ----
  const nameInput = view.querySelector("#profileName");
  if (nameInput) {
    nameInput.addEventListener("change", () => {
      p.name = nameInput.value.trim() || "Learner";
      saveState();
      view.querySelector(".profile-name").textContent = p.name;
      const mini = document.querySelector(".profile-mini-name");
      if (mini) mini.textContent = p.name;
      UI.showToast("Profile updated.", "success");
    });
  }

  const goalInput = view.querySelector("#profileGoal");
  if (goalInput) {
    goalInput.addEventListener("change", () => {
      p.goal = goalInput.value.trim();
      saveState();
      UI.showToast("Learning goal updated.", "success");
    });
  }

  const avatarOptions = view.querySelectorAll("[data-avatar]");
  const setAvatarActive = (btn, active) => {
    btn.style.borderColor = active ? "var(--primary)" : "var(--border)";
    btn.style.background = active ? "var(--active-bg)" : "var(--bg)";
  };
  avatarOptions.forEach((btn) => setAvatarActive(btn, btn.dataset.avatar === p.avatar));
  avatarOptions.forEach((btn) => {
    btn.addEventListener("click", () => {
      p.avatar = btn.dataset.avatar;
      saveState();
      const av = view.querySelector("#profileAvatar");
      if (av) av.textContent = p.avatar;
      avatarOptions.forEach((b) => setAvatarActive(b, b.dataset.avatar === btn.dataset.avatar));
      UI.showToast("Avatar updated.", "success");
    });
  });

  updateStreakBadge();
}

// ---- Renderer registry ----
const renderFunctions = {
  home: renderHome,
  profile: renderProfile,
  material: renderMaterial,
  notes: renderNotes,
  quiz: renderQuiz,
  flashcards: renderFlashcards,
  roadmap: renderRoadmapUI,
  tutor: renderTutor,
  summarizer: renderSummarizer,
  mindmap: renderMindmap,
  skilltree: renderSkilltree,
  mistakes: renderMistakes,
  history: renderHistory,
  progress: renderProgress,
  settings: renderSettings,
};

// ---- Back button visibility: only show when there's somewhere to go back to ----
function updateBackButton() {
  const btn = document.getElementById("backBtn");
  if (btn) btn.style.display = viewStack.length ? "" : "none";
}

// ---- Boot on DOM ready ----
window.addEventListener("DOMContentLoaded", init);
