// ============================================
// QuizNova X — material.js
// File upload, AI text extraction, material management
// ============================================

import { appState, saveState } from "./state.js";
import { callGemini, buildPrompt } from "./ai.js";
import { showToast, showLoader, hideLoader, confirmAction, renderEmptyState } from "./ui.js";
import { escapeHTML, escapeAttr, generateId, formatDate } from "./utils.js";
import { addNote } from "./notes.js";
import { logActivity } from "./gamification.js";
import { trackUsage } from "./usage.js";

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const FILE_ACCEPT = ".txt,.pdf,.png,.jpg,.jpeg,image/*";

// ---- Cross-view context (consumed by quiz/flashcards/summarizer/mindmap) ----
function setContext(ctx) {
  window.quiznovaContext = window.quiznovaContext || {};
  Object.assign(window.quiznovaContext, ctx);
}

// ---- Helpers ----
function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function typeIcon(type) {
  const t = (type || "").toLowerCase();
  if (t.includes("pdf")) return "fa-file-pdf";
  if (t.startsWith("image/")) return "fa-file-image";
  if (t.includes("text")) return "fa-file-lines";
  return "fa-file";
}

function extensionType(name) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (["png", "jpg", "jpeg", "gif", "webp"].includes(ext)) {
    return `image/${ext === "jpg" ? "jpeg" : ext}`;
  }
  return "text/plain";
}

// ---- File → base64 (for Gemini inline_data) ----
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || "");
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

// ---- Extract text: txt direct, pdf/image via Gemini ----
async function extractText(file) {
  const isText = file.type.startsWith("text/") || /\.txt$/i.test(file.name);
  if (isText) {
    return await file.text();
  }
  const base64 = await fileToBase64(file);
  const prompt =
    "Extract all the text content from this file. Return only the extracted text, with no extra commentary.";
  return await callGemini(prompt, { mimeType: file.type || extensionType(file.name), data: base64 });
}

// ---- Single file upload ----
async function handleFileUpload(file) {
  if (!file) return;
  if (file.size > MAX_FILE_SIZE) {
    showToast(`"${file.name}" is larger than 10MB.`, "error");
    return;
  }
  showLoader(`Extracting text from "${file.name}"...`);
  try {
    const text = await extractText(file);
    const material = {
      id: generateId(),
      name: file.name,
      type: file.type || extensionType(file.name),
      size: file.size,
      text: text || "",
      uploadedAt: Date.now(),
    };
    appState.studyMaterial.push(material);
    saveState();
    logActivity(`Uploaded material "${file.name}"`, "Material");
    showToast(`Added "${file.name}".`, "success");
    renderMaterial();
  } catch (err) {
    console.error("[QuizNova] Upload failed:", err);
    showToast(`Could not read "${file.name}": ${err.message || "unknown error"}`, "error");
  } finally {
    hideLoader();
  }
}

async function handleFiles(fileList) {
  for (const file of Array.from(fileList || [])) {
    await handleFileUpload(file);
  }
}

// ---- Delete ----
async function deleteMaterial(id) {
  const m = appState.studyMaterial.find((x) => x.id === id);
  if (!m) return;
  const ok = await confirmAction(`Delete "${m.name}"?`);
  if (!ok) return;
  appState.studyMaterial = appState.studyMaterial.filter((x) => x.id !== id);
  saveState();
  showToast("Material deleted.", "info");
  renderMaterial();
}

// ---- Material action buttons ----
async function handleMaterialAction(action, id) {
  const m = appState.studyMaterial.find((x) => x.id === id);
  if (!m) return;

  switch (action) {
    case "quiz":
      setContext({ materialId: m.id });
      window.nav("quiz");
      break;
    case "flashcards":
      setContext({ materialId: m.id });
      window.nav("flashcards");
      break;
    case "summarize":
      setContext({ materialId: m.id });
      window.nav("summarizer");
      break;
    case "mindmap":
      setContext({ materialId: m.id });
      window.nav("mindmap");
      break;
    case "notes": {
      showLoader("Generating notes from material...");
      try {
        const content = await callGemini(
          buildPrompt(
            `Convert the following study material into clear, structured notes with headings, bullet points and key takeaways:\n\n${(m.text || "").slice(0, 12000)}`
          )
        );
        addNote(`Notes — ${m.name}`, content, "AI-Generated");
        trackUsage(m.id, "notes");
        showToast("Notes created from material.", "success");
        window.nav("notes");
      } catch (err) {
        showToast(`Failed to generate notes: ${err.message}`, "error");
      } finally {
        hideLoader();
      }
      break;
    }
    case "delete":
      deleteMaterial(id);
      break;
  }
}

// ---- Render ----
function materialCard(m) {
  const preview = (m.text || "").trim().slice(0, 200);
  return `<div class="card material-card" data-id="${m.id}">
    <div style="display:flex;gap:14px;align-items:flex-start;">
      <div style="font-size:2rem;color:var(--primary);"><i class="fa-solid ${typeIcon(m.type)}"></i></div>
      <div style="flex:1;min-width:0;">
        <h3 style="font-size:.95rem;word-break:break-word;">${escapeHTML(m.name)}</h3>
        <p style="font-size:.75rem;color:var(--text-muted);">${formatBytes(m.size)} · ${formatDate(m.uploadedAt)}</p>
      </div>
    </div>
    <p class="card-subtitle" style="margin-top:10px;">${
      preview
        ? escapeHTML(preview) + (m.text.trim().length > 200 ? "…" : "")
        : `<span style="color:var(--text-muted);">No extracted text.</span>`
    }</p>
    <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:12px;">
      <button class="btn btn-primary btn-sm" data-material-action="quiz" data-id="${m.id}"><i class="fa-solid fa-list-check"></i> Generate Quiz</button>
      <button class="btn btn-ghost btn-sm" data-material-action="flashcards" data-id="${m.id}"><i class="fa-solid fa-layer-group"></i> Generate Flashcards</button>
      <button class="btn btn-ghost btn-sm" data-material-action="notes" data-id="${m.id}"><i class="fa-solid fa-note-sticky"></i> Extract Notes</button>
      <button class="btn btn-ghost btn-sm" data-material-action="summarize" data-id="${m.id}"><i class="fa-solid fa-file-lines"></i> Summarize</button>
      <button class="btn btn-ghost btn-sm" data-material-action="mindmap" data-id="${m.id}"><i class="fa-solid fa-diagram-project"></i> Build Mind Map</button>
      <button class="btn btn-danger btn-sm" data-material-action="delete" data-id="${m.id}" aria-label="Delete"><i class="fa-solid fa-trash"></i> Delete</button>
    </div>
  </div>`;
}

function renderMaterial() {
  const view = document.getElementById("view-material");
  if (!view) return;
  const materials = appState.studyMaterial;

  view.innerHTML = `
    <div class="view-heading">
      <h2>My Material</h2>
      <span class="badge badge-primary">${materials.length} file${materials.length === 1 ? "" : "s"}</span>
    </div>
    <div id="dropZone" style="border:2px dashed var(--border);border-radius:14px;padding:36px 20px;text-align:center;cursor:pointer;transition:border-color .2s, background .2s;background:var(--bg);margin-bottom:18px;">
      <i class="fa-solid fa-cloud-arrow-up" style="font-size:2.4rem;color:var(--primary);"></i>
      <p style="margin-top:10px;"><strong>Drop files or click</strong> to upload</p>
      <p style="font-size:.8rem;color:var(--text-muted);margin-top:4px;">.txt · .pdf · .png · .jpg · max 10MB</p>
      <input type="file" id="materialFileInput" accept="${FILE_ACCEPT}" multiple hidden>
    </div>
    ${
      materials.length
        ? `<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:14px;">
             ${materials.map(materialCard).join("")}
           </div>`
        : renderEmptyState("folder-open", "No material yet — upload a file to get started.")
    }
  `;

  bindDropZone(view);
  view.querySelectorAll("[data-material-action]").forEach((btn) => {
    btn.addEventListener("click", () => handleMaterialAction(btn.dataset.materialAction, btn.dataset.id));
  });
}

function bindDropZone(view) {
  const zone = view.querySelector("#dropZone");
  const input = view.querySelector("#materialFileInput");
  if (!zone || !input) return;

  const highlight = () => {
    zone.style.borderColor = "var(--primary)";
    zone.style.background = "var(--active-bg)";
  };
  const unhighlight = () => {
    zone.style.borderColor = "var(--border)";
    zone.style.background = "var(--bg)";
  };

  ["dragenter", "dragover"].forEach((ev) =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      highlight();
    })
  );
  ["dragleave", "drop"].forEach((ev) =>
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      unhighlight();
    })
  );
  zone.addEventListener("drop", (e) => handleFiles(e.dataTransfer && e.dataTransfer.files));
  zone.addEventListener("click", () => input.click());
  input.addEventListener("change", () => {
    handleFiles(input.files);
    input.value = "";
  });
}

export {
  renderMaterial,
  handleFileUpload,
  handleFiles,
  deleteMaterial,
  extractText,
  MAX_FILE_SIZE,
  setContext,
};
