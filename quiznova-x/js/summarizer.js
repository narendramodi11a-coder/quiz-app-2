// ============================================
// QuizNova X — summarizer.js
// AI Summarizer: concise/detailed/bullet summaries,
// key points, formulas & definitions, save to notes,
// copy/export/regenerate (Prompt 6: AI Summarizer)
// ============================================

import { appState, saveState } from "./state.js";
import { callGemini, buildPrompt, parseJSONResponse } from "./ai.js";
import { showToast, showLoader, hideLoader, renderEmptyState } from "./ui.js";
import { escapeHTML, escapeAttr, generateId, timeAgo, safeDownload } from "./utils.js";
import { addXP, logActivity, checkAchievements } from "./gamification.js";
import { addNote, openNoteEditor } from "./notes.js";
import { recordStudy } from "./progress.js";
import { trackUsage } from "./usage.js";
import { mascot } from "./mascot.js";

const SUMMARY_XP = 10;
const MAX_INPUT = 40000;

let currentSummary = null;

// ============================================
// Rendering
// ============================================

function lengthLabel(len) {
  return len === "short" ? "Short" : len === "long" ? "Long" : "Medium";
}

function renderSummarizer() {
  const view = document.getElementById("view-summarizer");
  if (!view) return;

  const materials = appState.studyMaterial || [];
  const ctx = window.quiznovaContext || {};
  const preMaterialId = ctx.materialId || null;
  if (preMaterialId) delete window.quiznovaContext.materialId;

  view.innerHTML = `
    <div class="view-heading">
      <h2>Summarizer</h2>
      <span class="badge badge-primary">${appState.summaryHistory.length} saved</span>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <div class="card-title">Generate an AI summary</div>
      ${
        materials.length
          ? `<div class="view-section">
              <span class="label">Source</span>
              <select class="select" id="sumSourceSelect" style="max-width:420px;">
                <option value="">Paste text below...</option>
                ${materials.map((m) => `<option value="${m.id}" ${m.id === preMaterialId ? "selected" : ""}>${escapeHTML(m.name)}</option>`).join("")}
              </select>
            </div>`
          : ""
      }
      <div class="view-section">
        <span class="label">Text to summarize</span>
        <textarea class="textarea" id="sumInput" placeholder="Paste an article, lecture notes or study material here..." style="min-height:180px;">${preMaterialId && materials.length ? escapeHTML((materials.find((m) => m.id === preMaterialId) || {}).text || "") : ""}</textarea>
        <p style="font-size:.72rem;color:var(--text-muted);margin-top:4px;" id="sumCharCount">0 characters</p>
      </div>

      <div class="view-section">
        <span class="label">Summary length</span>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          ${["short", "medium", "long"].map((len) => `
            <label class="chip" style="cursor:pointer;">
              <input type="radio" name="sumLength" value="${len}" ${len === "medium" ? "checked" : ""} style="display:none;">
              ${lengthLabel(len)}
            </label>`).join("")}
        </div>
      </div>

      <div class="view-section">
        <span class="label">Extras</span>
        <div style="display:flex;gap:18px;flex-wrap:wrap;">
          <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer;">
            <input type="checkbox" id="sumKeyPoints" checked style="accent-color:var(--primary);"> Include key points
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:.85rem;cursor:pointer;">
            <input type="checkbox" id="sumFormulas" checked style="accent-color:var(--primary);"> Formulas &amp; definitions
          </label>
        </div>
      </div>

      <button class="btn btn-primary" id="sumGenerateBtn"><i class="fa-solid fa-wand-magic-sparkles"></i> Generate Summary</button>
    </div>

    <div id="sumResult"></div>

    <div class="view-section" style="margin-top:20px;">
      <div class="view-heading"><h2>Summary history</h2></div>
      <div id="sumHistory">${
        appState.summaryHistory.length
          ? `<div style="display:flex;flex-direction:column;gap:10px;">${appState.summaryHistory.map(summaryCardHTML).join("")}</div>`
          : renderEmptyState("file-lines", "No summaries yet — generate one above.")
      }</div>
    </div>
  `;

  bindSummarizer(view, materials);
}

function bindSummarizer(view, materials) {
  const input = view.querySelector("#sumInput");
  const sourceSelect = view.querySelector("#sumSourceSelect");
  const generateBtn = view.querySelector("#sumGenerateBtn");

  if (input) {
    const countEl = view.querySelector("#sumCharCount");
    const updateCount = () => {
      if (countEl) countEl.textContent = `${(input.value || "").length} characters`;
    };
    input.addEventListener("input", updateCount);
    updateCount();
  }

  if (sourceSelect) {
    sourceSelect.addEventListener("change", () => {
      const m = materials.find((x) => x.id === sourceSelect.value);
      if (m && input) input.value = m.text || "";
      if (input) input.dispatchEvent(new Event("input"));
      showToast(m ? `Loaded "${m.name}".` : "Switch back to pasting text.", "info");
    });
  }

  view.querySelectorAll("input[name=sumLength]").forEach((radio) => {
    radio.addEventListener("change", () => {
      view.querySelectorAll("input[name=sumLength]").forEach((r) => {
        const chip = r.closest(".chip");
        if (chip) {
          const active = r.checked;
          chip.style.borderColor = active ? "var(--primary)" : "";
          chip.style.color = active ? "var(--primary)" : "";
          chip.style.background = active ? "var(--active-bg)" : "";
        }
      });
    });
  });

  generateBtn.addEventListener("click", generateSummary);

  view.querySelectorAll("[data-sum-history]").forEach((btn) => {
    btn.addEventListener("click", () => loadHistorySummary(btn.dataset.sumHistory));
  });
  view.querySelectorAll("[data-sum-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteSummary(btn.dataset.sumDelete));
  });
}

function summaryCardHTML(s) {
  return `<div class="card" style="padding:14px 16px;">
    <div style="display:flex;gap:12px;align-items:center;">
      <div style="width:34px;height:34px;border-radius:9px;background:var(--active-bg);color:var(--primary);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-file-lines"></i></div>
      <div style="flex:1;min-width:0;">
        <strong style="font-size:.9rem;">${escapeHTML(s.title || "Untitled summary")}</strong>
        <span class="badge badge-success" style="margin-left:6px;">${escapeHTML(lengthLabel(s.length))}</span>
        <p class="card-subtitle" style="margin:2px 0 0;">${timeAgo(s.date)}</p>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" data-sum-history="${s.id}"><i class="fa-solid fa-eye"></i> View</button>
        <button class="btn btn-danger btn-sm" data-sum-delete="${s.id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  </div>`;
}

function loadHistorySummary(id) {
  const s = appState.summaryHistory.find((x) => x.id === id);
  if (!s) return;
  currentSummary = s;
  const result = document.getElementById("sumResult");
  if (result) result.innerHTML = summaryResultHTML(s);
  bindResultActions(result);
  result.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function deleteSummary(id) {
  appState.summaryHistory = appState.summaryHistory.filter((x) => x.id !== id);
  saveState();
  showToast("Summary deleted from history.", "info");
  renderSummarizer();
}

// ============================================
// Generation
// ============================================

function buildSummaryPrompt(text, length, includeKey, includeFormulas) {
  const lenInstr =
    length === "short"
      ? "a SHORT summary (3-4 concise sentences)"
      : length === "long"
        ? "a DETAILED summary (3-5 paragraphs with depth)"
        : "a MEDIUM summary (1-2 short paragraphs)";
  return (
    `You are an expert summarizer. Summarize the following text into ${lenInstr}.\n` +
    `Return ONLY valid JSON (no markdown fences) with this exact shape:\n` +
    `{"summary": "the summary text", "key_points": ["point 1", "point 2"], "formulas": ["formula or definition"], "definitions": ["definition 1"]}\n` +
    `Key points should be concise bullet points. ${includeFormulas ? "List important formulas, equations and key definitions." : "Leave formulas and definitions as empty arrays."}\n` +
    `Write in ${appState.settings.language || "English"}.\n\nText:\n${text.slice(0, MAX_INPUT)}`
  );
}

async function generateSummary() {
  const view = document.getElementById("view-summarizer");
  const input = view ? view.querySelector("#sumInput") : null;
  const text = (input && input.value ? input.value : "").trim();
  if (!text) {
    showToast("Paste some text to summarize first.", "warning");
    return;
  }

  const length = view.querySelector("input[name=sumLength]:checked")
    ? view.querySelector("input[name=sumLength]:checked").value
    : "medium";
  const includeKey = !view.querySelector("#sumKeyPoints") || view.querySelector("#sumKeyPoints").checked;
  const includeFormulas = !view.querySelector("#sumFormulas") || view.querySelector("#sumFormulas").checked;

  showLoader(`Generating ${lengthLabel(length)} summary...`);
  mascot.react("thinking");
  try {
    let parsed = null;
    try {
      const raw = await callGemini(buildPrompt(buildSummaryPrompt(text, length, includeKey, includeFormulas)));
      parsed = parseJSONResponse(raw);
    } catch (err) {
      console.warn("[QuizNova] AI summary failed, using local fallback:", err.message);
    }

    const data = parsed && typeof parsed === "object"
      ? {
          summary: String(parsed.summary || (parsed.text || "")).trim(),
          key_points: Array.isArray(parsed.key_points) ? parsed.key_points.map(String) : [],
          formulas: Array.isArray(parsed.formulas) ? parsed.formulas.map(String) : [],
          definitions: Array.isArray(parsed.definitions) ? parsed.definitions.map(String) : [],
        }
      : null;

    const built = data && data.summary
      ? data
      : buildLocalSummary(text, length, includeKey, includeFormulas);

    const title = makeTitle(text);
    currentSummary = {
      id: generateId(),
      title,
      input: text,
      summary: built.summary,
      key_points: built.key_points || [],
      formulas: built.formulas || [],
      definitions: built.definitions || [],
      length,
      date: Date.now(),
    };
    appState.summaryHistory.unshift(currentSummary);
    if (appState.summaryHistory.length > 25) appState.summaryHistory.length = 25;
    saveState();

    addXP(SUMMARY_XP, "Summary created");
    checkAchievements();
    logActivity("Summary created", "Summarizer");
    recordStudy(2, "Summary");

    const sourceSel = view.querySelector("#sumSourceSelect");
    if (sourceSel && sourceSel.value) trackUsage(sourceSel.value, "summaries");

    const result = document.getElementById("sumResult");
    if (result) result.innerHTML = summaryResultHTML(currentSummary);
    bindResultActions(result);
    mascot.react("reading");
    showToast(`Summary ready (+${SUMMARY_XP} XP).`, "success");
    renderSummarizerHistory();
  } catch (err) {
    console.error("[QuizNova] Summary generation failed:", err);
    showToast(`Failed to generate summary: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

// ---- Lightweight local summarizer (fallback when AI is unavailable) ----
function buildLocalSummary(text, length, includeKey, includeFormulas) {
  const sentences = text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
  const counts = { short: 4, medium: 8, long: 14 };
  const n = Math.min(sentences.length, counts[length] || 8);

  // Score sentences by word-frequency (classic extractive summarization)
  const words = text.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [];
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;
  const scored = sentences.map((s, i) => {
    const sw = s.toLowerCase().match(/[a-z][a-z'-]{2,}/g) || [];
    const score = sw.reduce((sum, w) => sum + (freq[w] || 0), 0) / (sw.length || 1);
    return { s, i, score };
  });
  const top = scored.slice().sort((a, b) => b.score - a.score).slice(0, n).sort((a, b) => a.i - b.i);

  const keyPoints = top.map((t) => t.s).slice(0, length === "short" ? 3 : 6);

  // Naive formula/definition extraction: lines with "=" or "is defined as"
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  const formulas = lines.filter((l) => l.includes("=")).slice(0, 5);
  const definitions = lines.filter((l) => /is (defined as|the|a|an)/i.test(l)).slice(0, 5);

  return {
    summary: top.map((t) => t.s).join(" "),
    key_points: includeKey ? keyPoints : [],
    formulas: includeFormulas ? formulas : [],
    definitions: includeFormulas ? definitions : [],
  };
}

function makeTitle(text) {
  const first = text.split(/\n/)[0].replace(/\s+/g, " ").trim();
  return first ? first.slice(0, 60) : "Untitled summary";
}

// ============================================
// Result rendering + actions
// ============================================

function bulletListHTML(title, icon, items) {
  if (!items || !items.length) return "";
  return `<div style="margin-top:12px;">
    <strong style="font-size:.9rem;">${title}</strong>
    <ul style="margin:8px 0 0 20px;display:flex;flex-direction:column;gap:6px;">
      ${items.map((it) => `<li style="font-size:.9rem;">${escapeHTML(it)}</li>`).join("")}
    </ul>
  </div>`;
}

function summaryResultHTML(s) {
  return `
    <div class="card" style="border-left:4px solid var(--primary);">
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px;">
        <strong style="font-size:.95rem;">${escapeHTML(s.title)}</strong>
        <span class="badge badge-success">${escapeHTML(lengthLabel(s.length))} summary</span>
      </div>
      <p style="white-space:pre-wrap;font-size:.92rem;line-height:1.6;">${escapeHTML(s.summary)}</p>
      ${bulletListHTML("Key points", "fa-list-check", s.key_points)}
      ${bulletListHTML("Important formulas & definitions", "fa-square-root-variable", s.formulas.concat(s.definitions || []))}
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px;">
        <button class="btn btn-primary btn-sm" id="sumCopy"><i class="fa-solid fa-copy"></i> Copy</button>
        <button class="btn btn-ghost btn-sm" id="sumExport"><i class="fa-solid fa-download"></i> Export .txt</button>
        <button class="btn btn-ghost btn-sm" id="sumSaveNote"><i class="fa-solid fa-note-sticky"></i> Save to Notes</button>
        <button class="btn btn-ghost btn-sm" id="sumRegenerate"><i class="fa-solid fa-rotate-right"></i> Regenerate</button>
      </div>
    </div>`;
}

function bindResultActions(root) {
  if (!root) return;
  const copy = root.querySelector("#sumCopy");
  if (copy) copy.addEventListener("click", copySummary);

  const exportBtn = root.querySelector("#sumExport");
  if (exportBtn) exportBtn.addEventListener("click", exportSummary);

  const save = root.querySelector("#sumSaveNote");
  if (save) save.addEventListener("click", saveSummaryToNotes);

  const regen = root.querySelector("#sumRegenerate");
  if (regen) regen.addEventListener("click", () => generateSummary());
}

function copySummary() {
  if (!currentSummary) return;
  const text = currentSummary.summary + (currentSummary.key_points.length ? "\n\nKey points:\n- " + currentSummary.key_points.join("\n- ") : "");
  try {
    navigator.clipboard.writeText(text);
    showToast("Summary copied to clipboard.", "success");
  } catch (err) {
    showToast("Could not copy.", "error");
  }
}

function exportSummary() {
  if (!currentSummary) return;
  const lines = [
    currentSummary.summary,
    "",
    "Key points:",
    ...currentSummary.key_points.map((k) => `- ${k}`),
    "",
    "Formulas & definitions:",
    ...currentSummary.formulas.map((f) => `- ${f}`),
    ...currentSummary.definitions.map((d) => `- ${d}`),
  ];
  const name = (currentSummary.title || "summary").replace(/[^a-z0-9-_ ]/gi, "").replace(/\s+/g, "-").slice(0, 50) || "summary";
  safeDownload(`${name}.txt`, lines.join("\n"), "text/plain");
  showToast("Summary exported as .txt.", "success");
}

function saveSummaryToNotes() {
  if (!currentSummary) return;
  const content =
    currentSummary.summary +
    (currentSummary.key_points.length ? "\n\nKey points:\n- " + currentSummary.key_points.join("\n- ") : "") +
    (currentSummary.formulas.length ? "\n\nFormulas:\n- " + currentSummary.formulas.join("\n- ") : "");
  const note = addNote(`Summary — ${currentSummary.title}`, content, "Summary");
  showToast(`Saved to notes as "${note.title}".`, "success");
  openNoteEditor(note.id);
}

function renderSummarizerHistory() {
  const container = document.getElementById("sumHistory");
  if (!container) return;
  container.innerHTML = appState.summaryHistory.length
    ? `<div style="display:flex;flex-direction:column;gap:10px;">${appState.summaryHistory.map(summaryCardHTML).join("")}</div>`
    : renderEmptyState("file-lines", "No summaries yet — generate one above.");
  document.querySelectorAll("[data-sum-history]").forEach((btn) => {
    btn.addEventListener("click", () => loadHistorySummary(btn.dataset.sumHistory));
  });
  document.querySelectorAll("[data-sum-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteSummary(btn.dataset.sumDelete));
  });
}

export {
  renderSummarizer,
  generateSummary,
  buildLocalSummary,
  saveSummaryToNotes,
  copySummary,
  exportSummary,
};
