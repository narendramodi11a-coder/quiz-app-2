// ============================================
// QuizNova X — settings.js
// Preferences, data export/import, reset
// ============================================

import { appState, saveState, loadState, resetState } from "./state.js";
import { exportData, importData } from "./storage.js";
import { showToast, confirmAction } from "./ui.js";
import { escapeHTML, escapeAttr, safeDownload, formatDate } from "./utils.js";
import { mascot } from "./mascot.js";
import { openCardCustomizerModal, openAvatarCustomizerModal, applyCardStyles, updateGlobalAvatars } from "./branding.js";

// ---- Local theme application (kept small to avoid a circular import) ----
function applyTheme() {
  const theme = appState.settings.theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", theme);
  const icon = document.querySelector("#themeToggle i");
  if (icon) icon.className = theme === "light" ? "fa-solid fa-sun" : "fa-solid fa-moon";
}

function applyReducedMotion() {
  const reduced = !!appState.settings.reducedMotion;
  if (reduced) document.documentElement.setAttribute("data-reduced-motion", "true");
  else document.documentElement.removeAttribute("data-reduced-motion");
}

function applyFontSize() {
  const size = ["sm", "md", "lg"].includes(appState.settings.fontSize) ? appState.settings.fontSize : "md";
  document.documentElement.setAttribute("data-font-size", size);
}

function applyAccentColor() {
  const color = appState.settings.accentColor || "#6366F1";
  document.documentElement.style.setProperty("--primary", color);
}

function renderSettings() {
  const view = document.getElementById("view-settings");
  if (!view) return;

  const s = appState.settings;

  view.innerHTML = `
    <div class="view-section">
      <div class="view-heading"><h2>Settings</h2></div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-title"><i class="fa-solid fa-palette" style="color:var(--primary);margin-right:6px;"></i> Card Customization Suite</div>
        <p class="card-subtitle">Customize card styles, surface themes, border radiuses, density, and hover animations across all views.</p>
        <button class="btn btn-primary btn-sm" id="btnOpenCardCustomizer"><i class="fa-solid fa-sliders"></i> Customize Cards Layout & Theme</button>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">Appearance</div>
        <label style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:8px 0;cursor:pointer;">
          <span style="font-size:.9rem;">Dark theme</span>
          <span class="toggle-switch">
            <input type="checkbox" id="setDark" ${s.theme === "dark" ? "checked" : ""}>
            <span class="slider"></span>
          </span>
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:8px 0;cursor:pointer;">
          <span style="font-size:.9rem;">Reduced motion</span>
          <span class="toggle-switch">
            <input type="checkbox" id="setReduced" ${s.reducedMotion ? "checked" : ""}>
            <span class="slider"></span>
          </span>
        </label>
        <label class="label" for="setFontSize" style="margin-top:6px;">Font size</label>
        <div class="chip-group" id="setFontSize" style="margin-bottom:6px;">
          <button class="chip ${s.fontSize === "sm" ? "chip-active" : ""}" data-size="sm">Small</button>
          <button class="chip ${s.fontSize === "md" ? "chip-active" : ""}" data-size="md">Medium</button>
          <button class="chip ${s.fontSize === "lg" ? "chip-active" : ""}" data-size="lg">Large</button>
        </div>
        <label class="label" for="setAccent" style="margin-top:6px;">Accent color</label>
        <div style="display:flex;align-items:center;gap:12px;padding:6px 0;">
          <input type="color" id="setAccent" value="${escapeAttr(s.accentColor || "#C8A15A")}" style="width:44px;height:30px;border:none;background:none;cursor:pointer;">
          <button class="btn btn-ghost btn-sm" id="setAccentReset">Reset (Warm Gold)</button>
        </div>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">Preferences</div>
        <label class="label" for="setLanguage" style="margin-top:6px;">Language</label>
        <input class="input" id="setLanguage" value="${escapeAttr(
          s.language || "English"
        )}" maxlength="40" autocomplete="off" style="max-width:360px;">
        <label style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:10px 0;cursor:pointer;">
          <span style="font-size:.9rem;">Show mascot</span>
          <span class="toggle-switch">
            <input type="checkbox" id="setMascot" ${s.showMascot ? "checked" : ""}>
            <span class="slider"></span>
          </span>
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:8px 0;cursor:pointer;">
          <span style="font-size:.9rem;">Sound effects</span>
          <span class="toggle-switch">
            <input type="checkbox" id="setSound" ${s.soundEnabled ? "checked" : ""}>
            <span class="slider"></span>
          </span>
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:8px 0;cursor:pointer;">
          <span style="font-size:.9rem;">Notifications</span>
          <span class="toggle-switch">
            <input type="checkbox" id="setNotifications" ${s.notifications ? "checked" : ""}>
            <span class="slider"></span>
          </span>
        </label>
        <label style="display:flex;align-items:center;justify-content:space-between;gap:14px;padding:8px 0;cursor:pointer;">
          <span style="font-size:.9rem;">Keyboard shortcuts</span>
          <span class="toggle-switch">
            <input type="checkbox" id="setShortcuts" ${s.shortcutEnabled ? "checked" : ""}>
            <span class="slider"></span>
          </span>
        </label>
        <label class="label" for="setDailyGoal" style="margin-top:6px;">Daily study goal (minutes)</label>
        <input class="input" id="setDailyGoal" type="number" min="1" max="600" value="${Number(s.dailyGoalMinutes) || 30}" style="max-width:120px;">
        <p class="card-subtitle">Shown on the dashboard as your daily progress target.</p>
      </div>

      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">Data</div>
        <p class="card-subtitle">Your data is stored locally in your browser.</p>
        <div style="display:flex;gap:10px;flex-wrap:wrap;">
          <button class="btn btn-primary btn-sm" id="setExport"><i class="fa-solid fa-download"></i> Export Data</button>
          <button class="btn btn-ghost btn-sm" id="setImport"><i class="fa-solid fa-upload"></i> Import Data</button>
          <input type="file" id="setImportFile" accept=".json,application/json" hidden>
        </div>
      </div>

      <div class="card" style="border-color:var(--danger);">
        <div class="card-title" style="color:var(--danger);">Danger Zone</div>
        <p class="card-subtitle">Reset all quizzes, notes, decks and progress.</p>
        <button class="btn btn-danger btn-sm" id="setReset"><i class="fa-solid fa-triangle-exclamation"></i> Reset All Data</button>
      </div>

      <p style="text-align:center;color:var(--text-muted);font-size:.78rem;margin-top:20px;">
        MindForge · Last exported backup: ${appState.lastExport ? escapeHTML(formatDate(appState.lastExport)) : "never"}
      </p>
    </div>
  `;

  // ---- Appearance ----
  const darkToggle = view.querySelector("#setDark");
  darkToggle.addEventListener("change", () => {
    s.theme = darkToggle.checked ? "dark" : "light";
    saveState();
    applyTheme();
    showToast(`Theme switched to ${s.theme}.`, "info");
  });

  const reducedToggle = view.querySelector("#setReduced");
  reducedToggle.addEventListener("change", () => {
    s.reducedMotion = reducedToggle.checked;
    saveState();
    applyReducedMotion();
    showToast(`Reduced motion ${s.reducedMotion ? "enabled" : "disabled"}.`, "info");
  });

  // ---- Preferences ----
  const langInput = view.querySelector("#setLanguage");
  langInput.addEventListener("change", () => {
    s.language = langInput.value.trim() || "English";
    saveState();
    showToast(`Language set to ${s.language}.`, "success");
  });

  const mascotToggle = view.querySelector("#setMascot");
  mascotToggle.addEventListener("change", () => {
    s.showMascot = mascotToggle.checked;
    saveState();
    mascot.applySettings();
    showToast(`Mascot ${s.showMascot ? "shown" : "hidden"}.`, "info");
  });

  const soundToggle = view.querySelector("#setSound");
  soundToggle.addEventListener("change", () => {
    s.soundEnabled = soundToggle.checked;
    saveState();
    showToast(`Sound effects ${s.soundEnabled ? "enabled" : "disabled"}.`, "info");
  });

  // ---- New appearance/preference controls (Prompt 6) ----
  view.querySelectorAll("#setFontSize .chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      s.fontSize = chip.dataset.size;
      saveState();
      applyFontSize();
      view.querySelectorAll("#setFontSize .chip").forEach((c) => c.classList.toggle("chip-active", c === chip));
      showToast(`Font size set to ${chip.dataset.size}.`, "info");
    });
  });

  const btnCardCust = view.querySelector("#btnOpenCardCustomizer");
  if (btnCardCust) {
    btnCardCust.addEventListener("click", () => {
      openCardCustomizerModal(() => renderSettings());
    });
  }

  const accentInput = view.querySelector("#setAccent");
  if (accentInput) {
    accentInput.addEventListener("input", () => {
      s.accentColor = accentInput.value;
      saveState();
      applyAccentColor();
    });
  }
  const btnAccentReset = view.querySelector("#setAccentReset");
  if (btnAccentReset) {
    btnAccentReset.addEventListener("click", () => {
      s.accentColor = "#C8A15A";
      saveState();
      applyAccentColor();
      if (accentInput) accentInput.value = "#C8A15A";
      showToast("Accent color reset to Warm Gold.", "info");
    });
  }

  const notifToggle = view.querySelector("#setNotifications");
  notifToggle.addEventListener("change", () => {
    s.notifications = notifToggle.checked;
    saveState();
    showToast(`Notifications ${s.notifications ? "enabled" : "disabled"}.`, "info");
  });

  const shortcutToggle = view.querySelector("#setShortcuts");
  shortcutToggle.addEventListener("change", () => {
    s.shortcutEnabled = shortcutToggle.checked;
    saveState();
    showToast(`Keyboard shortcuts ${s.shortcutEnabled ? "enabled" : "disabled"}.`, "info");
  });

  const goalInput = view.querySelector("#setDailyGoal");
  goalInput.addEventListener("change", () => {
    const v = Math.max(1, Math.min(600, Number(goalInput.value) || 30));
    goalInput.value = v;
    s.dailyGoalMinutes = v;
    saveState();
    showToast(`Daily goal set to ${v} minutes.`, "success");
  });

  // ---- Data ----
  view.querySelector("#setExport").addEventListener("click", () => {
    const json = exportData();
    if (json === "{}") {
      showToast("Nothing to export yet.", "warning");
      return;
    }
    appState.lastExport = Date.now();
    saveState();
    safeDownload("quiznova-x-backup.json", json, "application/json");
    showToast("Data exported as quiznova-x-backup.json.", "success");
  });

  view.querySelector("#setImport").addEventListener("click", () => {
    view.querySelector("#setImportFile").click();
  });
  view.querySelector("#setImportFile").addEventListener("change", (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (file) importFromFile(file);
  });

  view.querySelector("#setReset").addEventListener("click", resetAllData);

  applyTheme();
  applyReducedMotion();
  applyFontSize();
  applyAccentColor();
}

function importFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const ok = importData(String(reader.result || ""));
      if (!ok) {
        showToast("Import failed. The file does not look like a MindForge backup.", "error");
        return;
      }
      loadState();
      saveState();
      mascot.applySettings();
      applyTheme();
      applyReducedMotion();
      applyFontSize();
      applyAccentColor();
      window.dispatchEvent(new CustomEvent("quiznova:statechange"));
      showToast("Data imported successfully.", "success");
    } catch (err) {
      console.error("[QuizNova] Import failed:", err);
      showToast("Import failed. Check the file and try again.", "error");
    }
  };
  reader.onerror = () => showToast("Could not read the file.", "error");
  reader.readAsText(file);
}

async function resetAllData() {
  const ok = await confirmAction(
    "Reset ALL data? Quizzes, notes, decks, roadmap and progress will be permanently deleted. This cannot be undone."
  );
  if (!ok) return;
  resetState();
  mascot.applySettings();
  applyTheme();
  applyReducedMotion();
  applyFontSize();
  applyAccentColor();
  window.dispatchEvent(new CustomEvent("quiznova:statechange"));
  showToast("All data has been reset.", "success");
}

export { renderSettings, applyTheme, applyReducedMotion, applyFontSize, applyAccentColor, importFromFile, resetAllData };
