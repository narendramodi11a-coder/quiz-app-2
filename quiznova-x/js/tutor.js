// ============================================
// QuizNova X — tutor.js
// AI tutor chat with selectable personalities
// ============================================

import { appState, saveState } from "./state.js";
import { callGemini, buildPrompt } from "./ai.js";
import { showToast, renderEmptyState } from "./ui.js";
import { escapeHTML, escapeAttr, generateId, formatDate } from "./utils.js";
import { mascot } from "./mascot.js";
import { addNote } from "./notes.js";

const PERSONALITIES = {
  professor: {
    label: "Professor",
    icon: "fa-graduation-cap",
    system:
      "You are a rigorous but warm university professor. Explain concepts thoroughly, define every term, and check the learner's understanding step by step.",
  },
  coach: {
    label: "Academic Coach",
    icon: "fa-bullseye",
    system:
      "You are a supportive academic coach. Break problems into small steps, ask short check-in questions, and keep the learner motivated toward their goal.",
  },
  friend: {
    label: "Study Buddy",
    icon: "fa-handshake",
    system:
      "You are a friendly study buddy. Explain things casually with everyday analogies, be encouraging, and keep the tone light and fun.",
  },
  expert: {
    label: "Friendly Expert",
    icon: "fa-user-graduate",
    system:
      "You are an approachable domain expert. Give clear, concise, practical answers with concrete examples and actionable advice.",
  },
};

const MAX_HISTORY = 8;

let chat = {
  messages: [],
  personality: "professor",
  restrictToMaterial: true,
  eli5: false,
  busy: false,
};

// ============================================
// View
// ============================================

function renderTutor() {
  const view = document.getElementById("view-tutor");
  if (!view) return;

  view.innerHTML = `
    <div class="view-section">
      <div class="view-heading">
        <h2>AI Tutor</h2>
        <button class="btn btn-ghost btn-sm" id="tutorClear"><i class="fa-solid fa-eraser"></i> Clear</button>
      </div>

      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span class="label" style="margin:0;">Personality</span>
            <select class="select" id="tutorPersonality" style="width:auto;">
              ${Object.entries(PERSONALITIES)
                .map(
                  ([key, v]) =>
                    `<option value="${key}" ${key === chat.personality ? "selected" : ""}>${
                      v.label
                    }</option>`
                )
                .join("")}
            </select>
          </div>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <span class="toggle-switch">
              <input type="checkbox" id="tutorRestrict" ${chat.restrictToMaterial ? "checked" : ""}>
              <span class="slider"></span>
            </span>
            <span style="font-size:.85rem;">Use my material</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
            <span class="toggle-switch">
              <input type="checkbox" id="tutorEli5" ${chat.eli5 ? "checked" : ""}>
              <span class="slider"></span>
            </span>
            <span style="font-size:.85rem;">Explain like I'm 5</span>
          </label>
        </div>
      </div>

      <div class="chat-bubbles" id="tutorChat"></div>

      <div class="chat-input-bar">
        <textarea class="input" id="tutorInput" rows="1" placeholder="Ask anything about your studies..." style="resize:none;"></textarea>
        <button class="btn btn-primary" id="tutorSend" title="Send"><i class="fa-solid fa-paper-plane"></i></button>
      </div>
    </div>`;

  const personalitySel = view.querySelector("#tutorPersonality");
  personalitySel.addEventListener("change", () => {
    chat.personality = personalitySel.value;
    showToast(`Personality set to ${PERSONALITIES[chat.personality].label}.`, "info");
  });
  view.querySelector("#tutorRestrict").addEventListener("change", (e) => {
    chat.restrictToMaterial = e.target.checked;
  });
  view.querySelector("#tutorEli5").addEventListener("change", (e) => {
    chat.eli5 = e.target.checked;
  });
  view.querySelector("#tutorClear").addEventListener("click", clearChat);
  view.querySelector("#tutorSend").addEventListener("click", () => {
    const input = view.querySelector("#tutorInput");
    sendMessage(input.value);
    input.value = "";
  });

  const input = view.querySelector("#tutorInput");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input.value);
      input.value = "";
    }
  });

  renderChat();
  if (chat.messages.length) scrollToBottom();
}

function scrollToBottom() {
  const el = document.getElementById("tutorChat");
  if (el && typeof el.scrollIntoView === "function") {
    try {
      el.scrollIntoView({ block: "end" });
    } catch (_) {
      // non-browser environment
    }
  }
}

// ============================================
// Chat rendering
// ============================================

function renderChat() {
  const el = document.getElementById("tutorChat");
  if (!el) return;

  if (!chat.messages.length) {
    el.innerHTML = renderEmptyState("fa-robot", "Ask me anything about your studies.");
    return;
  }

  el.innerHTML = chat.messages
    .map(
      (m) => `
    <div class="bubble ${m.role === "user" ? "bubble-user" : "bubble-ai"}">
      ${
        m.role === "ai"
          ? `<div style="display:flex;gap:6px;margin-bottom:6px;flex-wrap:wrap;">
              <button class="btn btn-ghost btn-sm" data-copy="${escapeAttr(m.id)}"><i class="fa-solid fa-copy"></i> Copy</button>
              <button class="btn btn-ghost btn-sm" data-save="${escapeAttr(m.id)}"><i class="fa-solid fa-note-sticky"></i> Save to Notes</button>
            </div>`
          : ""
      }
      <div>${m.role === "ai" ? markdownToHTML(m.text) : escapeHTML(m.text)}</div>
    </div>`
    )
    .join("");

  el.querySelectorAll("[data-copy]").forEach((btn) => {
    btn.addEventListener("click", () => copyMessage(btn.dataset.copy));
  });
  el.querySelectorAll("[data-save]").forEach((btn) => {
    btn.addEventListener("click", () => saveReplyToNotes(btn.dataset.save));
  });
  scrollToBottom();
}

// ============================================
// Messaging
// ============================================

async function sendMessage(rawText) {
  const text = (rawText || "").trim();
  if (!text) return;
  if (chat.busy) {
    showToast("The tutor is still typing...", "info");
    return;
  }
  chat.messages.push({ role: "user", text, id: generateId() });
  renderChat();
  showTyping();
  chat.busy = true;

  try {
    const reply = await callGemini(buildPrompt(buildTutorPrompt(text)));
    chat.messages.push({ role: "ai", text: reply, id: generateId() });
    mascot.react("reading");
  } catch (err) {
    chat.messages.push({
      role: "ai",
      text: `I ran into a problem: ${err.message}`,
      id: generateId(),
    });
  } finally {
    chat.busy = false;
    renderChat();
  }
}

function showTyping() {
  const el = document.getElementById("tutorChat");
  if (!el) return;
  const typing = document.createElement("div");
  typing.className = "bubble bubble-ai";
  typing.id = "tutorTyping";
  typing.innerHTML = `<span class="typing-dots"><span></span><span></span><span></span></span>`;
  el.appendChild(typing);
  scrollToBottom();
}

// Build the full prompt sent to Gemini.
function buildTutorPrompt(userText) {
  const p = PERSONALITIES[chat.personality] || PERSONALITIES.professor;
  const lang = appState.settings.language || "English";
  const parts = [p.system, `You are chatting with a ${lang}-speaking learner.`];

  if (chat.eli5) {
    parts.push("Explain like I'm 5 years old: use simple words, analogies, and keep answers short.");
  }

  if (chat.restrictToMaterial) {
    const materials = (appState.studyMaterial || []).filter((m) => m.text && m.text.trim());
    if (materials.length) {
      parts.push(
        `Answer ONLY from the study material below. If the answer is not in it, say so and suggest what to study next.\nMATERIAL:\n${materials
          .map((m) => `--- ${m.name} ---\n${m.text.slice(0, 2000)}`)
          .join("\n")}`
      );
    } else {
      parts.push("Note: the learner has not uploaded any study material yet, so answer generally.");
    }
  }

  const recent = chat.messages.slice(-MAX_HISTORY).filter((m) => m.role === "user");
  if (recent.length > 1) {
    parts.push(`Questions the learner recently asked: ${recent.map((m) => m.text).join(" | ")}`);
  }

  parts.push(`Now answer this question: ${userText}`);
  return parts.join("\n\n");
}

function clearChat() {
  chat.messages = [];
  renderChat();
  showToast("Chat cleared.", "info");
}

// ============================================
// Message actions
// ============================================

function saveReplyToNotes(messageId) {
  const m = chat.messages.find((x) => x.id === messageId && x.role === "ai");
  if (!m) return;
  addNote(`Tutor Chat - ${formatDate(Date.now())}`, m.text, "AI Tutor");
  showToast("Saved to notes. +5 XP", "success");
}

async function copyMessage(messageId) {
  const m = chat.messages.find((x) => x.id === messageId);
  if (!m) return;
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(m.text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = m.text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    showToast("Copied to clipboard.", "success");
  } catch (_) {
    showToast("Could not copy.", "error");
  }
}

// Pre-fill the input box (used by mind map nodes / skill tree later).
function prefilledQuestion(text) {
  const input = document.getElementById("tutorInput");
  if (input) {
    input.value = text || "";
    input.focus();
  }
}

// ============================================
// Markdown-lite → safe HTML
// ============================================

function markdownToHTML(text) {
  let out = escapeHTML(text || "");

  out = out.replace(/`([^`]+)`/g, "<code>$1</code>");

  out = out.replace(/^#{1,3}\s+(.+)$/gm, "<h4>$1</h4>");

  out = out.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  out = out.replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, "$1<em>$2</em>");

  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

  out = out.replace(/^[ \t]*[-*]\s+(.+)$/gm, "<li>$1</li>");
  out = out.replace(/(<li>.*<\/li>)/gs, "<ul>$1</ul>");

  out = out.replace(/^[ \t]*\d+[.)]\s+(.+)$/gm, "<li>$1</li>");
  out = out.replace(/(<li>.*<\/li>)/gs, "<ol>$1</ol>");

  out = out.replace(/^&gt;\s?(.+)$/gm, "<blockquote>$1</blockquote>");

  out = out.replace(/\n{2,}/g, "</p><p>");
  out = out.replace(/\n/g, "<br>");
  out = `<p>${out}</p>`;
  return out;
}

export {
  renderTutor,
  sendMessage,
  clearChat,
  buildTutorPrompt,
  saveReplyToNotes,
  copyMessage,
  prefilledQuestion,
  markdownToHTML,
  PERSONALITIES,
};
