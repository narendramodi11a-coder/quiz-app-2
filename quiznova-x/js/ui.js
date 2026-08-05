// ============================================
// QuizNova X — ui.js
// Shared DOM UI helpers
// ============================================

import { escapeHTML } from "./utils.js";

const TOAST_ICONS = {
  success: "fa-circle-check",
  error: "fa-circle-xmark",
  warning: "fa-triangle-exclamation",
  info: "fa-circle-info",
};

// ---- Toast notification ----
function showToast(message, type = "info", duration = 3000) {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  const icon = TOAST_ICONS[type] || TOAST_ICONS.info;
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHTML(message)}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(30px)";
    setTimeout(() => toast.remove(), 250);
  }, duration);
}

// ---- Fullscreen loader ----
function showLoader(text = "Loading...") {
  const overlay = document.getElementById("loaderOverlay");
  if (!overlay) return;
  const textEl = overlay.querySelector("p");
  if (textEl) textEl.textContent = text;
  overlay.classList.remove("hidden");
}

function hideLoader() {
  const overlay = document.getElementById("loaderOverlay");
  if (overlay) overlay.classList.add("hidden");
}

// ---- Modal. buttons: [{ label, class, onClick }] ----
function showModal(title, contentHTML, buttons = []) {
  const root = document.getElementById("modalRoot");
  if (!root) return;

  root.innerHTML = `
    <div class="modal-backdrop" id="modalBackdrop">
      <div class="modal" role="dialog" aria-modal="true">
        <div class="modal-header">
          <h2>${escapeHTML(title)}</h2>
          <button class="modal-close" data-close-modal aria-label="Close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <div class="modal-body">${contentHTML}</div>
        ${
          buttons.length
            ? `<div class="modal-footer">${buttons
                .map(
                  (b, i) =>
                    `<button class="btn ${b.class || "btn-primary"}" data-modal-btn="${i}">${escapeHTML(
                      b.label
                    )}</button>`
                )
                .join("")}</div>`
            : ""
        }
      </div>
    </div>`;

  const backdrop = root.querySelector("#modalBackdrop");
  root.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", closeModal);
  });
  if (backdrop) {
    backdrop.addEventListener("click", (e) => {
      if (e.target === e.currentTarget) closeModal();
    });
  }
  buttons.forEach((b, i) => {
    const btn = root.querySelector(`[data-modal-btn="${i}"]`);
    if (btn) {
      btn.addEventListener("click", () => {
        if (typeof b.onClick === "function") b.onClick();
      });
    }
  });
}

// ---- Close any open modal ----
function closeModal() {
  const root = document.getElementById("modalRoot");
  if (root) root.innerHTML = "";
}

// ---- Promise-based confirm dialog ----
function confirmAction(message) {
  return new Promise((resolve) => {
    showModal("Confirm", `<p>${escapeHTML(message)}</p>`, [
      {
        label: "Cancel",
        class: "btn-ghost",
        onClick: () => {
          closeModal();
          resolve(false);
        },
      },
      {
        label: "Confirm",
        class: "btn-danger",
        onClick: () => {
          closeModal();
          resolve(true);
        },
      },
    ]);
  });
}

// ---- Update the topbar title ----
function setViewTitle(title) {
  const el = document.getElementById("viewTitle");
  if (el) el.textContent = title;
}

// ---- Close the mobile sidebar drawer ----
function closeMobileSidebar() {
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("sidebarOverlay");
  if (sidebar) sidebar.classList.remove("open");
  if (overlay) overlay.classList.remove("show");
}

// ---- Empty-state HTML string ----
function renderEmptyState(icon, message) {
  return `<div class="empty-state">
    <i class="fa-solid ${icon}"></i>
    <div class="empty-title">${escapeHTML(message)}</div>
  </div>`;
}

// ---- Skeleton loader HTML (Polish: async view placeholders) ----
// cards: number of skeleton cards · lines: shimmer lines per card
function skeleton(cards = 3, lines = 3) {
  const widths = ["w-100", "w-60", "w-80"];
  let html = '<div class="skeleton-grid">';
  for (let i = 0; i < cards; i++) {
    html += '<div class="card skeleton-card">';
    for (let j = 0; j < lines; j++) {
      html += `<div class="skeleton skeleton-line ${widths[j % widths.length]}"></div>`;
    }
    html += "</div>";
  }
  return html + "</div>";
}

// ---- Error-state HTML (Polish: failed async render) ----
function errorState(message, detail = "") {
  return `<div class="error-state">
    <i class="fa-solid fa-triangle-exclamation"></i>
    <div class="error-title">${escapeHTML(message)}</div>
    ${detail ? `<p>${escapeHTML(detail)}</p>` : ""}
  </div>`;
}

export {
  showToast,
  showLoader,
  hideLoader,
  showModal,
  closeModal,
  confirmAction,
  setViewTitle,
  closeMobileSidebar,
  renderEmptyState,
  skeleton,
  errorState,
};
