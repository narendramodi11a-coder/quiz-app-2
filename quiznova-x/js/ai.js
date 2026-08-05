// ============================================
// QuizNova X — ai.js
// Gemini API integration (server proxy)
// ============================================

import { CONFIG } from "./config.js";
import { parseAIJSON } from "./utils.js";

const GEMINI_API_KEY = "";
const GEMINI_MODEL = CONFIG.GEMINI_MODEL || "gemini-2.5-flash";

// ---- Call the server API endpoint for Gemini ----
// prompt:      the text prompt
// inlineData:  { mimeType: string, data: base64 string } for files/images
// Returns the combined response text.
async function callGemini(prompt, inlineData = null) {
  if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
    throw new Error("Empty prompt provided.");
  }

  let res;
  try {
    res = await fetch("/api/gemini", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, inlineData, model: GEMINI_MODEL }),
    });
  } catch (err) {
    throw new Error("Network error while reaching server. Please check your connection.");
  }

  if (!res.ok) {
    let detail = "";
    try {
      const errBody = await res.json();
      detail = errBody?.error || errBody?.message || "";
    } catch (_) {
      // ignore parse failure
    }
    throw new Error(`Gemini request failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  const data = await res.json();
  if (data.error) {
    throw new Error(data.error);
  }

  const text = data.text || "";
  if (!text.trim()) {
    throw new Error("Gemini returned an empty response.");
  }
  return text;
}

// ---- Append a language instruction to the base prompt ----
function buildPrompt(base, language = "English") {
  if (!language || language.toLowerCase() === "english") return base;
  return `${base}\n\nPlease respond in ${language}.`;
}

// ---- Parse a response body as JSON using utils.parseAIJSON ----
function parseJSONResponse(text) {
  return parseAIJSON(text);
}

// ---- Quick capability check ----
function isGeminiConfigured() {
  return true;
}

export {
  GEMINI_API_KEY,
  GEMINI_MODEL,
  callGemini,
  buildPrompt,
  parseJSONResponse,
  isGeminiConfigured,
};
