// ============================================
// QuizNova X — notes.js
// Smart notes: CRUD, AI enhance/summarize, export
// ============================================

import { appState, saveState } from "./state.js";
import { callGemini, buildPrompt } from "./ai.js";
import { showToast, showLoader, hideLoader, confirmAction, showModal, closeModal, renderEmptyState } from "./ui.js";
import { escapeHTML, escapeAttr, generateId, timeAgo, formatDate, safeDownload } from "./utils.js";
import { addXP } from "./gamification.js";

// ---- Editor working state ----
let editorState = { id: null, title: "", content: "", source: "Manual" };
let autosaveTimerId = null;

// ---- Create a note (single source of truth for new notes) ----
function addNote(title, content, source = "Manual") {
  const note = {
    id: generateId(),
    title: (title || "").trim() || "Untitled note",
    content: content || "",
    source,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  appState.notes.push(note);
  saveState();
  addXP(5, "Note created");
  return note;
}

// ---- Save note: validate, upsert, award XP for new ----
function saveNote(note) {
  if (!note || !note.title || !note.title.trim()) {
    showToast("Note title cannot be empty.", "warning");
    return null;
  }
  note.title = note.title.trim();

  const existing = note.id ? appState.notes.find((n) => n.id === note.id) : null;
  if (existing) {
    Object.assign(existing, {
      title: note.title,
      content: note.content || "",
      source: note.source || existing.source || "Manual",
      updatedAt: Date.now(),
    });
    saveState();
    showToast("Note saved.", "success");
    return existing;
  }

  const created = addNote(note.title, note.content, note.source || "Manual");
  showToast("Note created.", "success");
  return created;
}

// ---- Delete ----
async function deleteNote(id) {
  const note = appState.notes.find((n) => n.id === id);
  if (!note) return;
  const ok = await confirmAction(`Delete note "${note.title}"?`);
  if (!ok) return;
  appState.notes = appState.notes.filter((n) => n.id !== id);
  saveState();
  showToast("Note deleted.", "info");
  renderNotes();
}

// ---- Search ----
function searchNotes(query) {
  const q = String(query || "").trim().toLowerCase();
  if (!q) return [...appState.notes];
  return appState.notes.filter(
    (n) =>
      (n.title || "").toLowerCase().includes(q) ||
      (n.content || "").toLowerCase().includes(q)
  );
}

// ---- Source badge styling ----
function sourceBadgeClass(source) {
  const map = {
    Manual: "badge-info",
    "AI-Generated": "badge-primary",
    Enhanced: "badge-warning",
    Summary: "badge-success",
  };
  return map[source] || "badge-info";
}

function noteCard(note) {
  const preview = (note.content || "").replace(/\s+/g, " ").trim().slice(0, 100);
  return `<div class="card note-card" data-id="${note.id}">
    <div style="display:flex;justify-content:space-between;gap:8px;align-items:flex-start;">
      <h3 style="font-size:.98rem;flex:1;">${escapeHTML(note.title)}</h3>
      <span class="badge ${sourceBadgeClass(note.source)}">${escapeHTML(note.source || "Manual")}</span>
    </div>
    <p class="card-subtitle" style="margin-top:8px;">${escapeHTML(preview)}${
      (note.content || "").trim().length > 100 ? "…" : ""
    }</p>
    <p style="font-size:.75rem;color:var(--text-muted);margin-top:8px;">Updated ${timeAgo(note.updatedAt)}</p>
    <div style="display:flex;gap:8px;margin-top:12px;flex-wrap:wrap;">
      <button class="btn btn-primary btn-sm" data-note-action="edit" data-id="${note.id}"><i class="fa-solid fa-pen"></i> Edit</button>
      <button class="btn btn-ghost btn-sm" data-note-action="export" data-id="${note.id}"><i class="fa-solid fa-download"></i> Export</button>
      <button class="btn btn-danger btn-sm" data-note-action="delete" data-id="${note.id}"><i class="fa-solid fa-trash"></i></button>
    </div>
  </div>`;
}

// ---- Render list ----
function renderNotesGrid(filtered) {
  const container = document.getElementById("notesGrid");
  if (!container) return;
  container.innerHTML = filtered.length
    ? filtered.map(noteCard).join("")
    : renderEmptyState("magnifying-glass", "No notes match your search.");
  bindNoteActions(container);
}

function renderNotes() {
  const view = document.getElementById("view-notes");
  if (!view) return;

  view.innerHTML = `
    <div class="view-heading">
      <h2>My Notes</h2>
      <button class="btn btn-primary" id="newNoteBtn"><i class="fa-solid fa-plus"></i> New Note</button>
    </div>
    <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;">
      <input class="input" id="noteSearch" type="search" placeholder="Search notes..." style="max-width:420px;">
      <span class="badge badge-primary">${appState.notes.length}</span>
    </div>
    ${
      appState.notes.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:14px;" id="notesGrid"></div>`
        : `<div id="notesGrid"></div>`
    }
  `;

  renderNotesGrid([...appState.notes]);

  const search = view.querySelector("#noteSearch");
  if (search) {
    search.addEventListener("input", () => renderNotesGrid(searchNotes(search.value)));
  }
  view.querySelector("#newNoteBtn").addEventListener("click", () => openNoteEditor());
}

function bindNoteActions(scope) {
  scope.querySelectorAll("[data-note-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = btn.dataset.id;
      const note = appState.notes.find((n) => n.id === id);
      if (!note) return;
      const action = btn.dataset.noteAction;
      if (action === "edit") openNoteEditor(id);
      else if (action === "delete") deleteNote(id);
      else if (action === "export") exportNoteModal(note);
    });
  });
}

// ---- Editor ----
function editorHTML(state) {
  return `<div class="note-editor">
    <label class="label">Title</label>
    <input class="input" id="noteTitle" value="${escapeAttr(state.title)}" placeholder="Note title" maxlength="80">
    <div style="height:10px;"></div>
    <label class="label">Content</label>
    <textarea class="textarea" id="noteContent" placeholder="Write your note..." style="min-height:220px;">${escapeHTML(state.content)}</textarea>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
      <button class="btn btn-ghost btn-sm" data-note-editor="enhance"><i class="fa-solid fa-wand-magic-sparkles"></i> AI Enhance</button>
      <button class="btn btn-ghost btn-sm" data-note-editor="summarize"><i class="fa-solid fa-compress"></i> AI Summarize</button>
      <button class="btn btn-ghost btn-sm" data-note-editor="export-html"><i class="fa-solid fa-file-code"></i> Export HTML</button>
      <button class="btn btn-ghost btn-sm" data-note-editor="export-pdf"><i class="fa-solid fa-file-pdf"></i> Export PDF</button>
      <button class="btn btn-ghost btn-sm" data-note-editor="duplicate"><i class="fa-solid fa-copy"></i> Duplicate</button>
    </div>
    <p id="noteAutosave" style="font-size:.75rem;color:var(--text-muted);margin-top:8px;">Ready</p>
  </div>`;
}

function openNoteEditor(noteId = null) {
  const existing = noteId ? appState.notes.find((n) => n.id === noteId) : null;
  editorState = existing
    ? { id: existing.id, title: existing.title, content: existing.content, source: existing.source || "Manual" }
    : { id: null, title: "", content: "", source: "Manual" };

  showModal(existing ? "Edit Note" : "New Note", editorHTML(editorState), [
    { label: "Cancel", class: "btn-ghost", onClick: closeModal },
    { label: "Save", class: "btn-primary", onClick: saveEditorAndClose },
  ]);

  const root = document.getElementById("modalRoot");
  const titleInput = root.querySelector("#noteTitle");
  const contentInput = root.querySelector("#noteContent");

  const sync = () => {
    if (titleInput) editorState.title = titleInput.value;
    if (contentInput) editorState.content = contentInput.value;
  };

  if (titleInput) titleInput.addEventListener("input", () => { sync(); scheduleAutosave(); });
  if (contentInput) contentInput.addEventListener("input", () => { sync(); scheduleAutosave(); });

  root.querySelectorAll("[data-note-editor]").forEach((btn) => {
    btn.addEventListener("click", () => {
      sync();
      const action = btn.dataset.noteEditor;
      const snapshot = { title: editorState.title, content: editorState.content, source: editorState.source, updatedAt: Date.now() };
      if (action === "enhance") aiEnhanceNote();
      else if (action === "summarize") aiSummarizeNote();
      else if (action === "export-html") exportNoteHTML(snapshot);
      else if (action === "export-pdf") exportNotePDF(snapshot);
      else if (action === "duplicate") duplicateEditorNote();
    });
  });
}

function updateAutosave(text) {
  const el = document.getElementById("noteAutosave");
  if (el) el.textContent = text;
}

function scheduleAutosave() {
  updateAutosave("Saving...");
  clearTimeout(autosaveTimerId);
  autosaveTimerId = setTimeout(() => {
    autosaveEditor();
    updateAutosave("Saved ✓");
  }, 800);
}

function autosaveEditor() {
  const title = (editorState.title || "").trim() || "Untitled note";
  if (!editorState.id) {
    editorState.id = generateId();
    appState.notes.push({
      id: editorState.id,
      title,
      content: editorState.content,
      source: editorState.source || "Manual",
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  } else {
    const n = appState.notes.find((x) => x.id === editorState.id);
    if (n) {
      n.title = title;
      n.content = editorState.content;
      n.source = editorState.source || n.source || "Manual";
      n.updatedAt = Date.now();
    }
  }
  saveState();
}

function saveEditorAndClose() {
  const root = document.getElementById("modalRoot");
  const ti = root.querySelector("#noteTitle");
  const ci = root.querySelector("#noteContent");
  if (ti) editorState.title = ti.value;
  if (ci) editorState.content = ci.value;

  const empty = !editorState.title.trim() && !editorState.content.trim();
  closeModal();
  if (empty) {
    renderNotes();
    return;
  }
  saveNote(editorState);
  renderNotes();
}

// ---- AI actions ----
async function aiEnhanceNote() {
  const content = editorState.content;
  if (!content.trim()) {
    showToast("Nothing to enhance yet.", "warning");
    return;
  }
  showLoader("Enhancing note with AI...");
  try {
    const enhanced = await callGemini(
      buildPrompt(
        `Enhance the following note with better structure, examples, and key points. Return only the enhanced note text:\n\n${content}`
      )
    );
    editorState.content = enhanced.trim();
    editorState.source = "Enhanced";
    const textarea = document.getElementById("noteContent");
    if (textarea) textarea.value = editorState.content;
    autosaveEditor();
    updateAutosave("Enhanced & saved ✓");
    showToast("Note enhanced by AI.", "success");
  } catch (err) {
    showToast(`Enhance failed: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

async function aiSummarizeNote() {
  const content = editorState.content;
  if (!content.trim()) {
    showToast("Nothing to summarize yet.", "warning");
    return;
  }
  showLoader("Summarizing note...");
  try {
    const summary = await callGemini(
      buildPrompt(`Summarize the following note into 3-5 bullet points:\n\n${content}`)
    );
    const created = addNote(`Summary — ${editorState.title || "Note"}`, summary.trim(), "Summary");
    updateAutosave("Summary saved ✓");
    showToast(`Summary saved as "${created.title}".`, "success");
  } catch (err) {
    showToast(`Summarize failed: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

function duplicateEditorNote() {
  const title = editorState.title.trim() || "Untitled note";
  const created = saveNote({ title: `${title} (copy)`, content: editorState.content, source: editorState.source || "Manual" });
  if (created) {
    editorState = { id: created.id, title: created.title, content: created.content, source: created.source };
    const ti = document.getElementById("noteTitle");
    const ci = document.getElementById("noteContent");
    if (ti) ti.value = created.title;
    if (ci) ci.value = created.content;
    updateAutosave("Duplicated & saved ✓");
  }
}

// ---- Export ----
function sanitizeFilename(name) {
  return String(name || "note")
    .replace(/[^a-z0-9-_ ]/gi, "")
    .replace(/\s+/g, "-")
    .slice(0, 60) || "note";
}

function buildNoteHTML(note) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHTML(note.title)}</title>
<style>
  body{font-family:Inter,-apple-system,Segoe UI,sans-serif;max-width:720px;margin:40px auto;padding:0 20px;color:#1e293b;line-height:1.65;}
  h1{border-bottom:2px solid #6366f1;padding-bottom:8px;}
  .meta{color:#64748b;font-size:.85rem;}
  pre{white-space:pre-wrap;font-family:inherit;font-size:.95rem;}
</style>
</head>
<body>
<h1>${escapeHTML(note.title)}</h1>
<p class="meta">${escapeHTML(note.source || "Manual")} · ${escapeHTML(formatDate(note.updatedAt))}</p>
<pre>${escapeHTML(note.content)}</pre>
</body>
</html>`;
}

function exportNoteHTML(note) {
  safeDownload(`${sanitizeFilename(note.title)}.html`, buildNoteHTML(note), "text/html");
  showToast("Note exported as HTML.", "success");
}

function exportNotePDF(note) {
  try {
    const iframe = document.createElement("iframe");
    iframe.style.position = "fixed";
    iframe.style.right = "0";
    iframe.style.bottom = "0";
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "0";
    document.body.appendChild(iframe);
    const doc = iframe.contentWindow.document;
    doc.open();
    doc.write(buildNoteHTML(note));
    doc.close();
    setTimeout(() => {
      iframe.contentWindow.focus();
      iframe.contentWindow.print();
      setTimeout(() => iframe.remove(), 600);
    }, 300);
    showToast("Opening print dialog...", "info");
  } catch (err) {
    console.error("[QuizNova] PDF export failed:", err);
    showToast("PDF export failed.", "error");
  }
}

function exportNoteModal(note) {
  showModal(
    "Export Note",
    `<p>Export "${escapeHTML(note.title)}" as:</p>`,
    [
      { label: "Cancel", class: "btn-ghost", onClick: closeModal },
      { label: "HTML", class: "btn-primary", onClick: () => { exportNoteHTML(note); closeModal(); } },
      { label: "PDF", class: "btn-secondary", onClick: () => { exportNotePDF(note); closeModal(); } },
    ]
  );
}

export {
  renderNotes,
  openNoteEditor,
  saveNote,
  addNote,
  deleteNote,
  searchNotes,
  aiEnhanceNote,
  aiSummarizeNote,
  exportNoteHTML,
  exportNotePDF,
  buildNoteHTML,
};
