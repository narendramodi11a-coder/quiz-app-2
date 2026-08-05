// ============================================
// QuizNova X — mistakes.js
// Mistake journal: review, correct, re-quiz
// ============================================

import { appState, saveState } from "./state.js";
import {
  showToast,
  showModal,
  closeModal,
  confirmAction,
  renderEmptyState,
} from "./ui.js";
import { escapeHTML, escapeAttr, timeAgo } from "./utils.js";
import { addXP } from "./gamification.js";
import { startQuiz } from "./quiz.js";

const REVIEW_XP = 5;
const MAX_QUIZ_MISTAKES = 15;

let filters = { tab: "all", topic: "all", search: "" };

// ============================================
// Derived stats
// ============================================

function getWeakTopics(n = 5) {
  const counts = {};
  for (const m of appState.mistakeJournal || []) {
    const t = m.topic || "General";
    counts[t] = (counts[t] || 0) + 1;
  }
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([topic, count]) => ({ topic, count }));
}

// ============================================
// Journal view
// ============================================

function statTile(label, value, icon) {
  return `<div class="card stat-card">
    <span class="stat-value">${value}</span>
    <span class="stat-label"><i class="fa-solid fa-${icon}"></i> ${escapeHTML(label)}</span>
  </div>`;
}

function renderMistakes() {
  const view = document.getElementById("view-mistakes");
  if (!view) return;

  const journal = appState.mistakeJournal || [];
  const corrected = journal.filter((m) => m.corrected).length;
  const bookmarked = journal.filter((m) => m.bookmarked).length;
  const topics = [...new Set(journal.map((m) => m.topic).filter(Boolean))].sort();

  view.innerHTML = `
    <div class="view-section">
      <div class="view-heading">
        <h2>Mistake Journal</h2>
        <button class="btn btn-primary btn-sm" id="quizMistakesBtn" ${
          journal.length ? "" : "disabled"
        }><i class="fa-solid fa-rotate-right"></i> Quiz My Mistakes</button>
      </div>
      <div class="home-grid" style="margin-bottom:16px;">
        ${statTile("Total", journal.length, "book-open")}
        ${statTile("To Review", journal.length - corrected, "clock")}
        ${statTile("Corrected", corrected, "check")}
        ${statTile("Bookmarked", bookmarked, "star")}
      </div>
      ${
        journal.length
          ? `<div class="card" style="margin-bottom:16px;">
              <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
                <div style="display:flex;gap:6px;flex-wrap:wrap;">
                  ${[
                    ["all", "All"],
                    ["bookmarked", "Bookmarked"],
                    ["corrected", "Corrected"],
                  ]
                    .map(
                      ([key, label]) =>
                        `<button class="btn btn-sm ${
                          filters.tab === key ? "btn-primary" : "btn-ghost"
                        }" data-tab="${key}">${label}</button>`
                    )
                    .join("")}
                </div>
                <select class="select" id="mistakeTopic" style="width:auto;margin-left:auto;">
                  <option value="all">All topics</option>
                  ${topics
                    .map(
                      (t) =>
                        `<option value="${escapeAttr(t)}" ${
                          filters.topic === t ? "selected" : ""
                        }>${escapeHTML(t)}</option>`
                    )
                    .join("")}
                </select>
                <input class="input" id="mistakeSearch" placeholder="Search mistakes..." value="${escapeAttr(
                  filters.search
                )}" style="max-width:220px;">
              </div>
            </div>`
          : ""
      }
      <div id="mistakeList"></div>
    </div>`;

  view.querySelector("#quizMistakesBtn").addEventListener("click", quizMyMistakes);

  view.querySelectorAll("[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => {
      filters.tab = btn.dataset.tab;
      renderMistakes();
    });
  });

  const topicSel = view.querySelector("#mistakeTopic");
  if (topicSel) {
    topicSel.addEventListener("change", () => {
      filters.topic = topicSel.value;
      renderMistakes();
    });
  }

  const searchInput = view.querySelector("#mistakeSearch");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      filters.search = searchInput.value;
      renderMistakeList();
    });
  }

  renderMistakeList();
}

function filterJournal() {
  return (appState.mistakeJournal || []).filter((m) => {
    if (filters.tab === "bookmarked" && !m.bookmarked) return false;
    if (filters.tab === "corrected" && !m.corrected) return false;
    if (filters.topic !== "all" && m.topic !== filters.topic) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const hay = `${m.question || ""} ${m.correctAnswer || ""} ${m.topic || ""}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function renderMistakeList() {
  const listEl = document.getElementById("mistakeList");
  if (!listEl) return;

  const items = filterJournal();
  if (!items.length) {
    listEl.innerHTML = renderEmptyState(
      "fa-circle-check",
      "No mistakes match this filter — nice work!"
    );
    return;
  }

  listEl.innerHTML = items
    .map(
      (m) => `
      <div class="card" style="margin-bottom:12px;">
        <div style="display:flex;gap:12px;align-items:flex-start;">
          <input type="checkbox" class="mistake-check" data-mistake="${escapeAttr(
            m.id
          )}" title="Include in Quiz My Mistakes" style="width:17px;height:17px;margin-top:4px;accent-color:var(--primary);">
          <div style="flex:1;min-width:0;">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-bottom:6px;">
              <span class="tag">${escapeHTML(m.topic || "General")}</span>
              ${
                m.corrected
                  ? '<span class="badge badge-success">corrected</span>'
                  : '<span class="badge badge-danger">to review</span>'
              }
              <span class="card-subtitle" style="font-size:.75rem;">${timeAgo(m.date)}</span>
            </div>
            <h4 style="font-size:.95rem;margin-bottom:6px;">${escapeHTML(m.question)}</h4>
            <div style="font-size:.82rem;line-height:1.5;color:var(--text-muted);">
              <div>Your answer: <span style="color:var(--danger);">${escapeHTML(
                m.userAnswer || "No answer"
              )}</span></div>
              <div>Correct: <span style="color:var(--secondary);">${escapeHTML(
                m.correctAnswer || "—"
              )}</span></div>
              ${m.explanation ? `<div style="margin-top:4px;">💡 ${escapeHTML(m.explanation)}</div>` : ""}
            </div>
          </div>
          <div style="display:flex;flex-direction:column;gap:6px;">
            <button class="btn btn-ghost btn-sm" data-bookmark="${escapeAttr(
              m.id
            )}" title="Bookmark" style="color:${m.bookmarked ? "var(--warning)" : ""};">
              <i class="fa-solid fa-star${m.bookmarked ? "" : "-o"}"></i>
            </button>
            ${
              m.corrected
                ? ""
                : `<button class="btn btn-success btn-sm" data-review="${escapeAttr(
                    m.id
                  )}" title="Mark reviewed (+5 XP)"><i class="fa-solid fa-check"></i></button>`
            }
            <button class="btn btn-ghost btn-sm" data-delete="${escapeAttr(
              m.id
            )}" title="Delete"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>`
    )
    .join("");

  listEl.querySelectorAll("[data-bookmark]").forEach((btn) => {
    btn.addEventListener("click", () => toggleBookmark(btn.dataset.bookmark));
  });
  listEl.querySelectorAll("[data-review]").forEach((btn) => {
    btn.addEventListener("click", () => markReviewed(btn.dataset.review));
  });
  listEl.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteMistake(btn.dataset.delete));
  });
}

// ============================================
// Mistake actions
// ============================================

function toggleBookmark(id) {
  const m = appState.mistakeJournal.find((x) => x.id === id);
  if (!m) return;
  m.bookmarked = !m.bookmarked;
  saveState();
  renderMistakes();
}

function markReviewed(id) {
  const m = appState.mistakeJournal.find((x) => x.id === id);
  if (!m || m.corrected) return;
  m.corrected = true;
  m.reviewedAt = Date.now();
  saveState();
  addXP(REVIEW_XP, "Mistake reviewed");
  showToast("Mistake marked as reviewed. +5 XP", "success");
  renderMistakes();
}

async function deleteMistake(id) {
  const m = appState.mistakeJournal.find((x) => x.id === id);
  if (!m) return;
  const ok = await confirmAction("Delete this mistake from your journal?");
  if (!ok) return;
  appState.mistakeJournal = appState.mistakeJournal.filter((x) => x.id !== id);
  saveState();
  showToast("Mistake deleted.", "info");
  renderMistakes();
}

// ============================================
// Quiz My Mistakes (no AI — replay stored MCQs)
// ============================================

function buildQuestionsFromMistakes(list) {
  return list.map((m) => ({
    type: "mcq",
    q: m.question || "?",
    options:
      Array.isArray(m.options) && m.options.length >= 2 ? m.options : ["True", "False"],
    ans:
      typeof m.ans === "number" && Array.isArray(m.options) && m.ans < m.options.length
        ? m.ans
        : 0,
    exp: m.explanation || m.correctAnswer || "",
    topicTag: m.topic || "General",
    sourceId: m.id,
  }));
}

function quizMyMistakes() {
  const journal = appState.mistakeJournal || [];
  if (!journal.length) {
    showToast("No mistakes in your journal yet.", "warning");
    return;
  }
  const sorted = [...journal].sort((a, b) => (a.date || 0) - (b.date || 0));
  const options = sorted
    .map(
      (m) => `<label style="display:flex;gap:10px;align-items:flex-start;padding:6px 0;cursor:pointer;">
        <input type="checkbox" class="mistake-pick" value="${escapeAttr(
          m.id
        )}" style="width:16px;height:16px;margin-top:2px;accent-color:var(--primary);">
        <span style="flex:1;min-width:0;">
          <span style="display:block;font-size:.85rem;line-height:1.4;">${escapeHTML(
            m.question
          )}</span>
          <span class="tag" style="margin-top:3px;">${escapeHTML(m.topic || "General")}</span>
        </span>
      </label>`
    )
    .join("");

  showModal(
    "Quiz My Mistakes",
    `<p class="card-subtitle" style="margin-bottom:8px;">Pick up to ${MAX_QUIZ_MISTAKES} mistakes to replay as a practice quiz.</p>
     <div style="max-height:340px;overflow-y:auto;">${options}</div>`,
    [
      { label: "Cancel", class: "btn-ghost", onClick: () => closeModal() },
      { label: "Start Quiz", class: "btn-primary", onClick: () => startMistakesQuiz() },
    ]
  );

  const root = document.getElementById("modalRoot");
  root.querySelectorAll(".mistake-pick").forEach((cb) => {
    cb.addEventListener("change", () => {
      const picked = root.querySelectorAll(".mistake-pick:checked");
      if (picked.length > MAX_QUIZ_MISTAKES) {
        cb.checked = false;
        showToast(`You can select at most ${MAX_QUIZ_MISTAKES} mistakes.`, "warning");
      }
    });
  });
}

function startMistakesQuiz() {
  const root = document.getElementById("modalRoot");
  const pickedIds = [...root.querySelectorAll(".mistake-pick:checked")].map((c) => c.value);
  if (!pickedIds.length) {
    showToast("Select at least one mistake.", "warning");
    return;
  }
  const mistakes = pickedIds
    .map((id) => appState.mistakeJournal.find((m) => m.id === id))
    .filter(Boolean);
  const questions = buildQuestionsFromMistakes(mistakes);
  closeModal();

  startQuiz(questions, {
    source: "mistakes",
    topic: "My Mistakes",
    difficulty: "Medium",
    mode: "Practice",
    type: "mcq",
    count: questions.length,
    timerSeconds: 0,
    language: appState.settings.language || "English",
    onCorrect: (q) => markCorrectFromQuiz(q),
  });
  window.nav("quiz");
}

// Called by quiz.js when a mistakes-sourced question is answered correctly.
function markCorrectFromQuiz(q) {
  const m = q && q.sourceId ? appState.mistakeJournal.find((x) => x.id === q.sourceId) : null;
  if (m && !m.corrected) {
    m.corrected = true;
    m.reviewedAt = Date.now();
    saveState();
  }
}

export {
  renderMistakes,
  markReviewed,
  toggleBookmark,
  deleteMistake,
  quizMyMistakes,
  buildQuestionsFromMistakes,
  markCorrectFromQuiz,
  getWeakTopics,
  filterJournal,
  MAX_QUIZ_MISTAKES,
  REVIEW_XP,
};
