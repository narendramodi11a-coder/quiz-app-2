// ============================================
// MindForge — branding.js
// Logos, Vector Avatars, Card Customization Suite
// ============================================

import { appState, saveState } from "./state.js";
import { showToast, showModal, closeModal } from "./ui.js";
import { escapeHTML, escapeAttr } from "./utils.js";

// ---- Handcrafted MindForge Logos ----
export function MINDFORGE_LOGO_SVG(size = 28, strokeWidth = 2) {
  return `<img src="/assets/logo.jpg" alt="MindForge Logo" referrerpolicy="no-referrer" style="width:${size}px;height:${size}px;border-radius:8px;object-fit:cover;box-shadow:0 0 10px rgba(200,161,90,0.3);vertical-align:middle;">`;
}

// ---- Vector Avatar Presets ----
export const PRESET_AVATARS = {
  "gold-pioneer": {
    name: "Gold Pioneer",
    badge: "Pioneer",
    svg: `<svg viewBox="0 0 100 100" class="avatar-svg" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="gpGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#C8A15A"/><stop offset="100%" stop-color="#8A6A29"/></linearGradient></defs>
      <rect width="100" height="100" rx="28" fill="#1C2028"/>
      <path d="M50 15 L78 30 V65 L50 85 L22 65 V30 Z" fill="url(#gpGrad)" opacity="0.25" stroke="#C8A15A" stroke-width="3"/>
      <path d="M50 30 L65 40 V60 L50 70 L35 60 V40 Z" fill="url(#gpGrad)"/>
      <circle cx="50" cy="50" r="8" fill="#FFF"/>
    </svg>`
  },
  "cyber-sage": {
    name: "Cyber Sage",
    badge: "Sage",
    svg: `<svg viewBox="0 0 100 100" class="avatar-svg" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="csGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#39D98A"/><stop offset="100%" stop-color="#126840"/></linearGradient></defs>
      <rect width="100" height="100" rx="28" fill="#141820"/>
      <circle cx="50" cy="40" r="22" fill="url(#csGrad)"/>
      <rect x="28" y="34" width="44" height="12" rx="6" fill="#141820" stroke="#39D98A" stroke-width="2.5"/>
      <path d="M22 82 C22 62 34 56 50 56 C66 56 78 62 78 82 Z" fill="url(#csGrad)" opacity="0.85"/>
    </svg>`
  },
  "neural-alchemist": {
    name: "Neural Alchemist",
    badge: "Alchemist",
    svg: `<svg viewBox="0 0 100 100" class="avatar-svg" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="naGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#F6C453"/><stop offset="100%" stop-color="#C8A15A"/></linearGradient></defs>
      <rect width="100" height="100" rx="28" fill="#1C2028"/>
      <circle cx="50" cy="50" r="32" fill="none" stroke="url(#naGrad)" stroke-width="3" stroke-dasharray="8 4"/>
      <circle cx="50" cy="34" r="8" fill="#F6C453"/>
      <circle cx="34" cy="62" r="8" fill="#F6C453"/>
      <circle cx="66" cy="62" r="8" fill="#F6C453"/>
      <line x1="50" y1="34" x2="34" y2="62" stroke="#C8A15A" stroke-width="3"/>
      <line x1="50" y1="34" x2="66" y2="62" stroke="#C8A15A" stroke-width="3"/>
      <line x1="34" y1="62" x2="66" y2="62" stroke="#C8A15A" stroke-width="3"/>
      <circle cx="50" cy="52" r="5" fill="#FFF"/>
    </svg>`
  },
  "quantum-mind": {
    name: "Quantum Mind",
    badge: "Quantum",
    svg: `<svg viewBox="0 0 100 100" class="avatar-svg" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="qmGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#60A5FA"/><stop offset="100%" stop-color="#C8A15A"/></linearGradient></defs>
      <rect width="100" height="100" rx="28" fill="#12151B"/>
      <ellipse cx="50" cy="50" rx="36" ry="14" fill="none" stroke="#60A5FA" stroke-width="3.5" transform="rotate(30 50 50)"/>
      <ellipse cx="50" cy="50" rx="36" ry="14" fill="none" stroke="#C8A15A" stroke-width="3.5" transform="rotate(-30 50 50)"/>
      <circle cx="50" cy="50" r="10" fill="url(#qmGrad)"/>
    </svg>`
  },
  "senior-scholar": {
    name: "Senior Scholar",
    badge: "Scholar",
    svg: `<svg viewBox="0 0 100 100" class="avatar-svg" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" rx="28" fill="#1C2028"/>
      <path d="M20 40 L50 24 L80 40 L50 56 Z" fill="#C8A15A"/>
      <rect x="46" y="52" width="8" height="20" fill="#C8A15A"/>
      <path d="M30 46 V65 C30 76 70 76 70 65 V46" fill="none" stroke="#E2E8F0" stroke-width="4.5" stroke-linecap="round"/>
      <circle cx="76" cy="55" r="4.5" fill="#F6C453"/>
    </svg>`
  },
  "apex-architect": {
    name: "Apex Architect",
    badge: "Architect",
    svg: `<svg viewBox="0 0 100 100" class="avatar-svg" xmlns="http://www.w3.org/2000/svg">
      <defs><linearGradient id="aaGrad" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#C8A15A"/><stop offset="100%" stop-color="#FF5A6A"/></linearGradient></defs>
      <rect width="100" height="100" rx="28" fill="#181B22"/>
      <path d="M50 18 L82 78 H18 Z" fill="none" stroke="url(#aaGrad)" stroke-width="4.5" stroke-linejoin="round"/>
      <path d="M50 35 L68 70 H32 Z" fill="url(#aaGrad)" opacity="0.35"/>
      <circle cx="50" cy="55" r="6" fill="#C8A15A"/>
    </svg>`
  }
};

// ---- Generate Initial Avatar SVG ----
export function generateInitialsSVG(initials = "MF", bgTheme = "gold") {
  const cleanInitials = escapeHTML(initials.slice(0, 2).toUpperCase() || "MF");
  let bgGradient = `linear-gradient(135deg, #C8A15A 0%, #8A6A29 100%)`;
  if (bgTheme === "dark") bgGradient = `linear-gradient(135deg, #2B303C 0%, #12151B 100%)`;
  if (bgTheme === "emerald") bgGradient = `linear-gradient(135deg, #39D98A 0%, #0F6338 100%)`;
  if (bgTheme === "amethyst") bgGradient = `linear-gradient(135deg, #A855F7 0%, #581C87 100%)`;

  return `<div class="initials-avatar" style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;border-radius:inherit;background:${bgGradient};color:#FFF;font-weight:700;font-size:1.4em;letter-spacing:1px;user-select:none;">${cleanInitials}</div>`;
}

// ---- Universal Avatar Renderer ----
export function getAvatarHTML(profile = appState.profile, size = 44) {
  const type = profile.avatarType || "preset";
  const frame = profile.avatarFrame || "gold-anvil";

  let content = "";
  if (type === "custom" && profile.customAvatar) {
    content = `<img src="${profile.customAvatar}" alt="User Avatar" style="width:100%;height:100%;object-fit:cover;border-radius:inherit;">`;
  } else if (type === "initials") {
    content = generateInitialsSVG(profile.initials || profile.name || "MF", profile.initialsBg || "gold");
  } else if (type === "preset" && PRESET_AVATARS[profile.presetAvatar]) {
    content = PRESET_AVATARS[profile.presetAvatar].svg;
  } else {
    // Emoji fallback
    const emoji = profile.avatar || "🧑‍🎓";
    content = `<span style="font-size:${size * 0.55}px;line-height:1;">${emoji}</span>`;
  }

  return `<div class="mindforge-avatar frame-${frame}" style="width:${size}px;height:${size}px;display:inline-flex;align-items:center;justify-content:center;position:relative;border-radius:14px;overflow:hidden;flex-shrink:0;">
    ${content}
  </div>`;
}

// ---- Apply Dynamic Card Customization Styles to Document ----
export function applyCardStyles() {
  const s = appState.settings || {};
  const root = document.documentElement;

  const cardStyle = s.cardStyle || "gold-accent";
  const cardRadius = s.cardRadius || "16";
  const cardDensity = s.cardDensity || "standard";
  const cardAccentBar = s.cardAccentBar || "top-gold";
  const cardHoverAnimation = s.cardHoverAnimation || "lift";

  root.setAttribute("data-card-style", cardStyle);
  root.setAttribute("data-card-accent-bar", cardAccentBar);
  root.setAttribute("data-card-hover", cardHoverAnimation);
  root.style.setProperty("--card-radius", `${cardRadius}px`);

  let paddingVal = "18px";
  if (cardDensity === "compact") paddingVal = "14px";
  if (cardDensity === "spacious") paddingVal = "24px";
  root.style.setProperty("--card-padding", paddingVal);
}

// ---- Sync Topbar & Global Avatar Elements ----
export function updateGlobalAvatars() {
  const p = appState.profile;
  const topbarContainer = document.getElementById("topbarAvatar");
  if (topbarContainer) {
    topbarContainer.innerHTML = getAvatarHTML(p, 32);
  }

  const topbarName = document.querySelector(".profile-mini-name");
  if (topbarName) {
    topbarName.textContent = p.name;
  }

  const sidebarLogo = document.querySelector(".sidebar-logo");
  if (sidebarLogo) {
    sidebarLogo.innerHTML = MINDFORGE_LOGO_SVG(26);
  }

  applyCardStyles();
}

// ---- Open Card Customizer Modal ----
export function openCardCustomizerModal(onSave) {
  const s = appState.settings;

  const contentHTML = `
    <div class="card-customizer-suite">
      <p style="color:var(--text-muted);font-size:.875rem;margin-bottom:16px;">
        Personalize the visual appearance, border density, and hover effects of all cards across MindForge.
      </p>

      <!-- Live Interactive Card Preview -->
      <div class="customizer-preview-container" style="margin-bottom:20px;padding:16px;background:var(--bg);border-radius:14px;border:1px stroke var(--border);">
        <span class="label" style="display:block;margin-bottom:8px;">Live Card Preview</span>
        <div class="card" id="previewCardSample">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px;">
            <div class="card-title" style="margin:0;"><i class="fa-solid fa-layer-group" style="color:var(--primary);margin-right:6px;"></i> Sample Study Card</div>
            <span class="badge badge-primary">Active</span>
          </div>
          <p class="card-subtitle" style="margin-bottom:12px;">This preview reflects your custom card theme, border radius, density, and top accent bar.</p>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm"><i class="fa-solid fa-play"></i> Start Quiz</button>
            <button class="btn btn-ghost btn-sm">Details</button>
          </div>
        </div>
      </div>

      <!-- Option Controls -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
        <div>
          <label class="label" for="custCardStyle">Card Surface Theme</label>
          <select class="input" id="custCardStyle">
            <option value="gold-accent" ${s.cardStyle === "gold-accent" ? "selected" : ""}>Gold Anvil Accent (Default)</option>
            <option value="default" ${s.cardStyle === "default" ? "selected" : ""}>Onyx Minimal</option>
            <option value="stealth-dark" ${s.cardStyle === "stealth-dark" ? "selected" : ""}>Stealth Dark Matte</option>
            <option value="glass-elevated" ${s.cardStyle === "glass-elevated" ? "selected" : ""}>Studio Elevated</option>
          </select>
        </div>

        <div>
          <label class="label" for="custCardRadius">Border Radius</label>
          <select class="input" id="custCardRadius">
            <option value="8" ${s.cardRadius === "8" ? "selected" : ""}>8px — Technical</option>
            <option value="12" ${s.cardRadius === "12" ? "selected" : ""}>12px — Classic</option>
            <option value="16" ${s.cardRadius === "16" ? "selected" : ""}>16px — Modern (Default)</option>
            <option value="20" ${s.cardRadius === "20" ? "selected" : ""}>20px — Plush</option>
          </select>
        </div>

        <div>
          <label class="label" for="custCardDensity">Content Padding (Density)</label>
          <select class="input" id="custCardDensity">
            <option value="compact" ${s.cardDensity === "compact" ? "selected" : ""}>Compact (14px)</option>
            <option value="standard" ${s.cardDensity === "standard" ? "selected" : ""}>Standard (18px)</option>
            <option value="spacious" ${s.cardDensity === "spacious" ? "selected" : ""}>Spacious (24px)</option>
          </select>
        </div>

        <div>
          <label class="label" for="custCardAccent">Accent Line Style</label>
          <select class="input" id="custCardAccent">
            <option value="top-gold" ${s.cardAccentBar === "top-gold" ? "selected" : ""}>Top Gold Line</option>
            <option value="left-gold" ${s.cardAccentBar === "left-gold" ? "selected" : ""}>Left Gold Strip</option>
            <option value="hover-glow" ${s.cardAccentBar === "hover-glow" ? "selected" : ""}>Warm Hover Glow</option>
            <option value="none" ${s.cardAccentBar === "none" ? "selected" : ""}>Clean Border Only</option>
          </select>
        </div>
      </div>
    </div>
  `;

  showModal("Customize Cards", contentHTML, [
    { label: "Cancel", class: "btn-ghost", onClick: closeModal },
    {
      label: "Save Customization",
      class: "btn-primary",
      onClick: () => {
        const root = document.getElementById("modalRoot");
        if (root) {
          s.cardStyle = root.querySelector("#custCardStyle")?.value || "gold-accent";
          s.cardRadius = root.querySelector("#custCardRadius")?.value || "16";
          s.cardDensity = root.querySelector("#custCardDensity")?.value || "standard";
          s.cardAccentBar = root.querySelector("#custCardAccent")?.value || "top-gold";
          saveState();
          applyCardStyles();
          showToast("Card customization saved!", "success");
          if (typeof onSave === "function") onSave();
        }
        closeModal();
      }
    }
  ]);

  // Realtime Live Preview Listener inside Modal
  const modalRoot = document.getElementById("modalRoot");
  if (modalRoot) {
    const styleSel = modalRoot.querySelector("#custCardStyle");
    const radSel = modalRoot.querySelector("#custCardRadius");
    const denSel = modalRoot.querySelector("#custCardDensity");
    const accSel = modalRoot.querySelector("#custCardAccent");

    const updatePreview = () => {
      s.cardStyle = styleSel.value;
      s.cardRadius = radSel.value;
      s.cardDensity = denSel.value;
      s.cardAccentBar = accSel.value;
      applyCardStyles();
    };

    [styleSel, radSel, denSel, accSel].forEach((el) => {
      if (el) el.addEventListener("change", updatePreview);
    });
  }
}

// ---- Open Avatar Customizer Modal ----
export function openAvatarCustomizerModal(onSave) {
  const p = appState.profile;

  const contentHTML = `
    <div class="avatar-customizer-suite">
      <div style="display:flex;align-items:center;gap:18px;margin-bottom:20px;padding:14px;background:var(--bg);border-radius:16px;">
        <div id="modalAvatarPreview" style="display:flex;align-items:center;justify-content:center;">
          ${getAvatarHTML(p, 80)}
        </div>
        <div>
          <div style="font-weight:700;font-size:1.1rem;color:var(--text-main);">${escapeHTML(p.name)}</div>
          <div style="font-size:.85rem;color:var(--text-muted);margin-top:2px;">${escapeHTML(p.title)} · Level ${p.level}</div>
          <span class="badge badge-primary" style="margin-top:6px;">Current Avatar</span>
        </div>
      </div>

      <!-- Avatar Mode Tabs -->
      <div class="chip-group" id="avatarModeTabs" style="margin-bottom:16px;">
        <button class="chip ${p.avatarType === "preset" ? "chip-active" : ""}" data-tab="preset">Vector Presets</button>
        <button class="chip ${p.avatarType === "initials" ? "chip-active" : ""}" data-tab="initials">Initials Badge</button>
        <button class="chip ${p.avatarType === "custom" ? "chip-active" : ""}" data-tab="custom">Upload Photo</button>
        <button class="chip ${p.avatarType === "emoji" ? "chip-active" : ""}" data-tab="emoji">Emoji Icon</button>
      </div>

      <!-- Tab Content 1: Vector Presets -->
      <div id="tabPreset" class="avatar-tab-content ${p.avatarType === "preset" ? "" : "hidden"}">
        <label class="label">Select Vector Character</label>
        <div style="display:grid;grid-template-columns:repeat(3, 1fr);gap:10px;">
          ${Object.entries(PRESET_AVATARS).map(([key, item]) => `
            <div class="preset-avatar-card ${p.presetAvatar === key ? "active" : ""}" data-preset-key="${key}" style="padding:10px;border-radius:12px;border:2px solid ${p.presetAvatar === key ? "var(--primary)" : "var(--border)"};background:var(--card-bg);cursor:pointer;text-align:center;">
              <div style="width:48px;height:48px;margin:0 auto;">${item.svg}</div>
              <div style="font-size:.78rem;font-weight:600;margin-top:6px;color:var(--text-main);">${item.name}</div>
            </div>
          `).join("")}
        </div>
      </div>

      <!-- Tab Content 2: Initials Generator -->
      <div id="tabInitials" class="avatar-tab-content ${p.avatarType === "initials" ? "" : "hidden"}">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
          <div>
            <label class="label" for="initialsInput">Initials (max 2 chars)</label>
            <input class="input" id="initialsInput" value="${escapeAttr(p.initials || "MF")}" maxlength="2" style="text-transform:uppercase;">
          </div>
          <div>
            <label class="label" for="initialsBgSelect">Background Style</label>
            <select class="input" id="initialsBgSelect">
              <option value="gold" ${p.initialsBg === "gold" ? "selected" : ""}>Gold Forge</option>
              <option value="dark" ${p.initialsBg === "dark" ? "selected" : ""}>Midnight Onyx</option>
              <option value="emerald" ${p.initialsBg === "emerald" ? "selected" : ""}>Emerald Intellect</option>
              <option value="amethyst" ${p.initialsBg === "amethyst" ? "selected" : ""}>Royal Amethyst</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Tab Content 3: Upload Photo -->
      <div id="tabCustom" class="avatar-tab-content ${p.avatarType === "custom" ? "" : "hidden"}">
        <div class="file-upload-card" id="avatarUploadCard" style="border:2px dashed var(--border);padding:24px;text-align:center;border-radius:14px;cursor:pointer;">
          <i class="fa-solid fa-cloud-arrow-up" style="font-size:2rem;color:var(--primary);margin-bottom:8px;"></i>
          <div style="font-weight:600;font-size:.95rem;">Click or Drag image here</div>
          <p style="font-size:.8rem;color:var(--text-muted);margin-top:4px;">Supports PNG, JPG, WebP (auto-scaled to profile avatar)</p>
          <input type="file" id="avatarFileInput" accept="image/*" hidden>
        </div>
      </div>

      <!-- Tab Content 4: Emojis -->
      <div id="tabEmoji" class="avatar-tab-content ${p.avatarType === "emoji" ? "" : "hidden"}">
        <label class="label">Pick Emoji</label>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          ${["🧑‍🎓", "👨‍🎓", "👩‍🎓", "🦊", "🐼", "🦉", "🐯", "🤖", "🚀", "🐸", "🐙", "🦄", "😎", "🧙", "👑", "🌸"].map(e => `
            <button type="button" class="avatar-emoji-btn" data-emoji="${e}" style="width:44px;height:44px;font-size:1.4rem;border-radius:10px;border:2px solid ${p.avatar === e ? "var(--primary)" : "var(--border)"};background:var(--bg);cursor:pointer;">${e}</button>
          `).join("")}
        </div>
      </div>

      <!-- Frame Selector -->
      <div style="margin-top:16px;">
        <label class="label" for="avatarFrameSelect">Avatar Border Frame</label>
        <select class="input" id="avatarFrameSelect">
          <option value="gold-anvil" ${p.avatarFrame === "gold-anvil" ? "selected" : ""}>Gold Anvil Glow (Default)</option>
          <option value="stealth-ring" ${p.avatarFrame === "stealth-ring" ? "selected" : ""}>Stealth Ring</option>
          <option value="pulse-glow" ${p.avatarFrame === "pulse-glow" ? "selected" : ""}>Warm Gold Pulse</option>
          <option value="hexagon" ${p.avatarFrame === "hexagon" ? "selected" : ""}>Hexagon Shield</option>
        </select>
      </div>
    </div>
  `;

  showModal("Customize Profile Avatar", contentHTML, [
    { label: "Cancel", class: "btn-ghost", onClick: closeModal },
    {
      label: "Save Avatar",
      class: "btn-primary",
      onClick: () => {
        saveState();
        updateGlobalAvatars();
        showToast("Profile avatar updated!", "success");
        if (typeof onSave === "function") onSave();
        closeModal();
      }
    }
  ]);

  const modal = document.getElementById("modalRoot");
  if (!modal) return;

  const refreshPreview = () => {
    const prev = modal.querySelector("#modalAvatarPreview");
    if (prev) prev.innerHTML = getAvatarHTML(p, 80);
  };

  // Tab switching
  const tabs = modal.querySelectorAll("#avatarModeTabs button");
  tabs.forEach((t) => {
    t.addEventListener("click", () => {
      tabs.forEach((tb) => tb.classList.remove("chip-active"));
      t.classList.add("chip-active");
      const mode = t.dataset.tab;
      p.avatarType = mode;

      modal.querySelectorAll(".avatar-tab-content").forEach((c) => c.classList.add("hidden"));
      if (mode === "preset") modal.querySelector("#tabPreset")?.classList.remove("hidden");
      if (mode === "initials") modal.querySelector("#tabInitials")?.classList.remove("hidden");
      if (mode === "custom") modal.querySelector("#tabCustom")?.classList.remove("hidden");
      if (mode === "emoji") modal.querySelector("#tabEmoji")?.classList.remove("hidden");
      refreshPreview();
    });
  });

  // Preset click
  modal.querySelectorAll(".preset-avatar-card").forEach((card) => {
    card.addEventListener("click", () => {
      p.presetAvatar = card.dataset.presetKey;
      p.avatarType = "preset";
      modal.querySelectorAll(".preset-avatar-card").forEach((c) => {
        c.style.borderColor = c === card ? "var(--primary)" : "var(--border)";
      });
      refreshPreview();
    });
  });

  // Initials input
  const initialsInp = modal.querySelector("#initialsInput");
  const initialsBg = modal.querySelector("#initialsBgSelect");
  if (initialsInp) {
    initialsInp.addEventListener("input", () => {
      p.initials = initialsInp.value.toUpperCase();
      p.avatarType = "initials";
      refreshPreview();
    });
  }
  if (initialsBg) {
    initialsBg.addEventListener("change", () => {
      p.initialsBg = initialsBg.value;
      p.avatarType = "initials";
      refreshPreview();
    });
  }

  // Emoji buttons
  modal.querySelectorAll(".avatar-emoji-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      p.avatar = btn.dataset.emoji;
      p.avatarType = "emoji";
      refreshPreview();
    });
  });

  // Upload Photo
  const uploadCard = modal.querySelector("#avatarUploadCard");
  const fileInput = modal.querySelector("#avatarFileInput");
  if (uploadCard && fileInput) {
    uploadCard.addEventListener("click", () => fileInput.click());
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (event) => {
        p.customAvatar = event.target.result;
        p.avatarType = "custom";
        refreshPreview();
        showToast("Image loaded!", "success");
      };
      reader.readAsDataURL(file);
    });
  }

  // Frame select
  const frameSelect = modal.querySelector("#avatarFrameSelect");
  if (frameSelect) {
    frameSelect.addEventListener("change", () => {
      p.avatarFrame = frameSelect.value;
      refreshPreview();
    });
  }
}
