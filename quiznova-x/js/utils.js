// ============================================
// QuizNova X — utils.js
// Pure utility functions (no DOM side effects)
// ============================================

// ---- Sanitize a string for insertion via textContent ----
function escapeHTML(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ---- Sanitize a string for use inside HTML attribute values ----
function escapeAttr(str) {
  if (str === null || str === undefined) return "";
  return escapeHTML(str)
    .replace(/`/g, "&#96;")
    .replace(/=/g, "&#61;");
}

// ---- Parse AI JSON: strip fences, fix wrappers, try multiple strategies ----
function parseAIJSON(text) {
  if (typeof text !== "string") return null;
  const cleaned = text.trim();
  if (!cleaned) return null;

  const attempts = [
    // 1. Direct parse
    () => JSON.parse(cleaned),
    // 2. ```json ... ``` fenced block
    () => {
      const match = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
      if (!match) throw new Error("no fenced block");
      return JSON.parse(match[1]);
    },
    // 3. First { ... last } slice (ignores surrounding prose)
    () => {
      const start = cleaned.indexOf("{");
      const end = cleaned.lastIndexOf("}");
      if (start === -1 || end <= start) throw new Error("no object braces");
      return JSON.parse(cleaned.slice(start, end + 1));
    },
    // 4. First [ ... last ] slice
    () => {
      const start = cleaned.indexOf("[");
      const end = cleaned.lastIndexOf("]");
      if (start === -1 || end <= start) throw new Error("no array brackets");
      return JSON.parse(cleaned.slice(start, end + 1));
    },
    // 5. Lenient: fix trailing commas + single quotes
    () => {
      const fixed = cleaned
        .replace(/,\s*([}\]])/g, "$1")
        .replace(/([{,]\s*)'([^']+)'\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']*)'/g, ':"$1"');
      return JSON.parse(fixed);
    },
  ];

  for (const attempt of attempts) {
    try {
      const result = attempt();
      if (result !== null && typeof result === "object") return result;
    } catch (_) {
      // try the next strategy
    }
  }

  console.warn("[QuizNova] Failed to parse AI JSON:", text);
  return null;
}

// ---- Strip dangerous tags/attributes, keep safe formatting tags ----
function cleanHTML(text) {
  if (typeof text !== "string") return "";
  const ALLOWED_TAGS = new Set([
    "p", "b", "strong", "i", "em", "u", "s", "h1", "h2", "h3", "h4", "h5", "h6",
    "ul", "ol", "li", "br", "hr", "div", "span", "a", "code", "pre", "blockquote",
    "table", "thead", "tbody", "tr", "th", "td", "sup", "sub", "mark", "del", "ins",
  ]);
  return text
    // Remove dangerous element blocks entirely
    .replace(/<script[\s\S]*?<\/script\s*>/gi, "")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, "")
    .replace(/<iframe[\s\S]*?<\/iframe\s*>/gi, "")
    .replace(/<object[\s\S]*?<\/object\s*>/gi, "")
    .replace(/<embed[\s\S]*?<\/embed\s*>/gi, "")
    .replace(/<form[\s\S]*?<\/form\s*>/gi, "")
    .replace(/<template[\s\S]*?<\/template\s*>/gi, "")
    // Remove event handlers and javascript: URLs
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/\b(href|src)\s*=\s*(?:"\s*javascript:[^"]*"|'\s*javascript:[^']*'|\s*javascript:[^\s>]*)/gi, "")
    // Allowlist tags (attributes stripped for safety)
    .replace(/<\s*\/?\s*([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g, (match, tag) => {
      const lower = tag.toLowerCase();
      if (ALLOWED_TAGS.has(lower)) {
        return match.trimStart().startsWith("</") ? `</${lower}>` : `<${lower}>`;
      }
      return "";
    });
}

// ---- Trigger a safe browser download ----
function safeDownload(filename, content, mimeType = "text/plain") {
  try {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return true;
  } catch (err) {
    console.warn("[QuizNova] Download failed:", err);
    return false;
  }
}

// ---- Unique ID: crypto.randomUUID with a fallback ----
function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "id-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
}

// ---- Human-readable date ----
function formatDate(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

// ---- Relative time ("2 hours ago") ----
function timeAgo(ts) {
  const d = ts instanceof Date ? ts : new Date(ts);
  if (isNaN(d.getTime())) return "—";
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 10) return "just now";
  if (seconds < 60) return `${seconds} seconds ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} ${minutes === 1 ? "minute" : "minutes"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} ${days === 1 ? "day" : "days"} ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ${months === 1 ? "month" : "months"} ago`;
  const years = Math.floor(months / 12);
  return `${years} ${years === 1 ? "year" : "years"} ago`;
}

// ---- Fisher-Yates shuffle (returns a new array) ----
function shuffleArray(arr) {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

// ---- Clamp a value into [min, max] ----
function clamp(val, min, max) {
  if (val < min) return min;
  if (val > max) return max;
  return val;
}

// ---- Debounce: run fn after `ms` of quiet ----
function debounce(fn, ms = 300) {
  let timer = null;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

// ---- Throttle: run fn at most once per `ms` ----
function throttle(fn, ms = 300) {
  let last = 0;
  let timer = null;
  return function (...args) {
    const now = Date.now();
    const remaining = ms - (now - last);
    if (remaining <= 0) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      last = now;
      fn.apply(this, args);
    } else if (!timer) {
      timer = setTimeout(() => {
        last = Date.now();
        timer = null;
        fn.apply(this, args);
      }, remaining);
    }
  };
}

export {
  escapeHTML,
  escapeAttr,
  parseAIJSON,
  cleanHTML,
  safeDownload,
  generateId,
  formatDate,
  timeAgo,
  shuffleArray,
  clamp,
  debounce,
  throttle,
};
