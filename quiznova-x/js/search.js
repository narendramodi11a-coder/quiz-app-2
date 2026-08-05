// ============================================
// QuizNova X — search.js
// Global search (Ctrl+K): notes, material, quizzes,
// flashcards, summaries, mistakes — instant results
// with keyboard navigation (Prompt 6: Search)
// ============================================

import { appState } from "./state.js";
import { showModal, closeModal } from "./ui.js";
import { escapeHTML, debounce } from "./utils.js";
import { openNoteEditor } from "./notes.js";
import { openDeck } from "./flashcards.js";

const TYPE_META = {
  note: { icon: "fa-note-sticky", label: "Notes" },
  material: { icon: "fa-folder-open", label: "Material" },
  quiz: { icon: "fa-list-check", label: "Quizzes" },
  flashcard: { icon: "fa-layer-group", label: "Flashcards" },
  summary: { icon: "fa-file-lines", label: "Summaries" },
  mistake: { icon: "fa-book-open", label: "Mistake Journal" },
};

// ---- Placeholder shown while the debounced search is running ----
function searchSkeletonHTML() {
  return `
    <div style="padding:12px;">
      <div class="skeleton skeleton-line w-40" style="margin:8px 0;"></div>
      <div class="skeleton skeleton-line w-100"></div>
      <div class="skeleton skeleton-line w-80"></div>
      <div class="skeleton skeleton-line w-90"></div>
      <div class="skeleton skeleton-line w-60" style="margin-top:14px;"></div>
      <div class="skeleton skeleton-line w-100"></div>
    </div>`;
}

let overlay = null;
let inputEl = null;
let resultsEl = null;
let currentItems = [];
let activeIndex = -1;
let open = false;

// ---- Build the flat searchable index ----
function buildIndex() {
  const items = [];
  for (const n of appState.notes || []) {
    items.push({ type: "note", id: n.id, title: n.title || "Untitled", text: n.content || "", ref: n });
  }
  for (const m of appState.studyMaterial || []) {
    items.push({ type: "material", id: m.id, title: m.name || "Material", text: m.text || "", ref: m });
  }
  for (const h of appState.history || []) {
    items.push({
      type: "quiz",
      id: h.id,
      title: `Quiz · ${h.topic || "Untitled"}`,
      text: `${h.mode} · ${h.accuracy}% · ${h.score}/${h.total}`,
      ref: h,
    });
  }
  for (const d of appState.flashcardDecks || []) {
    items.push({ type: "flashcard", id: d.id, title: d.title || "Deck", text: `${(d.cards || []).length} cards`, ref: d });
  }
  for (const s of appState.summaryHistory || []) {
    items.push({ type: "summary", id: s.id, title: s.title || "Summary", text: s.summary || "", ref: s });
  }
  for (const m of appState.mistakeJournal || []) {
    items.push({ type: "mistake", id: m.id, title: m.question || "Mistake", text: m.topic || "", ref: m });
  }
  return items;
}

function filterItems(query) {
  const q = String(query || "").trim().toLowerCase();
  const index = buildIndex();
  if (!q) return [];
  return index.filter((it) => (it.title + " " + it.text).toLowerCase().includes(q)).slice(0, 24);
}

// ---- Actions ----
function activate(item) {
  switch (item.type) {
    case "note":
      closeSearch();
      openNoteEditor(item.id);
      break;
    case "material":
      closeSearch();
      window.nav("material");
      break;
    case "quiz":
      closeSearch();
      window.nav("quiz");
      break;
    case "flashcard":
      closeSearch();
      openDeck(item.id);
      window.nav("flashcards");
      break;
    case "summary":
      closeSearch();
      window.nav("summarizer");
      break;
    case "mistake":
      closeSearch();
      window.nav("mistakes");
      break;
    default:
      closeSearch();
  }
}

// ---- Render results ----
function renderResults(items) {
  currentItems = items;
  activeIndex = -1;
  if (!resultsEl) return;
  if (!items.length) {
    resultsEl.innerHTML = `<div class="search-empty"><i class="fa-solid fa-magnifying-glass"></i><span>No results found.</span></div>`;
    return;
  }

  // Group by type preserving order; tag each item with its global index
  const groups = new Map();
  items.forEach((it, gi) => {
    if (!groups.has(it.type)) groups.set(it.type, []);
    groups.get(it.type).push({ item: it, gi });
  });

  resultsEl.innerHTML = [...groups.entries()]
    .map(([type, list]) => {
      const meta = TYPE_META[type] || { icon: "fa-circle", label: type };
      return `
        <div class="search-group">
          <div class="search-group-label"><i class="fa-solid ${meta.icon}"></i> ${meta.label}</div>
          ${list.map(({ item, gi }) => `<button class="search-item" data-gi="${gi}" data-type="${type}">
            <i class="fa-solid ${meta.icon} search-item-icon"></i>
            <div class="search-item-body">
              <strong>${escapeHTML(item.title)}</strong>
              <span>${escapeHTML(item.text ? item.text.slice(0, 90) : "")}</span>
            </div>
            <i class="fa-solid fa-arrow-right search-item-go"></i>
          </button>`).join("")}
        </div>`;
    })
    .join("");

  resultsEl.querySelectorAll(".search-item").forEach((el) => {
    el.addEventListener("click", () => {
      const item = currentItems[Number(el.dataset.gi)];
      if (item) activate(item);
    });
    el.addEventListener("mousemove", () => setActive(Number(el.dataset.gi)));
  });
  setActive(0);
}

function setActive(idx) {
  if (idx < 0 || idx >= currentItems.length) return;
  activeIndex = idx;
  resultsEl.querySelectorAll(".search-item").forEach((el, i) => {
    el.classList.toggle("active", i === idx);
    if (i === idx) el.scrollIntoView({ block: "nearest" });
  });
}

// ---- Overlay ----
function ensureOverlay() {
  if (overlay) return;
  overlay = document.createElement("div");
  overlay.id = "searchOverlay";
  overlay.className = "search-overlay hidden";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-label", "Global search");
  overlay.innerHTML = `
    <div class="search-panel" role="search">
      <div class="search-input-wrap">
        <i class="fa-solid fa-magnifying-glass"></i>
        <input id="searchInput" class="search-input" type="text" placeholder="Search notes, material, quizzes, flashcards, summaries..." autocomplete="off">
        <kbd class="search-kbd">Esc</kbd>
      </div>
      <div id="searchResults" class="search-results"></div>
      <div class="search-footer">
        <span><kbd>↑</kbd><kbd>↓</kbd> navigate</span>
        <span><kbd>Enter</kbd> open</span>
        <span><kbd>Esc</kbd> close</span>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  inputEl = overlay.querySelector("#searchInput");
  resultsEl = overlay.querySelector("#searchResults");

  const doSearch = debounce((q) => renderResults(filterItems(q)), 150);
  inputEl.addEventListener("input", () => {
    resultsEl.innerHTML = searchSkeletonHTML();
    doSearch(inputEl.value);
  });
  inputEl.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, currentItems.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (currentItems[activeIndex]) activate(currentItems[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      closeSearch();
    }
  });

  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) closeSearch();
  });
}

function openSearch() {
  ensureOverlay();
  open = true;
  overlay.classList.remove("hidden");
  currentItems = [];
  activeIndex = -1;
  if (resultsEl) resultsEl.innerHTML = '<div class="search-empty"><i class="fa-solid fa-magnifying-glass"></i><span>Type to search across your study data...</span></div>';
  if (inputEl) {
    inputEl.value = "";
    setTimeout(() => inputEl.focus(), 30);
  }
}

function closeSearch() {
  open = false;
  if (overlay) overlay.classList.add("hidden");
}

function toggleSearch() {
  if (open) closeSearch();
  else openSearch();
}

// ---- Shortcuts help modal ----
function showShortcuts() {
  showModal(
    "Keyboard Shortcuts",
    `<div style="display:flex;flex-direction:column;gap:8px;font-size:.9rem;">
      <div style="display:flex;justify-content:space-between;"><span>Open search</span><kbd>Ctrl/⌘ + K</kbd></div>
      <div style="display:flex;justify-content:space-between;"><span>Navigate results</span><kbd>↑ ↓</kbd></div>
      <div style="display:flex;justify-content:space-between;"><span>Open selected</span><kbd>Enter</kbd></div>
      <div style="display:flex;justify-content:space-between;"><span>Close / cancel</span><kbd>Esc</kbd></div>
      <div style="display:flex;justify-content:space-between;"><span>Shortcuts help</span><kbd>?</kbd></div>
      <div style="display:flex;justify-content:space-between;"><span>Toggle theme</span><kbd>t</kbd></div>
    </div>`,
    [{ label: "Close", class: "btn-ghost", onClick: closeModal }]
  );
}

// ---- Init: global keydown + topbar button ----
function initSearch() {
  document.addEventListener("keydown", (e) => {
    const shortcutsOn = appState.settings.shortcutEnabled !== false;
    const tagName = e.target && e.target.tagName;
    const typing = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT" || tagName === "BUTTON";
    // Ctrl+K while typing in the quiz answer editor must not hijack the shortcut.
    const inQuiz = typing && typeof e.target.closest === "function" && !!e.target.closest("#view-quiz");

    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
      if (shortcutsOn && !inQuiz) {
        e.preventDefault();
        toggleSearch();
      }
      return;
    }
    if (e.key === "Escape") {
      if (open) closeSearch();
      return;
    }
    if (typing || !shortcutsOn) return;
    if (e.key === "?") {
      e.preventDefault();
      showShortcuts();
    } else if (e.key.toLowerCase() === "t" && !e.ctrlKey && !e.metaKey && !e.altKey) {
      const btn = document.getElementById("themeToggle");
      if (btn) {
        btn.click();
      }
    }
  });

  const searchBtn = document.getElementById("searchBtn");
  if (searchBtn) searchBtn.addEventListener("click", openSearch);

  window.openSearch = openSearch;
  window.closeSearch = closeSearch;
}

export { initSearch, openSearch, closeSearch, showShortcuts, buildIndex, filterItems };
