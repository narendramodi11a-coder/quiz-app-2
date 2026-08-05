// ============================================
// QuizNova X — flashcards.js
// SM-2 spaced-repetition flashcard decks
// ============================================

import { appState, saveState } from "./state.js";
import { callGemini, buildPrompt, parseJSONResponse } from "./ai.js";
import {
  showToast,
  showLoader,
  hideLoader,
  showModal,
  closeModal,
  confirmAction,
  renderEmptyState,
} from "./ui.js";
import { escapeHTML, escapeAttr, generateId, formatDate } from "./utils.js";
import { addXP, checkAchievements, logActivity } from "./gamification.js";
import { trackUsage } from "./usage.js";
import { mascot } from "./mascot.js";

// ---- SM-2 tuning ----
const QUALITY_BY_RATING = { again: 0, hard: 2, good: 3, easy: 5 };
const REVIEW_XP = 2;
const DECK_FINISH_XP = 20;
const MASTERED_INTERVAL = 21;
const MAX_COUNT = 20;

let deckState = null;

// ============================================
// SM-2 algorithm
// ============================================

// quality: 0 (again) | 2 (hard) | 3 (good) | 5 (easy)
function sm2Update(card, quality) {
  if (quality < 3) {
    card.repetitions = 0;
    card.interval = 1;
  } else {
    if (card.repetitions === 0) card.interval = 1;
    else if (card.repetitions === 1) card.interval = 6;
    else card.interval = Math.round(card.interval * card.easeFactor);
    card.repetitions += 1;
  }
  card.easeFactor = Math.max(
    1.3,
    card.easeFactor + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02)
  );
  card.mastered = card.interval >= MASTERED_INTERVAL;
  card.lastReview = Date.now();
  card.nextReview = card.mastered ? null : Date.now() + card.interval * 86400000;
}

// ============================================
// Helpers
// ============================================

function getMaterialContext() {
  const ctx = window.quiznovaContext || {};
  const m = appState.studyMaterial.find((x) => x.id === ctx.materialId);
  return m || null;
}

function normalizeCard(c) {
  return {
    id: generateId(),
    question: String(c.question || c.q || "?").trim(),
    shortAnswer: String(c.shortAnswer || c.answer || c.a || "").trim(),
    explanation: String(c.explanation || "").trim(),
    example: String(c.example || "").trim(),
    takeaway: String(c.takeaway || "").trim(),
    interval: 0,
    easeFactor: 2.5,
    repetitions: 0,
    reviews: 0,
    mastered: false,
    lastReview: null,
    nextReview: Date.now(),
  };
}

function languageBadgesHTML(deck) {
  if (!deck.bilingual) return "";
  const lang = appState.settings.language || "English";
  return `<span class="badge badge-primary">EN</span><span class="badge badge-info">${escapeHTML(
    lang
  )}</span>`;
}

function deckStats(deck) {
  const cards = deck.cards || [];
  const now = Date.now();
  const due = cards.filter((c) => !c.mastered && c.nextReview && c.nextReview <= now).length;
  const mastered = cards.filter((c) => c.mastered).length;
  return { total: cards.length, due, mastered };
}

// Cards due first, then fresh cards, then the rest of the unfinished backlog.
function buildQueue(deck) {
  const now = Date.now();
  const due = deck.cards.filter((c) => !c.mastered && c.nextReview && c.nextReview <= now);
  const fresh = deck.cards.filter(
    (c) => !c.mastered && (c.reviews || 0) === 0 && !due.includes(c)
  );
  const other = deck.cards.filter((c) => !c.mastered && !due.includes(c) && !fresh.includes(c));
  due.sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0));
  return [...due, ...fresh, ...other];
}

function getDueFlashcards() {
  let due = 0;
  for (const deck of appState.flashcardDecks || []) {
    due += deckStats(deck).due;
  }
  return due;
}

// ============================================
// Deck list view
// ============================================

function renderFlashcards() {
  const view = document.getElementById("view-flashcards");
  if (!view) return;

  const decks = appState.flashcardDecks || [];
  const totalDue = getDueFlashcards();
  const material = getMaterialContext();

  if (!decks.length) {
    view.innerHTML = `
      <div class="view-section">
        <div class="view-heading">
          <h2>Flashcards</h2>
          <button class="btn btn-primary btn-sm" id="newDeckBtn"><i class="fa-solid fa-plus"></i> New Deck</button>
        </div>
        ${
          material
            ? `<div class="card" style="margin-bottom:16px;">
                <div class="card-title">Material source</div>
                <p class="card-subtitle">${escapeHTML(
                  material.name
                )} will be used to generate cards.</p>
              </div>`
            : ""
        }
        ${renderEmptyState("fa-layer-group", "No decks yet — create your first flashcard deck!")}
      </div>`;
    view.querySelector("#newDeckBtn").addEventListener("click", createDeckModal);
    return;
  }

  view.innerHTML = `
    <div class="view-section">
      <div class="view-heading">
        <h2>Flashcards</h2>
        <button class="btn btn-primary btn-sm" id="newDeckBtn"><i class="fa-solid fa-plus"></i> New Deck</button>
      </div>
      <p class="card-subtitle" style="margin-bottom:16px;">${totalDue} card${
    totalDue === 1 ? "" : "s"
  } due today · spaced repetition keeps them fresh.</p>
      <div class="flashcard-grid">
        ${decks
          .map((deck) => {
            const s = deckStats(deck);
            return `<div class="flashcard-thumb" data-deck="${escapeAttr(deck.id)}">
              <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">
                ${languageBadgesHTML(deck)}
                ${
                  s.due
                    ? `<span class="badge badge-warning">${s.due} due</span>`
                    : '<span class="badge badge-success">caught up</span>'
                }
              </div>
              <h4 style="margin-top:8px;">${escapeHTML(deck.title)}</h4>
              <p>${escapeHTML(deck.topic || "General")} · ${s.total} card${s.total === 1 ? "" : "s"}</p>
              <p>${s.mastered}/${s.total} mastered</p>
              <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="btn btn-primary btn-sm" data-review="${escapeAttr(
                  deck.id
                )}" style="flex:1;"><i class="fa-solid fa-play"></i> Review</button>
                <button class="btn btn-ghost btn-sm" data-delete="${escapeAttr(
                  deck.id
                )}" aria-label="Delete deck"><i class="fa-solid fa-trash"></i></button>
              </div>
            </div>`;
          })
          .join("")}
      </div>
    </div>`;

  view.querySelector("#newDeckBtn").addEventListener("click", createDeckModal);
  view.querySelectorAll("[data-review]").forEach((btn) => {
    btn.addEventListener("click", () => openDeck(btn.dataset.review));
  });
  view.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteDeck(btn.dataset.delete));
  });
}

// ============================================
// Deck creation
// ============================================

function createDeckModal() {
  const material = getMaterialContext();
  const prefillTopic = material ? material.name.replace(/\.[^.]+$/, "") : "";

  showModal(
    "New Flashcard Deck",
    `
    <form id="deckForm">
      <label class="label" for="deckTitle">Deck title</label>
      <input class="input" id="deckTitle" placeholder="e.g. World Capitals" maxlength="60" value="${escapeAttr(
        prefillTopic || ""
      )}">

      <label class="label" for="deckSource" style="margin-top:12px;">Source</label>
      <select class="select" id="deckSource">
        <option value="ai" ${material ? "" : "selected"}>Generate with AI</option>
        <option value="manual" ${material ? "selected" : ""}>Enter manually</option>
      </select>

      <div id="aiFields">
        <label class="label" for="deckTopic" style="margin-top:12px;">Topic</label>
        <input class="input" id="deckTopic" placeholder="e.g. World Capitals" maxlength="60" value="${escapeAttr(
          material ? prefillTopic : ""
        )}">

        <label class="label" for="deckCount" style="margin-top:12px;">Number of cards</label>
        <select class="select" id="deckCount">
          ${[5, 10, 15, 20].map((n) => `<option value="${n}" ${n === 10 ? "selected" : ""}>${n}</option>`).join("")}
        </select>

        <label class="toggle-row" style="display:flex;align-items:center;gap:10px;margin-top:14px;cursor:pointer;">
          <input type="checkbox" id="deckBilingual" style="width:16px;height:16px;accent-color:var(--primary);">
          <span>Bilingual cards (English + ${escapeHTML(appState.settings.language || "English")})</span>
        </label>
      </div>

      <div id="manualFields" class="hidden">
        <label class="label" for="deckManual" style="margin-top:12px;">Cards (one per line: <code>Question::Answer::Optional explanation</code>)</label>
        <textarea class="textarea" id="deckManual" rows="6" placeholder="Paris::Capital of France::Known for the Eiffel Tower"></textarea>
      </div>

      <button class="btn btn-primary btn-block" type="submit" style="margin-top:16px;">
        <i class="fa-solid fa-wand-magic-sparkles"></i> Create Deck
      </button>
    </form>`,
    [{ label: "Cancel", class: "btn-ghost", onClick: () => closeModal() }]
  );

  const root = document.getElementById("modalRoot");
  const sourceSel = root.querySelector("#deckSource");
  const aiFields = root.querySelector("#aiFields");
  const manualFields = root.querySelector("#manualFields");

  const syncSource = () => {
    const manual = sourceSel.value === "manual";
    aiFields.style.display = manual ? "none" : "";
    manualFields.style.display = manual ? "" : "none";
  };
  sourceSel.addEventListener("change", syncSource);
  syncSource();

  root.querySelector("#deckForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const title = root.querySelector("#deckTitle").value.trim();
    const source = sourceSel.value;
    if (!title) {
      showToast("Give your deck a title.", "warning");
      return;
    }
    if (source === "manual") {
      const text = root.querySelector("#deckManual").value;
      if (!text.trim()) {
        showToast("Enter at least one card.", "warning");
        return;
      }
      createManualDeck(title, text);
    } else {
      const config = {
        title,
        topic: root.querySelector("#deckTopic").value.trim() || title,
        count: Math.min(MAX_COUNT, Number(root.querySelector("#deckCount").value) || 10),
        bilingual: root.querySelector("#deckBilingual").checked,
      };
      generateFlashcards(config);
    }
  });
}

function createManualDeck(title, manualText) {
  const cards = [];
  for (const line of manualText.split(/\n+/)) {
    const parts = line.split("::").map((s) => s.trim());
    if (parts.length < 2 || !parts[0]) continue;
    cards.push(
      normalizeCard({ question: parts[0], shortAnswer: parts[1], explanation: parts[2] || "" })
    );
  }
  if (!cards.length) {
    showToast("No valid cards found. Use the format Question::Answer.", "warning");
    return;
  }
  const deck = {
    id: generateId(),
    title,
    topic: title,
    bilingual: false,
    source: "manual",
    createdAt: Date.now(),
    reviews: 0,
    finishedAt: null,
    cards,
  };
  appState.flashcardDecks.push(deck);
  saveState();
  closeModal();
  logActivity(`Created deck "${deck.title}" (${deck.cards.length} cards)`, "Flashcards");
  renderFlashcards();
  showToast(`Deck "${title}" created with ${cards.length} cards.`, "success");
}

async function generateFlashcards(config) {
  showLoader(`Generating ${config.count} flashcards...`);
  try {
    const material = getMaterialContext();
    const lang = appState.settings.language || "English";
    let prompt;
    if (material) {
      prompt =
        `You are a flashcard creator. Based on the study material below, generate exactly ${config.count} flashcards covering its key facts.\n` +
        `Material:\n${material.text.slice(0, 6000)}`;
    } else {
      prompt = `You are a flashcard creator. Generate exactly ${config.count} flashcards to learn about "${config.topic}".`;
    }
    prompt +=
      `\nReturn ONLY valid JSON (no markdown fences): ` +
      `[{"question":"...","shortAnswer":"...","explanation":"...","example":"...","takeaway":"..."}]`;
    if (config.bilingual) {
      prompt +=
        `\nEvery text field must be bilingual, formatted as "English | ${lang}" so the learner sees both languages side by side.`;
    }

    const raw = await callGemini(buildPrompt(prompt, lang));
    const parsed = parseJSONResponse(raw);
    const list = Array.isArray(parsed) ? parsed : parsed && parsed.cards;
    if (!Array.isArray(list) || !list.length) {
      throw new Error("The AI did not return any flashcards.");
    }

    const deck = {
      id: generateId(),
      title: config.title || config.topic || "Untitled deck",
      topic: config.topic || (material ? material.name : "General"),
      bilingual: !!config.bilingual,
      source: material ? "material" : "ai",
      createdAt: Date.now(),
      reviews: 0,
      finishedAt: null,
      cards: list.slice(0, config.count).map(normalizeCard),
    };
    appState.flashcardDecks.push(deck);
    saveState();
    closeModal();
    logActivity(`Created deck "${deck.title}" (${deck.cards.length} cards)`, "Flashcards");
    if (material) trackUsage(material.id, "flashcards");
    renderFlashcards();
    showToast(`Deck "${deck.title}" created with ${deck.cards.length} cards.`, "success");
    return deck;
  } catch (err) {
    console.error("[QuizNova] Flashcard generation failed:", err);
    showToast(err.message || "Failed to generate flashcards.", "error");
    return null;
  } finally {
    hideLoader();
  }
}

// ============================================
// Review flow
// ============================================

function openDeck(deckId) {
  const deck = appState.flashcardDecks.find((d) => d.id === deckId);
  if (!deck) return;
  const queue = buildQueue(deck);
  if (!queue.length) {
    deckState = { deck, queue, current: 0 };
    renderDeckComplete(deck);
    return;
  }
  deckState = { deck, queue, current: 0, flipped: false };
  renderCard();
}

function renderCard() {
  const view = document.getElementById("view-flashcards");
  if (!view || !deckState) return;
  const { deck, queue, current } = deckState;
  const card = queue[current];
  deckState.flipped = false;
  const pos = current + 1;
  const total = queue.length;

  view.innerHTML = `
    <div class="view-section">
      <div class="view-heading">
        <h2>${escapeHTML(deck.title)}</h2>
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          ${languageBadgesHTML(deck)}
          <span class="badge badge-primary">${pos} / ${total}</span>
          <button class="btn btn-ghost btn-sm" id="fcExit"><i class="fa-solid fa-xmark"></i> Exit</button>
        </div>
      </div>
      <div class="flashcard-3d" id="fcCard" style="margin-top:14px;">
        <div class="flashcard-inner">
          <div class="flashcard-face flashcard-front">
            <div style="font-size:1.15rem;">${escapeHTML(card.question)}</div>
            <div class="flashcard-hint">Click the card or press "Flip"</div>
          </div>
          <div class="flashcard-face flashcard-back">
            <div style="font-size:1.05rem;font-weight:700;margin-bottom:10px;">${escapeHTML(
              card.shortAnswer
            )}</div>
            ${card.explanation ? `<p style="font-size:.85rem;font-weight:400;line-height:1.5;margin-bottom:6px;">💡 ${escapeHTML(card.explanation)}</p>` : ""}
            ${card.example ? `<p style="font-size:.85rem;font-weight:400;line-height:1.5;margin-bottom:6px;">✏️ ${escapeHTML(card.example)}</p>` : ""}
            ${card.takeaway ? `<p style="font-size:.85rem;font-weight:400;line-height:1.5;">🔑 ${escapeHTML(card.takeaway)}</p>` : ""}
          </div>
        </div>
      </div>
      <div class="flashcard-controls">
        <button class="btn btn-primary" id="fcFlip"><i class="fa-solid fa-rotate"></i> Flip</button>
        <button class="btn btn-ghost" id="fcSkip"><i class="fa-solid fa-forward"></i> Skip</button>
      </div>
      <div class="flashcard-controls" id="fcRatings" style="display:none;">
        <button class="btn" data-quality="0" style="background:var(--danger,#EF4444);color:#fff;min-width:88px;">Again</button>
        <button class="btn" data-quality="2" style="background:var(--warning,#F59E0B);color:#fff;min-width:88px;">Hard</button>
        <button class="btn" data-quality="3" style="background:var(--secondary,#22C55E);color:#fff;min-width:88px;">Good</button>
        <button class="btn" data-quality="5" style="background:#3B82F6;color:#fff;min-width:88px;">Easy</button>
      </div>
    </div>`;

  const cardEl = view.querySelector("#fcCard");
  const flipBtn = view.querySelector("#fcFlip");
  const skipBtn = view.querySelector("#fcSkip");
  const ratings = view.querySelector("#fcRatings");

  const flip = () => {
    if (deckState && deckState.deck) {
      deckState.flipped = !deckState.flipped;
      cardEl.classList.toggle("flipped", deckState.flipped);
      ratings.style.display = deckState.flipped ? "flex" : "none";
    }
  };
  cardEl.addEventListener("click", flip);
  flipBtn.addEventListener("click", flip);

  skipBtn.addEventListener("click", () => {
    // A skip pushes the card to the back of the queue instead of rescheduling.
    deckState.queue.push(deckState.queue.shift());
    renderCard();
  });

  view.querySelectorAll("[data-quality]").forEach((btn) => {
    btn.addEventListener("click", () => rateCard(Number(btn.dataset.quality)));
  });

  view.querySelector("#fcExit").addEventListener("click", () => {
    deckState = null;
    renderFlashcards();
  });
}

function rateCard(quality) {
  if (!deckState || !deckState.flipped) {
    showToast("Flip the card to see the answer first.", "warning");
    return;
  }
  const { deck, queue, current } = deckState;
  const card = queue[current];
  sm2Update(card, quality);
  card.reviews += 1;
  deck.reviews = (deck.reviews || 0) + 1;
  saveState();

  addXP(REVIEW_XP, "Flashcard reviewed");

  deckState.current += 1;
  if (deckState.current >= queue.length) {
    finishDeck();
  } else {
    renderCard();
  }
}

function finishDeck() {
  const { deck } = deckState;
  const mastered = deck.cards.filter((c) => c.mastered).length;

  if (!deck.finishedAt) {
    deck.finishedAt = Date.now();
    saveState();
    addXP(DECK_FINISH_XP, "Flashcards deck completed");
    checkAchievements();
    mascot.react("celebrating");
    showToast(`Deck complete! +${DECK_FINISH_XP} XP 🎉`, "success");
  }

  renderDeckComplete(deck);
  if (mastered >= deck.cards.length) mascot.react("celebrating");
}

function renderDeckComplete(deck) {
  const view = document.getElementById("view-flashcards");
  if (!view) return;
  const mastered = deck.cards.filter((c) => c.mastered).length;
  const pct = deck.cards.length ? Math.round((mastered / deck.cards.length) * 100) : 0;

  view.innerHTML = `
    <div class="empty-state">
      <i class="fa-solid fa-layer-group"></i>
      <div class="empty-title">Session complete! 🎉</div>
      <div class="card-subtitle">${mastered}/${deck.cards.length} cards mastered (${pct}%)</div>
      <div class="progress-bar" style="max-width:320px;margin:14px auto 0;"><div class="progress-fill" style="width:${pct}%"></div></div>
      <div style="display:flex;gap:10px;justify-content:center;margin-top:18px;">
        <button class="btn btn-primary" id="fcAgain"><i class="fa-solid fa-rotate-right"></i> Review Again</button>
        <button class="btn btn-ghost" id="fcBack"><i class="fa-solid fa-layer-group"></i> All Decks</button>
      </div>
    </div>`;

  view.querySelector("#fcAgain").addEventListener("click", () => openDeck(deck.id));
  view.querySelector("#fcBack").addEventListener("click", () => {
    deckState = null;
    renderFlashcards();
  });
}

// ============================================
// Deck management
// ============================================

async function deleteDeck(deckId) {
  const deck = appState.flashcardDecks.find((d) => d.id === deckId);
  if (!deck) return;
  const ok = await confirmAction(`Delete deck "${deck.title}" and its ${deck.cards.length} cards?`);
  if (!ok) return;
  if (deckState && deckState.deck && deckState.deck.id === deckId) deckState = null;
  appState.flashcardDecks = appState.flashcardDecks.filter((d) => d.id !== deckId);
  saveState();
  showToast("Deck deleted.", "info");
  renderFlashcards();
}

export {
  renderFlashcards,
  createDeckModal,
  generateFlashcards,
  createManualDeck,
  openDeck,
  renderCard,
  rateCard,
  finishDeck,
  renderDeckComplete,
  deleteDeck,
  sm2Update,
  buildQueue,
  getDueFlashcards,
  deckStats,
  normalizeCard,
  MASTERED_INTERVAL,
  REVIEW_XP,
  DECK_FINISH_XP,
};
