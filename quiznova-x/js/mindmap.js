// ============================================
// QuizNova X — mindmap.js
// Interactive SVG mind maps: zoom, pan, collapse,
// auto-layout, export PNG/JSON (Prompt 6: Mind Map)
// ============================================

import { appState, saveState } from "./state.js";
import { callGemini, buildPrompt, parseJSONResponse } from "./ai.js";
import { showToast, showLoader, hideLoader, confirmAction, renderEmptyState } from "./ui.js";
import { escapeHTML, generateId, timeAgo, safeDownload } from "./utils.js";
import { addXP, logActivity, checkAchievements } from "./gamification.js";
import { recordStudy } from "./progress.js";
import { trackUsage } from "./usage.js";
import { mascot } from "./mascot.js";

const MINDMAP_XP = 15;
const MAX_INPUT = 20000;

// ---- SVG layout constants ----
const NODE_W = 160;
const NODE_H = 46;
const H_SPACE = 26;
const V_SPACE = 80;

let mmView = { x: 20, y: 20, scale: 1 };
let selectedNodeId = null;

// ============================================
// Rendering (view shell)
// ============================================

function renderMindmap() {
  const view = document.getElementById("view-mindmap");
  if (!view) return;

  const materials = appState.studyMaterial || [];
  const notes = appState.notes || [];
  const ctx = window.quiznovaContext || {};
  const preMaterialId = ctx.materialId || null;
  if (preMaterialId) delete window.quiznovaContext.materialId;

  view.innerHTML = `
    <div class="view-heading">
      <h2>Mind Maps</h2>
      <span class="badge badge-primary">${appState.mindMaps.length} saved</span>
    </div>

    <div class="card" style="margin-bottom:18px;">
      <div class="card-title">Generate a mind map</div>
      <div class="view-section">
        <span class="label">Source</span>
        <select class="select" id="mmSourceSelect" style="max-width:460px;">
          <option value="paste">Paste text below...</option>
          ${
            materials.length
              ? `<optgroup label="Material">${materials.map((m) => `<option value="material:${m.id}" ${m.id === preMaterialId ? "selected" : ""}>${escapeHTML(m.name)}</option>`).join("")}</optgroup>`
              : ""
          }
          ${
            notes.length
              ? `<optgroup label="Notes">${notes.map((n) => `<option value="note:${n.id}">${escapeHTML(n.title)}</option>`).join("")}</optgroup>`
              : ""
          }
        </select>
      </div>
      <div class="view-section" id="mmPasteWrap">
        <span class="label">Content</span>
        <textarea class="textarea" id="mmPaste" placeholder="Paste notes, material or any study content to map..." style="min-height:160px;">${preMaterialId && materials.length ? escapeHTML((materials.find((m) => m.id === preMaterialId) || {}).text || "") : ""}</textarea>
      </div>
      <button class="btn btn-primary" id="mmGenerateBtn"><i class="fa-solid fa-diagram-project"></i> Generate Mind Map</button>
    </div>

    <div class="mindmap-layout" id="mmLayout" style="display:none;">
      <div class="card mindmap-canvas-wrap">
        <div class="mindmap-toolbar">
          <span style="font-weight:600;font-size:.9rem;">Preview</span>
          <div style="display:flex;gap:6px;flex-wrap:wrap;">
            <button class="btn btn-ghost btn-sm" id="mmZoomIn" title="Zoom in"><i class="fa-solid fa-magnifying-glass-plus"></i></button>
            <button class="btn btn-ghost btn-sm" id="mmZoomOut" title="Zoom out"><i class="fa-solid fa-magnifying-glass-minus"></i></button>
            <button class="btn btn-ghost btn-sm" id="mmFit" title="Fit to screen"><i class="fa-solid fa-expand"></i></button>
            <button class="btn btn-ghost btn-sm" id="mmExpandAll" title="Expand all"><i class="fa-solid fa-angles-down"></i></button>
            <button class="btn btn-ghost btn-sm" id="mmExportPNG" title="Export PNG"><i class="fa-solid fa-image"></i> PNG</button>
            <button class="btn btn-ghost btn-sm" id="mmExportJSON" title="Export JSON"><i class="fa-solid fa-file-code"></i> JSON</button>
          </div>
        </div>
        <div class="mindmap-canvas" id="mmCanvas"></div>
        <p class="mindmap-hint">Drag to pan · scroll to zoom · click a node for details · click the ⊕ badge to collapse</p>
      </div>
      <div class="card mindmap-detail" id="mmDetail" style="display:none;"></div>
    </div>

    <div class="view-section" style="margin-top:20px;">
      <div class="view-heading"><h2>Saved mind maps</h2></div>
      <div id="mmList">${
        appState.mindMaps.length
          ? `<div style="display:flex;flex-direction:column;gap:10px;">${appState.mindMaps.map(mmCardHTML).join("")}</div>`
          : renderEmptyState("diagram-project", "No mind maps yet — generate one above.")
      }</div>
    </div>
  `;

  bindMindmapShell(view, materials, notes);
}

function bindMindmapShell(view, materials, notes) {
  const source = view.querySelector("#mmSourceSelect");
  const pasteWrap = view.querySelector("#mmPasteWrap");
  const paste = view.querySelector("#mmPaste");

  if (source) {
    source.addEventListener("change", () => {
      const v = source.value;
      pasteWrap.style.display = v === "paste" ? "block" : "none";
      if (v.startsWith("material:")) {
        const m = materials.find((x) => x.id === v.slice(9));
        if (m && paste) paste.value = m.text || "";
      } else if (v.startsWith("note:")) {
        const n = notes.find((x) => x.id === v.slice(5));
        if (n && paste) paste.value = n.content || "";
      }
    });
  }

  view.querySelector("#mmGenerateBtn").addEventListener("click", generateMindMap);

  view.querySelectorAll("[data-mm-open]").forEach((btn) => {
    btn.addEventListener("click", () => openSavedMap(btn.dataset.mmOpen));
  });
  view.querySelectorAll("[data-mm-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deleteSavedMap(btn.dataset.mmDelete));
  });
}

function mmCardHTML(m) {
  const count = countNodes(m.root);
  return `<div class="card" style="padding:14px 16px;">
    <div style="display:flex;gap:12px;align-items:center;">
      <div style="width:34px;height:34px;border-radius:9px;background:var(--active-bg);color:var(--primary);display:flex;align-items:center;justify-content:center;flex-shrink:0;"><i class="fa-solid fa-diagram-project"></i></div>
      <div style="flex:1;min-width:0;">
        <strong style="font-size:.9rem;">${escapeHTML(m.title || "Untitled mind map")}</strong>
        <span class="badge badge-info" style="margin-left:6px;">${count} nodes</span>
        <p class="card-subtitle" style="margin:2px 0 0;">${timeAgo(m.createdAt)}</p>
      </div>
      <div style="display:flex;gap:6px;flex-wrap:wrap;">
        <button class="btn btn-ghost btn-sm" data-mm-open="${m.id}"><i class="fa-solid fa-eye"></i> Open</button>
        <button class="btn btn-danger btn-sm" data-mm-delete="${m.id}" aria-label="Delete"><i class="fa-solid fa-trash"></i></button>
      </div>
    </div>
  </div>`;
}

function countNodes(node) {
  if (!node) return 0;
  return 1 + (node.children || []).reduce((s, c) => s + countNodes(c), 0);
}

function openSavedMap(id) {
  const m = appState.mindMaps.find((x) => x.id === id);
  if (!m) return;
  const layout = document.getElementById("mmLayout");
  if (layout) layout.style.display = "grid";
  selectedNodeId = null;
  mmView = { x: 0, y: 0, scale: 1 };
  mmView._centered = false;
  drawMindMap(m);
  const canvas = document.getElementById("mmCanvas");
  if (canvas) canvas.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function deleteSavedMap(id) {
  confirmAction("Delete this mind map?").then((ok) => {
    if (!ok) return;
    appState.mindMaps = appState.mindMaps.filter((x) => x.id !== id);
    saveState();
    showToast("Mind map deleted.", "info");
    renderMindmap();
  });
}

// ============================================
// Generation
// ============================================

async function generateMindMap() {
  const view = document.getElementById("view-mindmap");
  const paste = view.querySelector("#mmPaste");
  const text = (paste && paste.value ? paste.value : "").trim();
  if (!text) {
    showToast("Add some content to map first.", "warning");
    return;
  }

  showLoader("Generating mind map...");
  mascot.react("thinking");
  try {
    let root = null;
    try {
      const raw = await callGemini(buildMindMapPrompt(text));
      const parsed = parseJSONResponse(raw);
      root = normalizeTree(parsed);
    } catch (err) {
      console.warn("[QuizNova] AI mind map failed, using local fallback:", err.message);
    }
    if (!root) root = buildLocalTree(text);

    const map = {
      id: generateId(),
      title: root.text.slice(0, 50) || "Mind map",
      root,
      createdAt: Date.now(),
    };
    appState.mindMaps.unshift(map);
    if (appState.mindMaps.length > 20) appState.mindMaps.length = 20;
    saveState();

    addXP(MINDMAP_XP, "Mind map created");
    checkAchievements();
    logActivity("Mind map created", "Mind Maps");
    recordStudy(2, "Mind map");

    const sourceSel = view.querySelector("#mmSourceSelect");
    if (sourceSel && sourceSel.value.startsWith("material:")) {
      trackUsage(sourceSel.value.slice("material:".length), "mindmaps");
    }

    renderMindmap();
    const layout = document.getElementById("mmLayout");
    if (layout) layout.style.display = "grid";
    selectedNodeId = null;
    mmView = { x: 0, y: 0, scale: 1 };
    mmView._centered = false;
    drawMindMap(map);
    mascot.react("reading");
    showToast(`Mind map created (+${MINDMAP_XP} XP).`, "success");
  } catch (err) {
    console.error("[QuizNova] Mind map generation failed:", err);
    showToast(`Failed to generate mind map: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

function buildMindMapPrompt(text) {
  return (
    `You are a mind map designer. Create a clean hierarchical mind map from the content below.\n` +
    `Return ONLY valid JSON (no markdown fences) with this exact structure:\n` +
    `{"root":"Central topic (2-6 words)","children":[{"text":"branch","children":[{"text":"leaf","children":[]}]}]}\n` +
    `Rules: 3 to 4 levels deep, each node text is SHORT (1-6 words), children arrays may be empty, keys are "text" and "children".\n\n` +
    `Content:\n${text.slice(0, MAX_INPUT)}`
  );
}

function normalizeTree(parsed, depth = 0) {
  if (!parsed || typeof parsed !== "object") return null;
  if (typeof parsed.root === "string") {
    return {
      id: generateId(),
      text: cleanNodeText(parsed.root),
      children: Array.isArray(parsed.children)
        ? parsed.children.map((c) => normalizeNode(c, depth + 1)).filter(Boolean)
        : [],
      collapsed: false,
    };
  }
  return normalizeNode(parsed, depth);
}

function normalizeNode(node, depth = 0) {
  if (!node || typeof node !== "object") return null;
  const text = cleanNodeText(node.text || node.title || node.name || "");
  if (!text) return null;
  const kids = (node.children || []).slice(0, 8);
  return {
    id: generateId(),
    text,
    children: depth < 3 ? kids.map((c) => normalizeNode(c, depth + 1)).filter(Boolean) : [],
    collapsed: false,
  };
}

function cleanNodeText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 60);
}

// ---- Fallback tree builder from plain text ----
function buildLocalTree(text) {
  const lines = text
    .split("\n")
    .map((l) => l.replace(/^[#\-\*\d.\s]+/, "").trim())
    .filter(Boolean);
  const root = {
    id: generateId(),
    text: lines[0] ? lines[0].slice(0, 40) : "Study Notes",
    children: [],
    collapsed: false,
  };
  const branches = lines.slice(1, 7).map((l, i) => ({
    id: generateId(),
    text: l.slice(0, 45),
    children: [],
    collapsed: false,
  }));
  root.children = branches;
  return root;
}

// ============================================
// SVG rendering (layout, pan, zoom, collapse)
// ============================================

function layoutTree(node, depth, left) {
  node._y = depth * V_SPACE;
  const kids = node.collapsed ? [] : node.children || [];
  if (!kids.length) {
    node._x = left;
    node._w = NODE_W;
    return left + NODE_W;
  }
  let cursor = left;
  kids.forEach((k) => {
    cursor = layoutTree(k, depth + 1, cursor) + H_SPACE;
  });
  node._x = (left + cursor - H_SPACE) / 2 - NODE_W / 2;
  node._w = NODE_W;
  return cursor - H_SPACE;
}

function visibleNodes(root) {
  const out = [];
  const walk = (n, depth, path) => {
    out.push({ node: n, depth, path });
    if (n.collapsed) return;
    (n.children || []).forEach((c) => walk(c, depth + 1, path.concat(n)));
  };
  walk(root, 0, []);
  return out;
}

function wrapText(text, maxChars, maxLines) {
  const words = String(text).split(" ");
  const lines = [];
  let cur = "";
  for (const w of words) {
    if ((cur + " " + w).trim().length > maxChars && cur) {
      lines.push(cur.trim());
      cur = w;
    } else {
      cur = (cur + " " + w).trim();
    }
    if (lines.length >= maxLines) break;
  }
  if (lines.length < maxLines && cur) lines.push(cur.trim());
  return lines.slice(0, maxLines);
}

function drawMindMap(map) {
  const canvas = document.getElementById("mmCanvas");
  if (!canvas) return;
  const root = map.root;
  const totalWidth = layoutTree(root, 0, 0);
  const visible = visibleNodes(root);
  visible.forEach(({ node }) => (node._x -= totalWidth / 2));
  const maxY = Math.max(...visible.map((v) => v.node._y + NODE_H), NODE_H);
  const pad = 60;

  const width = Math.max(canvas.clientWidth || 700, totalWidth + pad * 2);
  const height = maxY + pad * 2;

  let edges = "";
  const drawEdges = (n) => {
    if (n.collapsed) return;
    const px = n._x + NODE_W / 2;
    const py = n._y + NODE_H;
    (n.children || []).forEach((c) => {
      const cx = c._x + NODE_W / 2;
      const cy = c._y + pad;
      const mx = (px + cx) / 2;
      edges += `<path d="M ${px} ${py} C ${mx} ${py}, ${mx} ${cy}, ${cx} ${cy}" fill="none" stroke="var(--mm-edge, #94A3B8)" stroke-width="2"/>`;
      drawEdges(c);
    });
  };
  drawEdges(root);

  const nodesHTML = visible
    .map(({ node, depth }) => {
      const kids = node.children || [];
      const isSelected = node.id === selectedNodeId;
      const cls = ["mm-node"];
      if (depth === 0) cls.push("mm-root");
      if (isSelected) cls.push("mm-selected");
      const x = node._x;
      const y = node._y + pad;
      const badge = !node.collapsed && kids.length ? kids.length : null;
      const lines = wrapText(node.text, 20, 2);
      const tspan = lines
        .map((l, i) => `<tspan x="${NODE_W / 2}" dy="${i === 0 ? "0" : "1.15em"}">${escapeHTML(l)}</tspan>`)
        .join("");
      return `<g class="${cls.join(" ")}" data-id="${node.id}" transform="translate(${x},${y})">
        <rect x="0" y="0" width="${NODE_W}" height="${NODE_H}" rx="10"/>
        <text class="mm-node-text" text-anchor="middle" dy="0.35em">${tspan}</text>
        ${
          badge
            ? `<circle class="mm-collapse-badge" data-toggle="${node.id}" cx="${NODE_W - 12}" cy="${NODE_H / 2}" r="9"><title>Collapse</title></circle><text class="mm-collapse-text" data-toggle="${node.id}" x="${NODE_W - 12}" y="${NODE_H / 2}" text-anchor="middle" dominant-baseline="central">${badge}</text>`
            : ""
        }
      </g>`;
    })
    .join("");

  canvas.innerHTML = `
    <svg id="mmSvg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-label="Interactive mind map">
      <rect class="mm-bg" x="0" y="0" width="${width}" height="${height}" rx="12"/>
      <g id="mmGroup" transform="translate(${mmView.x},${mmView.y}) scale(${mmView.scale})">
        ${edges}
        ${nodesHTML}
      </g>
    </svg>`;

  if (!mmView._centered) {
    mmView = { x: width / 2, y: 12, scale: 1, _centered: true };
    const group = canvas.querySelector("#mmGroup");
    if (group) group.setAttribute("transform", `translate(${mmView.x},${mmView.y}) scale(${mmView.scale})`);
  }

  bindMindMapCanvas(canvas, root, map);
}

function bindMindMapCanvas(canvas, root, map) {
  const svg = canvas.querySelector("#mmSvg");
  if (!svg) return;

  const applyTransform = () => {
    const group = canvas.querySelector("#mmGroup");
    if (group) group.setAttribute("transform", `translate(${mmView.x},${mmView.y}) scale(${mmView.scale})`);
  };

  // ---- Node click / collapse ----
  svg.querySelectorAll(".mm-node").forEach((g) => {
    g.addEventListener("click", (e) => {
      if (e.target.closest("[data-toggle]")) {
        // collapse toggle handled below
        return;
      }
      selectNode(g.dataset.id, root, map);
    });
  });
  svg.querySelectorAll("[data-toggle]").forEach((el) => {
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCollapse(el.dataset.toggle, map);
    });
  });

  // ---- Zoom buttons ----
  const zoom = (factor, cx, cy) => {
    const rect = svg.getBoundingClientRect();
    const ox = cx !== undefined ? cx - rect.left : rect.width / 2;
    const oy = cy !== undefined ? cy - rect.top : rect.height / 2;
    const next = Math.min(2.5, Math.max(0.25, mmView.scale * factor));
    if (next === mmView.scale) return;
    const r = next / mmView.scale;
    mmView.x = ox - r * (ox - mmView.x);
    mmView.y = oy - r * (oy - mmView.y);
    mmView.scale = next;
    applyTransform();
  };

  const zoomInBtn = document.getElementById("mmZoomIn");
  const zoomOutBtn = document.getElementById("mmZoomOut");
  if (zoomInBtn) zoomInBtn.addEventListener("click", () => zoom(1.25));
  if (zoomOutBtn) zoomOutBtn.addEventListener("click", () => zoom(0.8));

  // ---- Wheel zoom ----
  svg.addEventListener(
    "wheel",
    (e) => {
      e.preventDefault();
      zoom(e.deltaY < 0 ? 1.1 : 0.9, e.clientX, e.clientY);
    },
    { passive: false }
  );

  // ---- Pan (drag) ----
  let dragging = false;
  let start = null;
  svg.addEventListener("pointerdown", (e) => {
    if (e.target.closest(".mm-node")) return;
    dragging = true;
    start = { x: e.clientX, y: e.clientY };
    svg.style.cursor = "grabbing";
  });
  svg.addEventListener("pointermove", (e) => {
    if (!dragging || !start) return;
    mmView.x += e.clientX - start.x;
    mmView.y += e.clientY - start.y;
    start = { x: e.clientX, y: e.clientY };
    applyTransform();
  });
  svg.addEventListener("pointerup", () => {
    dragging = false;
    svg.style.cursor = "grab";
  });

  // ---- Fit to screen ----
  const fitBtn = document.getElementById("mmFit");
  if (fitBtn) {
    fitBtn.addEventListener("click", () => {
      mmView = { x: 20, y: 12, scale: 1 };
      applyTransform();
    });
  }

  // ---- Expand all ----
  const expandBtn = document.getElementById("mmExpandAll");
  if (expandBtn) {
    expandBtn.addEventListener("click", () => {
      const unroll = (n) => {
        n.collapsed = false;
        (n.children || []).forEach(unroll);
      };
      unroll(root);
      drawMindMap(map);
    });
  }

  // ---- Export buttons ----
  const pngBtn = document.getElementById("mmExportPNG");
  if (pngBtn) pngBtn.addEventListener("click", () => exportPNG(svg, map));
  const jsonBtn = document.getElementById("mmExportJSON");
  if (jsonBtn) jsonBtn.addEventListener("click", () => exportJSON(map));

  svg.style.cursor = "grab";
}

function toggleCollapse(id, map) {
  const find = (n) => {
    if (n.id === id) return n;
    for (const c of n.children || []) {
      const r = find(c);
      if (r) return r;
    }
    return null;
  };
  const node = find(map.root);
  if (!node || !(node.children || []).length) return;
  node.collapsed = !node.collapsed;
  selectedNodeId = id;
  drawMindMap(map);
}

function selectNode(id, root, map) {
  selectedNodeId = id;
  const path = [];
  let node = null;
  const walk = (n, trail) => {
    if (node) return;
    if (n.id === id) {
      node = n;
      path.push(...trail, n);
      return;
    }
    (n.children || []).forEach((c) => walk(c, trail.concat(n)));
  };
  walk(root, []);
  renderDetail(node, path, map);
  // re-highlight
  const canvas = document.getElementById("mmCanvas");
  if (canvas) {
    canvas.querySelectorAll(".mm-node").forEach((g) => g.classList.toggle("mm-selected", g.dataset.id === id));
  }
}

function renderDetail(node, path, map) {
  const detail = document.getElementById("mmDetail");
  if (!detail) return;
  if (!node) {
    detail.style.display = "none";
    return;
  }
  const kids = node.children || [];
  const crumb = path.map((p) => p.text).join(" › ");
  detail.style.display = "block";
  detail.innerHTML = `
    <div class="card-title">Node details</div>
    <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:8px;">${escapeHTML(crumb)}</div>
    <h3 style="font-size:1rem;margin-bottom:10px;">${escapeHTML(node.text)}</h3>
    <p class="card-subtitle">${kids.length} direct ${kids.length === 1 ? "child" : "children"} · ${countNodes(node)} nodes in this subtree</p>
    ${
      kids.length
        ? `<ul style="margin:8px 0 0 20px;display:flex;flex-direction:column;gap:4px;">${kids.map((k) => `<li style="font-size:.85rem;">${escapeHTML(k.text)}${k.children && k.children.length ? ' <span style="color:var(--text-muted);font-size:.75rem;">…</span>' : ""}</li>`).join("")}</ul>`
        : '<p class="card-subtitle" style="margin-top:8px;">Leaf node — no children.</p>'
    }
    ${
      kids.length
        ? `<button class="btn btn-ghost btn-sm" id="mmToggleCollapse" style="margin-top:14px;"><i class="fa-solid fa-up-down"></i> ${node.collapsed ? "Expand" : "Collapse"} branch</button>`
        : ""
    }
  `;
  const toggle = detail.querySelector("#mmToggleCollapse");
  if (toggle) toggle.addEventListener("click", () => toggleCollapse(node.id, map));
}

// ============================================
// Export
// ============================================

function exportPNG(svg, map) {
  try {
    const clone = svg.cloneNode(true);
    clone.removeAttribute("style");
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    const width = parseFloat(svg.getAttribute("width")) || 800;
    const height = parseFloat(svg.getAttribute("height")) || 600;
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = width;
      c.height = height;
      const cctx = c.getContext("2d");
      cctx.fillStyle = getComputedStyle(document.body).backgroundColor || "#0F172A";
      cctx.fillRect(0, 0, width, height);
      cctx.drawImage(img, 0, 0, width, height);
      const name = (map.title || "mindmap").replace(/[^a-z0-9-_ ]/gi, "").replace(/\s+/g, "-").slice(0, 40) || "mindmap";
      safeDownload(`${name}.png`, c.toDataURL("image/png"), "image/png");
      URL.revokeObjectURL(url);
      showToast("Mind map exported as PNG.", "success");
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      showToast("PNG export failed.", "error");
    };
    img.src = url;
  } catch (err) {
    console.error("[QuizNova] PNG export failed:", err);
    showToast("PNG export failed.", "error");
  }
}

function exportJSON(map) {
  const name = (map.title || "mindmap").replace(/[^a-z0-9-_ ]/gi, "").replace(/\s+/g, "-").slice(0, 40) || "mindmap";
  safeDownload(`${name}.json`, JSON.stringify(map.root, null, 2), "application/json");
  showToast("Mind map exported as JSON.", "success");
}

export {
  renderMindmap,
  generateMindMap,
  drawMindMap,
  buildLocalTree,
  normalizeTree,
};
