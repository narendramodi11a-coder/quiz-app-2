// ============================================
// QuizNova X — roadmap.js
// AI-generated day-by-day study roadmaps
// ============================================

import { appState, saveState } from "./state.js";
import { callGemini, buildPrompt, parseJSONResponse } from "./ai.js";
import {
  showToast,
  showLoader,
  hideLoader,
  confirmAction,
  renderEmptyState,
} from "./ui.js";
import { escapeHTML, escapeAttr, generateId, formatDate } from "./utils.js";
import { addXP, checkAchievements, completeChallenge, logActivity } from "./gamification.js";
import { mascot } from "./mascot.js";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const HOURS_OPTIONS = [1, 2, 3, 4];
const DURATION_OPTIONS = [1, 3, 7, 14, 30];
const ROADMAP_COMPLETE_XP = 100;

// ============================================
// View
// ============================================

function renderRoadmapUI() {
  const view = document.getElementById("view-roadmap");
  if (!view) return;
  if (!appState.roadmap) {
    renderRoadmapSetup();
    return;
  }
  renderTimeline();
}

function renderRoadmapSetup() {
  const view = document.getElementById("view-roadmap");
  view.innerHTML = `
    <div class="view-section">
      <div class="view-heading"><h2>Create Your Roadmap</h2></div>
      <p class="card-subtitle">Tell us what you want to learn — we'll build a day-by-day plan.</p>
      <div class="card" style="max-width:560px;margin:18px auto 0;">
        <form id="roadmapForm">
          <label class="label" for="rmTopic">What do you want to learn?</label>
          <input class="input" id="rmTopic" placeholder="e.g. Machine Learning, Spanish, Guitar..." maxlength="80" required>

          <label class="label" for="rmLevel" style="margin-top:12px;">Your current level</label>
          <select class="select" id="rmLevel">
            ${LEVELS.map((l) => `<option>${l}</option>`).join("")}
          </select>

          <label class="label" for="rmHours" style="margin-top:12px;">Hours per day</label>
          <select class="select" id="rmHours">
            ${HOURS_OPTIONS.map(
              (h) => `<option value="${h}">${h} hour${h > 1 ? "s" : ""}</option>`
            ).join("")}
          </select>

          <label class="label" for="rmDays" style="margin-top:12px;">Duration</label>
          <select class="select" id="rmDays">
            ${DURATION_OPTIONS.map(
              (d) => `<option value="${d}">${d} day${d > 1 ? "s" : ""}</option>`
            ).join("")}
            <option value="custom">Custom</option>
          </select>
          <div id="rmCustomWrap" style="display:none;margin-top:10px;">
            <input class="input" id="rmCustomDays" type="number" min="1" max="90" placeholder="Number of days">
          </div>

          <button class="btn btn-primary btn-block" type="submit" style="margin-top:16px;">
            <i class="fa-solid fa-wand-magic-sparkles"></i> Generate Roadmap
          </button>
        </form>
      </div>
    </div>`;

  const daysSel = view.querySelector("#rmDays");
  const customWrap = view.querySelector("#rmCustomWrap");
  daysSel.addEventListener("change", () => {
    customWrap.style.display = daysSel.value === "custom" ? "block" : "none";
  });
  view.querySelector("#roadmapForm").addEventListener("submit", (e) => {
    e.preventDefault();
    generateRoadmap();
  });
}

// ============================================
// Generation
// ============================================

function readSetup() {
  const view = document.getElementById("view-roadmap");
  const val = (sel) => (view.querySelector(sel) || {}).value || "";
  const topic = val("#rmTopic").trim();
  if (!topic) {
    showToast("Enter a topic first.", "warning");
    return null;
  }
  let days = Number(val("#rmDays"));
  if (Number.isNaN(days) || val("#rmDays") === "custom") {
    days = Number(val("#rmCustomDays")) || 14;
  }
  days = Math.max(1, Math.min(90, days));
  return {
    topic,
    level: val("#rmLevel") || "Beginner",
    hoursPerDay: Number(val("#rmHours")) || 1,
    days,
  };
}

function normalizeRoadmap(base, daysArr) {
  return {
    id: generateId(),
    topic: base.topic,
    level: base.level,
    hoursPerDay: base.hoursPerDay,
    totalDays: daysArr.length,
    title: base.title || `Roadmap: ${base.topic}`,
    createdAt: Date.now(),
    completed: false,
    completedAt: null,
    days: daysArr.slice(0, 90).map((d, i) => ({
      day: i + 1,
      focus: String(d.focus || d.title || `Day ${i + 1}`),
      description: String(d.description || ""),
      tasks: (Array.isArray(d.tasks) ? d.tasks : [])
        .map((t) => ({ id: generateId(), title: String((t && t.title) || t).trim() || "Task" }))
        .filter((t) => t.title)
        .map((t) => ({ ...t, completed: false })),
    })),
  };
}

async function generateRoadmap() {
  const setup = readSetup();
  if (!setup) return;
  const lang = appState.settings.language || "English";

  showLoader(`Building your ${setup.days}-day roadmap...`);
  try {
    const prompt =
      `You are an expert curriculum designer. Create a ${setup.days}-day study roadmap for ` +
      `learning "${setup.topic}" at ${setup.level} level, ${setup.hoursPerDay} hour(s) per day.\n` +
      `Return ONLY valid JSON (no markdown fences): ` +
      `{"title": "short roadmap title", "days": [{"day": 1, "focus": "topic focus", "description": "what to study", "tasks": ["task 1", "task 2", "task 3"]}]}. ` +
      `Each day should have exactly 3 tasks that are specific and actionable, and progress should build logically across days.`;

    const raw = await callGemini(buildPrompt(prompt, lang));
    const parsed = parseJSONResponse(raw);
    const daysArr = Array.isArray(parsed) ? parsed : parsed && parsed.days;
    if (!Array.isArray(daysArr) || !daysArr.length) {
      throw new Error("The AI did not return a valid roadmap.");
    }

    const base = Array.isArray(parsed) ? {} : parsed;
    appState.roadmap = normalizeRoadmap({ ...base, ...setup }, daysArr);
    saveState();
    checkAchievements(); // firstRoadmap / Path Finder
    logActivity(`Created roadmap: ${appState.roadmap.title}`, "Roadmap");
    showToast("Roadmap created!", "success");
    mascot.react("reading");
    renderRoadmapUI();
  } catch (err) {
    console.error("[QuizNova] Roadmap generation failed:", err);
    showToast(err.message || "Failed to generate the roadmap.", "error");
  } finally {
    hideLoader();
  }
}

// ============================================
// Timeline view
// ============================================

function currentDayIndex(rm) {
  const idx = rm.days.findIndex((d) => !d.tasks.every((t) => t.completed));
  return idx === -1 ? rm.days.length - 1 : idx;
}

function timelineItemHTML(d, i, currentIdx) {
  const allDone = d.tasks.every((t) => t.completed);
  const status = i < currentIdx || allDone ? "completed" : i === currentIdx ? "current" : "locked";
  return `
    <div class="timeline-item">
      <div class="timeline-node ${status}">${status === "completed" ? "✓" : d.day}</div>
      <div class="timeline-card" style="${status === "locked" ? "opacity:.65;" : ""}">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <h4>Day ${d.day} · ${escapeHTML(d.focus)}</h4>
          ${allDone ? '<span class="badge badge-success">done</span>' : ""}
        </div>
        ${d.description ? `<p style="margin-top:4px;">${escapeHTML(d.description)}</p>` : ""}
        <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px;">
          ${d.tasks
            .map(
              (t) => `
            <label style="display:flex;align-items:center;gap:10px;cursor:${
              i <= currentIdx ? "pointer" : "not-allowed"
            };opacity:${t.completed ? 0.6 : 1};">
              <input type="checkbox" data-day="${i}" data-task="${escapeAttr(
                t.id
              )}" ${t.completed ? "checked" : ""} ${i > currentIdx ? "disabled" : ""} style="width:16px;height:16px;accent-color:var(--primary);">
              <span style="text-decoration:${t.completed ? "line-through" : "none"};">${escapeHTML(
                t.title
              )}</span>
            </label>`
            )
            .join("")}
        </div>
      </div>
    </div>`;
}

function renderTimeline() {
  const view = document.getElementById("view-roadmap");
  const rm = appState.roadmap;
  if (!rm) {
    renderRoadmapSetup();
    return;
  }
  const currentIdx = currentDayIndex(rm);
  const totalTasks = rm.days.reduce((s, d) => s + d.tasks.length, 0);
  const doneTasks = rm.days.reduce((s, d) => s + d.tasks.filter((t) => t.completed).length, 0);
  const pct = totalTasks ? Math.round((doneTasks / totalTasks) * 100) : 0;

  view.innerHTML = `
    <div class="view-section">
      <div class="view-heading">
        <h2>${escapeHTML(rm.title)}</h2>
        <button class="btn btn-ghost btn-sm" id="rmDelete"><i class="fa-solid fa-trash"></i> Delete</button>
      </div>
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;margin-bottom:10px;">
          <span class="tag">${escapeHTML(rm.topic)}</span>
          <span class="badge badge-info">${escapeHTML(rm.level)}</span>
          <span class="badge badge-primary">${rm.hoursPerDay}h/day</span>
          ${
            rm.completed
              ? '<span class="badge badge-success">Completed 🎉</span>'
              : `<span class="badge badge-warning">Day ${currentIdx + 1} of ${rm.days.length}</span>`
          }
        </div>
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <p class="card-subtitle" style="margin-top:6px;">${doneTasks}/${totalTasks} tasks done · ${pct}% complete</p>
        ${
          rm.completed
            ? `<p class="card-subtitle" style="margin-top:4px;">Roadmap finished ${formatDate(
                rm.completedAt
              )}. 🏁 +${ROADMAP_COMPLETE_XP} XP earned.</p>`
            : ""
        }
      </div>
      <div class="timeline">
        ${rm.days.map((d, i) => timelineItemHTML(d, i, currentIdx)).join("")}
      </div>
    </div>`;

  view.querySelector("#rmDelete").addEventListener("click", deleteRoadmap);
  view.querySelectorAll("input[data-task]").forEach((cb) => {
    cb.addEventListener("change", () => {
      markTaskComplete(Number(cb.dataset.day), cb.dataset.task, cb.checked);
    });
  });
}

// ============================================
// Task progression
// ============================================

function markTaskComplete(dayIdx, taskId, checked) {
  const rm = appState.roadmap;
  if (!rm || !rm.days[dayIdx]) return;
  const day = rm.days[dayIdx];
  const task = day.tasks.find((t) => t.id === taskId);
  if (!task) return;

  task.completed = !!checked;
  if (task.completed) completeChallenge("roadmap");

  const dayDone = day.tasks.every((t) => t.completed);
  const allDone = rm.days.every((d) => d.tasks.every((t) => t.completed));

  if (allDone && !rm.completed) {
    rm.completed = true;
    rm.completedAt = Date.now();
    saveState();
    addXP(ROADMAP_COMPLETE_XP, "Roadmap completed");
    checkAchievements();
    mascot.react("celebrating");
    showToast(`Roadmap complete! +${ROADMAP_COMPLETE_XP} XP 🎉`, "success");
  } else if (dayDone) {
    saveState();
    mascot.react("encouraging");
    showToast(`Day ${day.day} complete! 🎉`, "success");
  } else {
    saveState();
  }
  renderTimeline();
}

async function deleteRoadmap() {
  const ok = await confirmAction("Delete this roadmap and all its progress?");
  if (!ok) return;
  appState.roadmap = null;
  saveState();
  showToast("Roadmap deleted.", "info");
  renderRoadmapUI();
}

// ============================================
// Dashboard helper
// ============================================

function getNextTask() {
  const rm = appState.roadmap;
  if (!rm) return null;
  if (Array.isArray(rm.days)) {
    for (const d of rm.days) {
      const t = d.tasks.find((x) => !x.completed);
      if (t) return { id: t.id, title: t.title, day: d.day, focus: d.focus, completed: false };
    }
    return null;
  }
  // Legacy shape: { tasks: [...] }
  const legacy = rm.tasks || rm.nodes;
  if (!Array.isArray(legacy) || !legacy.length) return null;
  return legacy.find((t) => !t.completed) || legacy[legacy.length - 1] || null;
}

export {
  renderRoadmapUI,
  renderRoadmapSetup,
  generateRoadmap,
  normalizeRoadmap,
  renderTimeline,
  markTaskComplete,
  deleteRoadmap,
  currentDayIndex,
  getNextTask,
  ROADMAP_COMPLETE_XP,
};
