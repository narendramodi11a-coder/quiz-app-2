// ============================================
// QuizNova X — mascot.js
// Emoji-based study buddy (floating widget)
// ============================================

import { appState } from "./state.js";

const MASCOT_EMOJIS = {
  idle: "🤖",
  thinking: "🤔",
  celebrating: "🎉",
  encouraging: "💪",
  sad: "😢",
  sleeping: "😴",
  reading: "📚",
  streak: "🔥",
};

const MASCOT_MESSAGES = {
  idle: ["Ready to learn?", "What shall we study?", "Let's go!", "I'm here when you need me."],
  thinking: ["Hmm... let me think...", "Processing...", "Interesting!"],
  celebrating: ["Amazing!", "You're on fire!", "Keep it up!", "That was brilliant!"],
  encouraging: ["You got this!", "Don't give up!", "One more try!", "Mistakes help you grow!"],
  sad: ["Oh no!", "That's okay, let's try again.", "I believe in you."],
  sleeping: ["Zzz... wake me when you're ready!", "zzz...", "Good night..."],
  reading: ["So interesting!", "Tell me more!", "Let's dive deeper!"],
  streak: ["On a roll! Keep it going!", "Streak alert! 🔥", "Day after day, amazing!"],
};

const MASCOT_STYLE_ID = "quiznova-mascot-styles";
const IDLE_TIMEOUT_MS = 5 * 60 * 1000;

class Mascot {
  constructor() {
    this.state = "idle";
    this.bubbleTimer = null;
    this.lastActivity = Date.now();
    this.suppressed = false;

    this.container = document.getElementById("mascotContainer");
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.id = "mascotContainer";
      document.body.appendChild(this.container);
    }

    this.injectStyles();
    this.container.innerHTML = `
      <div class="mascot" id="mascot" role="status" aria-label="QuizNova study buddy">
        <div class="mascot-bubble hidden"><span class="mascot-message"></span></div>
        <div class="mascot-emoji"></div>
      </div>`;

    this.root = this.container.querySelector(".mascot");
    this.bubble = this.container.querySelector(".mascot-bubble");
    this.messageEl = this.container.querySelector(".mascot-message");
    this.emojiEl = this.container.querySelector(".mascot-emoji");

    // Fall asleep if the learner is inactive for 5+ minutes
    setInterval(() => {
      if (
        !this.suppressed &&
        this.state !== "sleeping" &&
        Date.now() - this.lastActivity > IDLE_TIMEOUT_MS
      ) {
        this.setState("sleeping");
      }
    }, 30000);

    this.setState("idle");
    this.applySettings();
  }

  injectStyles() {
    if (document.getElementById(MASCOT_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = MASCOT_STYLE_ID;
    style.textContent = `
      .mascot {
        position: fixed;
        right: 18px;
        bottom: 70px;
        z-index: 96;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        user-select: none;
        transition: opacity 0.3s, transform 0.3s;
      }
      .mascot.mascot-hidden {
        opacity: 0;
        pointer-events: none;
        transform: translateY(10px);
      }
      .mascot-emoji {
        font-size: 2.6rem;
        line-height: 1;
        filter: drop-shadow(0 4px 10px rgba(0, 0, 0, 0.3));
        animation: mascot-bounce 3s ease-in-out infinite;
      }
      .mascot-bubble {
        background: var(--card-bg, #1e293b);
        color: var(--text-main, #e5e7eb);
        border: 1px solid var(--border, #334155);
        border-radius: 14px;
        padding: 8px 12px;
        font-size: 0.8rem;
        max-width: 200px;
        text-align: center;
        position: relative;
        box-shadow: 0 6px 18px var(--shadow, rgba(0, 0, 0, 0.25));
        font-family: "Inter", sans-serif;
      }
      .mascot-bubble::after {
        content: "";
        position: absolute;
        bottom: -6px;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: var(--card-bg, #1e293b);
      }
      .mascot-bubble.hidden { display: none; }
      @keyframes mascot-bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-6px); }
      }
    `;
    document.head.appendChild(style);
  }

  // ---- Update emoji + speech bubble ----
  setState(state, message = "") {
    this.lastActivity = Date.now();
    this.state = MASCOT_EMOJIS[state] ? state : "idle";
    if (this.emojiEl) this.emojiEl.textContent = MASCOT_EMOJIS[this.state];

    const pool = MASCOT_MESSAGES[this.state] || MASCOT_MESSAGES.idle;
    const text = message || pool[Math.floor(Math.random() * pool.length)];
    this.showBubble(text);
    return this;
  }

  // ---- Show a speech bubble for a few seconds ----
  showBubble(text) {
    if (!this.bubble || !this.messageEl) return;
    this.bubble.classList.remove("hidden");
    this.messageEl.textContent = text;
    clearTimeout(this.bubbleTimer);
    this.bubbleTimer = setTimeout(() => this.bubble.classList.add("hidden"), 4000);
    return this;
  }

  hideBubble() {
    if (this.bubble) this.bubble.classList.add("hidden");
    return this;
  }

  // ---- Map events (or state names) to a mascot state ----
  react(event) {
    const map = {
      "quiz-pass": "celebrating",
      "quiz-fail": "encouraging",
      streak: "streak",
      idle: "idle",
      generating: "thinking",
      reading: "reading",
      sleeping: "sleeping",
      sad: "sad",
    };
    const state = MASCOT_EMOJIS[event] ? event : map[event] || "idle";
    return this.setState(state);
  }

  show() {
    if (this.root) this.root.classList.remove("mascot-hidden");
    return this;
  }

  hide() {
    if (this.root) this.root.classList.add("mascot-hidden");
    return this;
  }

  // ---- Reflect settings.showMascot ----
  applySettings() {
    const show = appState.settings.showMascot;
    if (show) this.show();
    else this.hide();
    return this;
  }
}

// ---- Singleton ----
const mascot = new Mascot();

export { Mascot, mascot, MASCOT_EMOJIS, MASCOT_MESSAGES };
