// ============================================
// QuizNova X — skilltree.js
// Visual learning tree: chapters from real progress,
// XP-based unlocks, mastery %, quiz/flashcard hooks
// (Prompt 6: Skill Tree)
// ============================================

import { appState, saveState } from "./state.js";
import { showToast, renderEmptyState } from "./ui.js";
import { escapeHTML, generateId, formatDate } from "./utils.js";
import { checkAchievements } from "./gamification.js";

const ICONS = ["fa-book-open", "fa-atom", "fa-dna", "fa-calculator", "fa-globe", "fa-code", "fa-brain", "fa-flask", "fa-pen-nib", "fa-microscope", "fa-music", "fa-chess"];
const SKILL_TEMPLATES = ["Fundamentals", "Core concepts", "Practice & application"];

// ============================================
// Build the tree from live app state
// ============================================

function chapterIcon(name) {
  let hash = 0;
  const s = String(name || "");
  for (let i = 0; i < s.length; i++) hash = (hash * 31 + s.charCodeAt(i)) >>> 0;
  return ICONS[hash % ICONS.length];
}

function buildChapters() {
  const map = new Map();
  const add = (name, icon, patch) => {
    const key = String(name || "").trim().toLowerCase();
    if (!key) return;
    if (!map.has(key)) {
      map.set(key, {
        name: String(name).trim(),
        icon: chapterIcon(name),
        quizzes: 0,
        accSum: 0,
        cards: 0,
        masteredCards: 0,
        decks: 0,
        reviews: 0,
      });
    }
    const c = map.get(key);
    Object.assign(c, patch);
  };

  for (const h of appState.history || []) {
    const topic = (h.topic || "").trim();
    if (!topic) continue;
    add(topic, chapterIcon(topic), {});
  }

  // Aggregate quiz stats per topic (accurate)
  const agg = new Map();
  for (const h of appState.history || []) {
    const key = String(h.topic || "").trim().toLowerCase();
    if (!key) continue;
    if (!agg.has(key)) agg.set(key, { name: h.topic, quizzes: 0, accSum: 0 });
    const a = agg.get(key);
    a.quizzes += 1;
    a.accSum += h.accuracy || 0;
  }
  for (const [key, a] of agg) {
    const c = map.get(key) || { name: a.name, icon: chapterIcon(a.name), quizzes: 0, accSum: 0, cards: 0, masteredCards: 0, decks: 0, reviews: 0 };
    c.quizzes = a.quizzes;
    c.accSum = a.accSum;
    map.set(key, c);
  }

  for (const d of appState.flashcardDecks || []) {
    const title = (d.title || "").trim();
    if (!title) continue;
    const cards = (d.cards || []).length;
    const mastered = (d.cards || []).filter((c) => c.mastered).length;
    const key = title.toLowerCase();
    const c = map.get(key) || { name: title, icon: chapterIcon(title), quizzes: 0, accSum: 0, cards: 0, masteredCards: 0, decks: 0, reviews: 0 };
    c.cards += cards;
    c.masteredCards += mastered;
    c.decks += 1;
    c.reviews += d.reviews || 0;
    map.set(key, c);
  }

  if (appState.roadmap && Array.isArray(appState.roadmap.days)) {
    for (const day of appState.roadmap.days) {
      const focus = (day.focus || "").trim();
      if (focus) add(focus, chapterIcon(focus), {});
    }
  }

  const chapters = [...map.values()]
    .filter((c) => c.quizzes > 0 || c.cards > 0)
    .map((c) => {
      const quizAcc = c.quizzes ? c.accSum / c.quizzes : 0;
      const fcMastery = c.cards ? (c.masteredCards / c.cards) * 100 : 0;
      const mastery = c.quizzes > 0 && c.cards > 0
        ? quizAcc * 0.6 + fcMastery * 0.4
        : c.quizzes > 0
          ? quizAcc
          : fcMastery;
      return {
        id: generateId(),
        name: c.name,
        icon: c.icon,
        mastery: Math.round(mastery),
        stats: {
          quizzes: c.quizzes,
          avgAccuracy: c.quizzes ? Math.round(quizAcc) : null,
          cards: c.cards,
          masteredCards: c.masteredCards,
          decks: c.decks,
        },
        skills: [],
      };
    })
    .sort((a, b) => b.mastery - a.mastery);

  if (!chapters.length) {
    chapters.push({
      id: generateId(),
      name: "Getting Started",
      icon: "fa-rocket",
      mastery: 0,
      stats: { quizzes: 0, avgAccuracy: null, cards: 0, masteredCards: 0, decks: 0 },
      skills: [],
    });
  }
  return chapters;
}

function buildSkillStatuses(chapters) {
  const xp = appState.profile.xp;
  const thresholds = [0, 80, 180, 320, 500, 720, 980, 1300, 1700, 2200];
  let currentFound = false;

  chapters.forEach((ch, i) => {
    ch.requiredXp = thresholds[i] !== undefined ? thresholds[i] : 2200 + (i - 9) * 400;
    const unlocked = xp >= ch.requiredXp;
    const done = unlocked && ch.mastery >= 60;
    if (done) {
      ch.status = "completed";
    } else if (unlocked) {
      ch.status = currentFound ? "unlocked" : "current";
      currentFound = true;
    } else {
      ch.status = "locked";
    }

    // Sub-skills from mistake journal topics + templates
    const mistakes = (appState.mistakeJournal || []).filter(
      (m) => (m.topic || "").toLowerCase() === ch.name.toLowerCase()
    );
    const skillNames = mistakes.length
      ? mistakes.slice(0, 3).map((m) => (m.question || m.topic || "Skill").slice(0, 28))
      : SKILL_TEMPLATES;
    ch.skills = skillNames.map((name, si) => {
      const sDone = done || (ch.status !== "locked" && ch.mastery >= 40 && si === 0);
      return {
        id: generateId(),
        name,
        mastery: ch.mastery,
        status: ch.status === "locked" ? "locked" : sDone ? "completed" : ch.status === "current" && si === 0 ? "current" : "unlocked",
      };
    });
  });
}

function buildSkillTree() {
  const chapters = buildChapters();
  buildSkillStatuses(chapters);
  const total = chapters.length;
  const completed = chapters.filter((c) => c.status === "completed").length;
  const masteryPct = total ? Math.round(chapters.reduce((s, c) => s + c.mastery, 0) / total) : 0;

  appState.skillTree = {
    builtAt: Date.now(),
    totalXp: appState.profile.xp,
    masteryPct,
    completed,
    total,
    chapters,
    nodes: chapters.map((c) => ({ id: c.id, name: c.name, icon: c.icon, mastery: c.mastery, status: c.status })),
  };
  saveState();
  checkAchievements(); // Skill Seeker
  return appState.skillTree;
}

// ============================================
// Rendering
// ============================================

function statusBadge(status) {
  if (status === "completed") return '<span class="badge badge-success">Completed</span>';
  if (status === "current") return '<span class="badge badge-primary">Current</span>';
  if (status === "unlocked") return '<span class="badge badge-info">Unlocked</span>';
  return '<span class="badge badge-warning">Locked</span>';
}

function renderSkilltree() {
  const view = document.getElementById("view-skilltree");
  if (!view) return;

  const hasProgress =
    (appState.history || []).length > 0 ||
    (appState.flashcardDecks || []).length > 0 ||
    appState.roadmap ||
    (appState.mistakeJournal || []).length > 0;

  if (!hasProgress) {
    view.innerHTML = `
      <div class="view-section">
        <div class="view-heading"><h2>Skill Tree</h2></div>
        <div class="card" style="text-align:center;padding:40px 20px;">
          <i class="fa-solid fa-sitemap" style="font-size:3rem;color:var(--text-muted);opacity:.4;"></i>
          <div style="margin-top:12px;font-weight:600;">Your skill tree grows as you learn</div>
          <p class="card-subtitle" style="max-width:420px;margin:8px auto 16px;">Take a quiz, review flashcards or build a roadmap and your chapters will unlock here automatically.</p>
          <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-primary btn-sm" data-nav="quiz"><i class="fa-solid fa-list-check"></i> Take a quiz</button>
            <button class="btn btn-ghost btn-sm" data-nav="flashcards"><i class="fa-solid fa-layer-group"></i> Review flashcards</button>
            <button class="btn btn-ghost btn-sm" data-nav="roadmap"><i class="fa-solid fa-map"></i> Build a roadmap</button>
          </div>
        </div>
      </div>`;
    view.querySelectorAll("[data-nav]").forEach((btn) => btn.addEventListener("click", () => window.nav(btn.dataset.nav)));
    return;
  }

  const tree = buildSkillTree();

  view.innerHTML = `
    <div class="view-section">
      <div class="view-heading">
        <h2>Skill Tree</h2>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <span class="badge badge-success">${tree.completed} completed</span>
          <span class="badge badge-primary">${tree.total} chapters</span>
        </div>
      </div>

      <div class="card" style="margin-bottom:18px;">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <strong style="font-size:.95rem;">Overall mastery</strong>
          <span style="font-size:1.3rem;font-weight:700;color:var(--primary);">${tree.masteryPct}%</span>
        </div>
        <div class="progress-bar" style="margin-top:10px;"><div class="progress-fill" style="width:${tree.masteryPct}%"></div></div>
        <div class="st-legend" style="display:flex;gap:14px;flex-wrap:wrap;margin-top:12px;">
          <span class="st-dot st-dot-completed"></span> Completed
          <span class="st-dot st-dot-current"></span> Current
          <span class="st-dot st-dot-unlocked"></span> Unlocked
          <span class="st-dot st-dot-locked"></span> Locked
        </div>
      </div>

      <div class="st-tree">
        ${tree.chapters.map(chapterHTML).join("")}
      </div>

      <p style="font-size:.75rem;color:var(--text-muted);text-align:center;margin-top:14px;">
        Unlock chapters by earning XP · boost mastery with quizzes &amp; flashcards · last updated ${formatDate(tree.builtAt)}
      </p>
    </div>
  `;

  view.querySelectorAll("[data-nav]").forEach((btn) => btn.addEventListener("click", () => window.nav(btn.dataset.nav)));
  view.querySelectorAll("[data-st-quiz]").forEach((btn) => {
    btn.addEventListener("click", () => {
      window.quiznovaContext = window.quiznovaContext || {};
      window.quiznovaContext.skilltree = true;
      window.quiznovaContext.topic = btn.dataset.stQuiz;
      window.nav("quiz");
    });
  });
  view.querySelectorAll("[data-st-flashcards]").forEach((btn) => {
    btn.addEventListener("click", () => {
      showToast("Open your flashcard decks to review this chapter.", "info");
      window.nav("flashcards");
    });
  });
}

function chapterHTML(ch) {
  const s = ch.stats || {};
  const isLocked = ch.status === "locked";
  return `
    <div class="st-chapter ${ch.status}" data-id="${ch.id}">
      <div class="st-chapter-line"></div>
      <div class="st-chapter-node ${ch.status}"><i class="fa-solid ${escapeHTML(ch.icon)}"></i></div>
      <div class="card st-chapter-card" style="${isLocked ? "opacity:.72;" : ""}">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap;">
          <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap;">
            <strong style="font-size:.95rem;">${escapeHTML(ch.name)}</strong>
            ${statusBadge(ch.status)}
            <span style="font-size:.72rem;color:var(--text-muted);">${ch.requiredXp} XP</span>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" data-st-quiz="${escapeHTML(ch.name)}" ${isLocked ? "disabled" : ""}><i class="fa-solid fa-list-check"></i> Quiz</button>
            <button class="btn btn-ghost btn-sm" data-st-flashcards ${isLocked ? "disabled" : ""}><i class="fa-solid fa-layer-group"></i> Cards</button>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:12px;margin-top:12px;">
          <div class="progress-bar" style="flex:1;"><div class="progress-fill" style="width:${ch.mastery}%"></div></div>
          <span style="font-size:.8rem;font-weight:700;color:var(--primary);">${ch.mastery}%</span>
        </div>
        <p class="card-subtitle" style="margin-top:8px;">
          ${s.quizzes ? `${s.quizzes} quiz${s.quizzes > 1 ? "zes" : ""}` : ""}
          ${s.avgAccuracy !== null ? ` · ${s.avgAccuracy}% avg accuracy` : ""}
          ${s.cards ? ` · ${s.masteredCards}/${s.cards} cards mastered` : ""}
        </p>
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:10px;">
          ${ch.skills.map((sk) => `
            <span class="st-skill st-skill-${sk.status}"><i class="fa-solid ${sk.status === "completed" ? "fa-check" : sk.status === "locked" ? "fa-lock" : "fa-sparkles"}"></i> ${escapeHTML(sk.name)}</span>
          `).join("")}
        </div>
      </div>
    </div>`;
}

export { renderSkilltree, buildSkillTree, buildChapters };
