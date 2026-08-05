// ============================================
// QuizNova X — analytics.js
// History feed + Progress analytics (charts/heatmap)
// ============================================

import { appState, saveState } from "./state.js";
import { renderEmptyState, errorState, showToast } from "./ui.js";
import { escapeHTML, escapeAttr, timeAgo, formatDate } from "./utils.js";
import { averageAccuracy, totalFCReviews, logActivity } from "./gamification.js";
import { getMaterialUsage, materialUsageTotals } from "./usage.js";
import {
  todayStudyMinutes,
  totalStudyHours,
  dailyGoalMinutes,
  dailyGoalProgress,
  getXPSeries,
  getWeekSeries,
  flashcardStats,
  dateKey,
} from "./progress.js";

// ---- Chart instance registry (destroy before re-render to avoid leaks) ----
let chartRegistry = [];

function destroyCharts() {
  chartRegistry.forEach((c) => {
    try {
      c.destroy();
    } catch (_) {
      // ignore destroyed charts
    }
  });
  chartRegistry = [];
}

function registerChart(chart) {
  if (chart) chartRegistry.push(chart);
}

// ============================================
// History
// ============================================

const TYPE_META = {
  quiz: { icon: "fa-list-check", label: "Quiz" },
  note: { icon: "fa-note-sticky", label: "Note" },
  flashcards: { icon: "fa-layer-group", label: "Flashcards" },
  roadmap: { icon: "fa-map", label: "Roadmap" },
  summary: { icon: "fa-file-lines", label: "Summary" },
  mindmap: { icon: "fa-diagram-project", label: "Mind Map" },
  activity: { icon: "fa-bolt", label: "XP" },
};

function buildHistoryFeed() {
  const feed = [];
  for (const q of appState.history || []) {
    feed.push({
      type: "quiz",
      id: q.id,
      date: q.date,
      title: `Quiz: ${q.topic || "Untitled"}`,
      detail: `${q.score}/${q.total} · ${q.accuracy}% · ${q.mode}`,
      xp: q.xp,
      accent: q.accuracy >= 80 ? "success" : "danger",
    });
  }
  for (const n of appState.notes || []) {
    feed.push({
      type: "note",
      id: n.id,
      date: n.createdAt || n.updatedAt,
      title: `Note: ${n.title || "Untitled"}`,
      detail: n.source || "Manual",
      xp: null,
      accent: "info",
    });
  }
  for (const d of appState.flashcardDecks || []) {
    feed.push({
      type: "flashcards",
      id: d.id,
      date: d.createdAt,
      title: `Deck: ${d.title || "Untitled"}`,
      detail: `${(d.cards || []).length} cards`,
      xp: null,
      accent: "warning",
    });
  }
  const rm = appState.roadmap;
  if (rm) {
    feed.push({
      type: "roadmap",
      date: rm.completedAt || rm.createdAt,
      title: `Roadmap: ${rm.topic || rm.title || "Untitled"}`,
      detail: rm.completed ? "Completed" : "In progress",
      xp: rm.completed ? 100 : null,
      accent: "primary",
    });
  }
  for (const s of appState.summaryHistory || []) {
    feed.push({
      type: "summary",
      id: s.id,
      date: s.date,
      title: `Summary: ${s.title || "Untitled"}`,
      detail: `${s.length || "medium"} · ${(s.summary || "").length} chars`,
      xp: null,
      accent: "info",
    });
  }
  for (const m of appState.mindMaps || []) {
    feed.push({
      type: "mindmap",
      id: m.id,
      date: m.createdAt,
      title: `Mind Map: ${m.title || "Untitled"}`,
      detail: `${(m.root && m.root.text) || "—"}`,
      xp: null,
      accent: "warning",
    });
  }
  for (const a of appState.activityLog || []) {
    feed.push({
      type: "activity",
      date: a.timestamp,
      title: a.title || "Activity",
      detail: "",
      xp: null,
      accent: "primary",
    });
  }
  return feed.sort((a, b) => (b.date || 0) - (a.date || 0));
}

let historyTypeFilter = "all";

function filterFeed(feed, typeFilter, query) {
  const q = String(query || "").trim().toLowerCase();
  return feed.filter((item) => {
    if (typeFilter !== "all" && item.type !== typeFilter) return false;
    if (q && !`${item.title} ${item.detail}`.toLowerCase().includes(q)) return false;
    return true;
  });
}

function renderHistory() {
  const view = document.getElementById("view-history");
  if (!view) return;

  const feed = buildHistoryFeed();
  const types = ["all", "quiz", "note", "flashcards", "roadmap", "summary", "mindmap"];

  view.innerHTML = `
    <div class="view-section">
      <div class="view-heading">
        <h2>History</h2>
        <span class="badge badge-primary">${feed.length} event${feed.length === 1 ? "" : "s"}</span>
      </div>
      <div class="card" style="margin-bottom:16px;">
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center;">
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            ${types
              .map(
                (key) =>
                  `<button class="btn btn-sm ${
                    historyTypeFilter === key ? "btn-primary" : "btn-ghost"
                  }" data-history-type="${key}">${
                    key === "all" ? "All" : (TYPE_META[key] || { label: key }).label
                  }</button>`
              )
              .join("")}
          </div>
          <input class="input" id="historySearch" placeholder="Search history..." style="max-width:240px;margin-left:auto;">
        </div>
      </div>
      <div id="historyList"></div>
      <div id="deletedSection"></div>
    </div>
  `;

  view.querySelectorAll("[data-history-type]").forEach((btn) => {
    btn.addEventListener("click", () => {
      historyTypeFilter = btn.dataset.historyType;
      renderHistory();
    });
  });

  const search = view.querySelector("#historySearch");
  if (search) {
    search.addEventListener("input", () => renderHistoryList(historyTypeFilter, search.value));
  }

  renderHistoryList(historyTypeFilter, "");
  renderTrashSection();
}

function historyItemHTML(item) {
  const meta = TYPE_META[item.type] || TYPE_META.activity;
  const xpBadge = item.xp
    ? `<span class="badge badge-success">+${item.xp} XP</span>`
    : "";
  const canDelete = item.id != null && item.type !== "roadmap" && item.type !== "activity";
  return `<div class="card" style="margin-bottom:10px;padding:14px 16px;">
    <div style="display:flex;gap:12px;align-items:center;">
      <div style="width:36px;height:36px;border-radius:10px;background:var(--active-bg);color:var(--primary);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid ${meta.icon}"></i></div>
      <div style="flex:1;min-width:0;">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
          <strong style="font-size:.9rem;">${escapeHTML(item.title)}</strong>
          <span class="badge badge-${item.accent || "info"}">${meta.label}</span>
          ${xpBadge}
        </div>
        ${item.detail ? `<p class="card-subtitle" style="margin:2px 0 0;">${escapeHTML(item.detail)}</p>` : ""}
      </div>
      ${
        canDelete
          ? `<button class="btn btn-ghost btn-sm" data-history-delete="${escapeAttr(item.type)}|${escapeAttr(item.id)}" title="Move to trash" style="flex-shrink:0;"><i class="fa-solid fa-trash-can"></i></button>`
          : ""
      }
      <span style="font-size:.75rem;color:var(--text-muted);white-space:nowrap;">${timeAgo(item.date)}</span>
    </div>
  </div>`;
}

function renderHistoryList(typeFilter, query) {
  const listEl = document.getElementById("historyList");
  if (!listEl) return;
  const items = filterFeed(buildHistoryFeed(), typeFilter, query);
  listEl.innerHTML = items.length
    ? items.map(historyItemHTML).join("")
    : renderEmptyState("clock-rotate-left", "No activity yet — go take a quiz!");

  listEl.querySelectorAll("[data-history-delete]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const [type, id] = btn.dataset.historyDelete.split("|");
      if (moveToTrash(type, id)) {
        renderHistoryList(historyTypeFilter, document.getElementById("historySearch")?.value || "");
        renderTrashSection();
      }
    });
  });
  renderTrashSection();
}

// ============================================
// Deleted items — soft delete + restore (Prompt 6)
// ============================================

const DELETABLE_SOURCES = {
  quiz: "history",
  note: "notes",
  flashcards: "flashcardDecks",
  summary: "summaryHistory",
  mindmap: "mindMaps",
};

function deletedItemsCount() {
  return (appState.deletedItems || []).length;
}

function moveToTrash(type, id) {
  const key = DELETABLE_SOURCES[type];
  if (!key) return false;
  const src = appState[key] || [];
  const idx = src.findIndex((x) => x.id === id);
  if (idx < 0) return false;
  const [obj] = src.splice(idx, 1);
  appState.deletedItems = appState.deletedItems || [];
  appState.deletedItems.unshift({ type, id, item: obj, deletedAt: Date.now() });
  if (appState.deletedItems.length > 50) appState.deletedItems.pop();
  logActivity(`Moved to trash: ${obj.title || obj.name || obj.topic || id}`, "History");
  saveState();
  window.dispatchEvent(new CustomEvent("quiznova:statechange"));
  showToast("Item moved to trash. Restore anytime from History.", "info");
  return true;
}

function restoreFromTrash(trashId) {
  const idx = (appState.deletedItems || []).findIndex((t) => t.deletedAt === trashId);
  if (idx < 0) return;
  const [entry] = appState.deletedItems.splice(idx, 1);
  const key = DELETABLE_SOURCES[entry.type];
  if (key) {
    appState[key] = appState[key] || [];
    appState[key].push(entry.item);
  }
  logActivity(`Restored: ${entry.item.title || entry.item.name || entry.item.topic || entry.id}`, "History");
  saveState();
  window.dispatchEvent(new CustomEvent("quiznova:statechange"));
  showToast("Item restored.", "success");
}

function deleteForever(trashId) {
  const idx = (appState.deletedItems || []).findIndex((t) => t.deletedAt === trashId);
  if (idx < 0) return;
  appState.deletedItems.splice(idx, 1);
  saveState();
  window.dispatchEvent(new CustomEvent("quiznova:statechange"));
  showToast("Item permanently deleted.", "success");
}

function trashRowHTML(entry) {
  const name = entry.item.title || entry.item.name || entry.item.topic || "Untitled";
  const meta = TYPE_META[entry.type] || TYPE_META.activity;
  return `<div class="card" style="margin-bottom:8px;padding:10px 14px;">
    <div style="display:flex;gap:10px;align-items:center;">
      <div style="width:32px;height:32px;border-radius:9px;background:var(--active-bg);color:var(--danger);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-trash-can"></i></div>
      <div style="flex:1;min-width:0;">
        <strong style="font-size:.85rem;">${escapeHTML(name)}</strong>
        <span class="badge badge-danger" style="margin-left:6px;">${meta.label}</span>
        <div style="font-size:.72rem;color:var(--text-muted);">Deleted ${timeAgo(entry.deletedAt)}</div>
      </div>
      <button class="btn btn-sm btn-ghost" data-trash-restore="${entry.deletedAt}"><i class="fa-solid fa-rotate-left"></i> Restore</button>
      <button class="btn btn-sm btn-danger" data-trash-delete="${entry.deletedAt}"><i class="fa-solid fa-trash-can"></i> Delete</button>
    </div>
  </div>`;
}

function renderTrashSection() {
  const el = document.getElementById("deletedSection");
  if (!el) return;
  const items = appState.deletedItems || [];
  if (!items.length) {
    el.innerHTML = "";
    return;
  }
  el.innerHTML = `
    <div class="card" style="margin-top:18px;">
      <div class="card-title">Recently Deleted <span class="badge badge-danger">${items.length}</span></div>
      <p class="card-subtitle">Restore content you moved to trash — it is stored locally.</p>
      <div id="deletedList">${items.map(trashRowHTML).join("")}</div>
    </div>`;
  el.querySelectorAll("[data-trash-restore]").forEach((b) =>
    b.addEventListener("click", () => restoreFromTrash(Number(b.dataset.trashRestore)))
  );
  el.querySelectorAll("[data-trash-delete]").forEach((b) =>
    b.addEventListener("click", () => deleteForever(Number(b.dataset.trashDelete)))
  );
}

// ============================================
// Progress
// ============================================

function statTileHTML(icon, value, label) {
  return `<div class="card stat-card">
    <span class="stat-value">${value}</span>
    <span class="stat-label"><i class="fa-solid fa-${icon}"></i> ${escapeHTML(label)}</span>
  </div>`;
}

function topicAccuracy() {
  const map = {};
  for (const h of appState.history || []) {
    const t = h.topic || "General";
    map[t] = map[t] || { total: 0, sum: 0 };
    map[t].total += 1;
    map[t].sum += h.accuracy || 0;
  }
  return Object.entries(map)
    .map(([topic, v]) => ({ topic, accuracy: Math.round(v.sum / v.total), count: v.total }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
}

function heatmapData(days = 90) {
  const counts = {};
  const stamp = (ts) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  };
  const touch = (ts) => {
    if (!ts) return;
    const key = stamp(ts);
    counts[key] = (counts[key] || 0) + 1;
  };
  for (const h of appState.history || []) touch(h.date);
  for (const n of appState.notes || []) touch(n.createdAt);
  for (const d of appState.flashcardDecks || []) touch(d.createdAt);
  for (const s of appState.summaryHistory || []) touch(s.date);
  for (const m of appState.mindMaps || []) touch(m.createdAt);
  for (const a of appState.activityLog || []) touch(a.timestamp);
  if (appState.roadmap) touch(appState.roadmap.completedAt || appState.roadmap.createdAt);
  return counts;
}

function renderHeatmap() {
  const counts = heatmapData();
  const today = new Date();
  const cells = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
    const n = counts[key] || 0;
    const level = n === 0 ? 0 : n === 1 ? 1 : n === 2 ? 2 : n === 3 ? 3 : 4;
    cells.push(`<div class="heatmap-cell level-${level}" title="${key}: ${n} activit${
      n === 1 ? "y" : "ies"
    }"></div>`);
  }
  return `<div class="heatmap">${cells.join("")}</div>
    <div class="heatmap-legend"><span>Less</span>
      <span class="heatmap-cell level-0"></span><span class="heatmap-cell level-1"></span>
      <span class="heatmap-cell level-2"></span><span class="heatmap-cell level-3"></span>
      <span class="heatmap-cell level-4"></span><span>More</span>
    </div>`;
}

function renderProgress() {
  const view = document.getElementById("view-progress");
  if (!view) return;

  const history = appState.history || [];
  const acc = Math.round(averageAccuracy(appState));
  const weak = (appState.weakTopics || []).slice(0, 6);
  const todayMin = todayStudyMinutes();
  const goalMin = dailyGoalMinutes();
  const goalPct = Math.round(dailyGoalProgress().percent);
  const materialUsage = getMaterialUsage();
  const usageTotals = materialUsageTotals();

  // If Chart.js is missing (CDN blocked), surface it instead of blank canvases.
  const chartError = typeof Chart === "undefined"
    ? errorState("Charts unavailable", "Chart.js could not be loaded from the CDN. Check your connection and reload.")
    : "";
  const chartShell = (hasData, canvasId, emptyHTML) =>
    chartError || (hasData ? `<canvas id="${canvasId}"></canvas>` : emptyHTML);

  view.innerHTML = `
    <div class="view-section">
      <div class="view-heading"><h2>Progress</h2></div>
      <div class="home-grid">
        ${statTileHTML("star", `${appState.profile.xp} XP`, "Total XP")}
        ${statTileHTML("ranking-star", appState.profile.level, "Level")}
        ${statTileHTML("list-check", history.length, "Quizzes Taken")}
        ${statTileHTML("bullseye", `${acc}%`, "Avg Accuracy")}
        ${statTileHTML("layer-group", totalFCReviews(appState), "Cards Reviewed")}
        ${statTileHTML("fire", appState.bestStreak, "Best Streak")}
        ${statTileHTML("clock", todayMin, "Today (min)")}
        ${statTileHTML("flag-checkered", `${goalPct}%`, `Goal ${goalMin} min`)}
      </div>

      <div class="card" style="margin-top:18px;">
        <div class="card-title">Daily Study Goal</div>
        <div class="goal-progress-wrap">
          <div class="goal-progress-bar"><div class="goal-progress-fill" style="width:${Math.min(100, goalPct)}%;"></div></div>
          <span class="goal-progress-label">${Math.min(goalPct, 100)}% of ${goalMin} min — ${todayMin}/${goalMin} min today</span>
        </div>
      </div>

      <div class="card" style="margin-top:18px;">
        <div class="card-title">Study Activity — last 90 days</div>
        ${renderHeatmap()}
      </div>

      <div class="home-grid" style="margin-top:18px;">
        <div class="card">
          <div class="card-title">Accuracy Over Time</div>
          <div style="position:relative;height:260px;">
            ${chartShell(history.length >= 2, "accuracyChart", `<div class="empty-state" style="padding:40px 10px;"><i class="fa-solid fa-chart-line"></i><div class="empty-title">${history.length === 1 ? "Take one more quiz to see a trend." : "Complete at least 2 quizzes to see the trend."}</div></div>`)}
          </div>
        </div>
        <div class="card">
          <div class="card-title">Accuracy by Topic</div>
          <div style="position:relative;height:260px;">
            ${chartShell(history.length, "topicChart", `<div class="empty-state" style="padding:40px 10px;"><i class="fa-solid fa-chart-pie"></i><div class="empty-title">Take a quiz to unlock topic analytics.</div></div>`)}
          </div>
        </div>
      </div>

      <div class="home-grid" style="margin-top:18px;">
        <div class="card">
          <div class="card-title">XP Growth</div>
          <div style="position:relative;height:240px;">
            ${chartShell((appState.xpHistory || []).length >= 2, "xpChart", `<div class="empty-state" style="padding:30px 10px;"><i class="fa-solid fa-chart-line"></i><div class="empty-title">Earn XP to see your growth curve.</div></div>`)}
          </div>
        </div>
        <div class="card">
          <div class="card-title">Study Time — last 7 days</div>
          <div style="position:relative;height:240px;">
            ${chartShell(totalStudyHours() > 0, "studyTimeChart", `<div class="empty-state" style="padding:30px 10px;"><i class="fa-solid fa-hourglass-half"></i><div class="empty-title">Log study time to see it here.</div></div>`)}
          </div>
        </div>
      </div>

      <div class="home-grid" style="margin-top:18px;">
        <div class="card">
          <div class="card-title">Flashcard Mastery</div>
          <div style="position:relative;height:220px;">
            ${chartShell(totalFCReviews(appState) > 0, "fcChart", `<div class="empty-state" style="padding:30px 10px;"><i class="fa-solid fa-layer-group"></i><div class="empty-title">Review flashcards to unlock this chart.</div></div>`)}
          </div>
        </div>
        <div class="card">
          <div class="card-title">Weekly Streak</div>
          <div style="position:relative;height:220px;">
            ${chartShell(totalStudyHours() > 0, "streakChart", `<div class="empty-state" style="padding:30px 10px;"><i class="fa-solid fa-fire"></i><div class="empty-title">Study minutes drive your weekly streak.</div></div>`)}
          </div>
        </div>
      </div>

      <div class="home-grid" style="margin-top:18px;">
        <div class="card">
          <div class="card-title">Material Usage</div>
          <p class="card-subtitle">${usageTotals.total} actions across ${materialUsage.length} file${materialUsage.length === 1 ? "" : "s"} — how you use your uploaded material.</p>
          <div style="position:relative;height:220px;">
            ${chartShell(materialUsage.length > 0, "usageChart", `<div class="empty-state" style="padding:30px 10px;"><i class="fa-solid fa-folder-open"></i><div class="empty-title">Generate quizzes, flashcards, summaries or mind maps from uploaded material to see it here.</div></div>`)}
          </div>
        </div>
      </div>

      ${
        weak.length
          ? `<div class="card" style="margin-top:18px;">
              <div class="card-title">Weak Topics</div>
              <p class="card-subtitle">Focus your study sessions here.</p>
              <div style="display:flex;flex-wrap:wrap;gap:8px;">${weak
                .map(
                  (t) =>
                    `<span class="tag">⚠️ ${escapeHTML(
                      typeof t === "string" ? t : t.topic || t.name || "Unknown"
                    )}</span>`
                )
                .join("")}</div>
            </div>`
          : ""
      }
    </div>
  `;

  renderAccuracyChart();
  renderTopicChart();
  renderXPGrowthChart();
  renderStudyTimeChart();
  renderFlashcardChart();
  renderStreakChart();
  renderMaterialUsageChart();
  renderTrashSection();
}

function renderAccuracyChart() {
  const canvas = document.getElementById("accuracyChart");
  if (!canvas || typeof Chart === "undefined") return;
  const history = [...(appState.history || [])].sort((a, b) => a.date - b.date);
  if (history.length < 2) return;
  const labels = history.map((h) => formatDate(h.date));
  const data = history.map((h) => h.accuracy || 0);

  registerChart(
    new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels,
        datasets: [
          {
            label: "Accuracy %",
            data,
            borderColor: "#6366F1",
            backgroundColor: "rgba(99,102,241,0.15)",
            fill: true,
            tension: 0.35,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${c.parsed.y}% accuracy` } },
        },
      },
    })
  );
}

function renderTopicChart() {
  const canvas = document.getElementById("topicChart");
  if (!canvas || typeof Chart === "undefined") return;
  const topics = topicAccuracy();
  if (!topics.length) return;
  const colors = [
    "#6366F1", "#8B5CF6", "#22C55E", "#F59E0B",
    "#EF4444", "#3B82F6", "#EC4899", "#14B8A6",
  ];

  registerChart(
    new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: topics.map((t) => t.topic),
        datasets: [
          {
            label: "Avg accuracy %",
            data: topics.map((t) => t.accuracy),
            backgroundColor: topics.map((_, i) => colors[i % colors.length]),
            borderRadius: 6,
          },
        ],
      },
      options: {
        indexAxis: "y",
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { min: 0, max: 100, ticks: { callback: (v) => `${v}%` } },
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${c.parsed.x}% (${topics[c.dataIndex].count})` } },
        },
      },
    })
  );
}

function renderXPGrowthChart() {
  const canvas = document.getElementById("xpChart");
  if (!canvas || typeof Chart === "undefined") return;
  const series = getXPSeries(30);
  const points = series.filter((p) => p.total > 0);
  if (points.length < 2) return;
  registerChart(
    new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: points.map((p) => p.label),
        datasets: [
          {
            label: "Total XP",
            data: points.map((p) => p.total),
            borderColor: "#22C55E",
            backgroundColor: "rgba(34,197,94,0.15)",
            fill: true,
            tension: 0.35,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => `${c.parsed.y} XP` } },
        },
      },
    })
  );
}

function renderStudyTimeChart() {
  const canvas = document.getElementById("studyTimeChart");
  if (!canvas || typeof Chart === "undefined") return;
  const days = [];
  const now = new Date();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    days.push({ key: dateKey(d.getTime()), label: formatDate(d.getTime()) });
  }
  const data = days.map((d) => appState.studyMinutes?.[d.key] || 0);
  if (data.every((v) => v === 0)) return;
  registerChart(
    new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: {
        labels: days.map((d) => d.label),
        datasets: [
          {
            label: "Minutes",
            data,
            backgroundColor: "#6366F1",
            borderRadius: 6,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          y: { beginAtZero: true, ticks: { callback: (v) => `${v}m` } },
        },
      },
    })
  );
}

function renderFlashcardChart() {
  const canvas = document.getElementById("fcChart");
  if (!canvas || typeof Chart === "undefined") return;
  const s = flashcardStats();
  const values = [s.mastered, s.learning, s.newCards];
  if (values.every((v) => v === 0)) return;
  registerChart(
    new Chart(canvas.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Mastered", "Learning", "New"],
        datasets: [
          {
            data: values,
            backgroundColor: ["#22C55E", "#F59E0B", "#3B82F6"],
            borderWidth: 0,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "62%",
        plugins: {
          legend: { position: "bottom" },
          tooltip: { callbacks: { label: (c) => `${c.label}: ${c.parsed} cards` } },
        },
      },
    })
  );
}

function renderStreakChart() {
  const canvas = document.getElementById("streakChart");
  if (!canvas || typeof Chart === "undefined") return;
  const weeks = getWeekSeries(8);
  if (!weeks.length) return;
  registerChart(
    new Chart(canvas.getContext("2d"), {
      type: "line",
      data: {
        labels: weeks.map((w) => w.label),
        datasets: [
          {
            label: "Weekly minutes",
            data: weeks.map((w) => w.minutes),
            borderColor: "#F59E0B",
            backgroundColor: "rgba(245,158,11,0.15)",
            fill: true,
            tension: 0.35,
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: { y: { beginAtZero: true, ticks: { callback: (v) => `${v}m` } } },
      },
    })
  );
}

// ---- Material usage: stacked actions per uploaded file ----
function renderMaterialUsageChart() {
  const canvas = document.getElementById("usageChart");
  if (!canvas || typeof Chart === "undefined") return;
  const usage = getMaterialUsage();
  if (!usage.length) return;
  const names = usage.map((u) => (u.name.length > 16 ? u.name.slice(0, 15) + "…" : u.name));
  const labels = ["quizzes", "flashcards", "summaries", "mindmaps", "notes"];
  const palette = { quizzes: "#6366F1", flashcards: "#F59E0B", summaries: "#22C55E", mindmaps: "#EC4899", notes: "#3B82F6" };
  const datasets = labels
    .map((k) => ({
      label: k.charAt(0).toUpperCase() + k.slice(1),
      data: usage.map((u) => u[k] || 0),
      backgroundColor: palette[k],
      borderRadius: 3,
    }))
    .filter((d) => d.data.some((v) => v > 0));
  registerChart(
    new Chart(canvas.getContext("2d"), {
      type: "bar",
      data: { labels: names, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" } },
        scales: {
          x: { ticks: { autoSkip: false, maxRotation: 45, minRotation: 0 } },
          y: { beginAtZero: true, ticks: { precision: 0 } },
        },
      },
    })
  );
}

export { renderHistory, renderProgress, buildHistoryFeed, heatmapData, topicAccuracy, deletedItemsCount, moveToTrash, restoreFromTrash, deleteForever };
