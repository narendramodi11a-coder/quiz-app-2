// ============================================
// QuizNova X — quiz.js
// Full quiz engine: setup, generation, timer, 4 modes, results
// ============================================

import { appState, saveState } from "./state.js";
import { callGemini, buildPrompt, parseJSONResponse } from "./ai.js";
import { showToast, showLoader, hideLoader, confirmAction, renderEmptyState } from "./ui.js";
import { escapeHTML, escapeAttr, generateId, shuffleArray } from "./utils.js";
import { addXP, completeChallenge } from "./gamification.js";
import { trackUsage } from "./usage.js";
import { mascot } from "./mascot.js";

const DIFFICULTY_MULT = { easy: 1, medium: 1.5, hard: 2, adaptive: 1.5 };
const MODE_MULT = { practice: 1, exam: 1.5, endless: 1, "full-length": 1.5 };

let quizState = null;
let timerInterval = null;
let keyboardHandler = null;
let endlessGenerating = false;

// ============================================
// Rendering
// ============================================

function renderQuiz() {
  const view = document.getElementById("view-quiz");
  if (!view) return;
  if (quizState) {
    renderQuestion();
    return;
  }
  renderSetup(view);
}

function renderSetup(view) {
  const materials = appState.studyMaterial;
  const ctx = window.quiznovaContext || {};
  const preMaterialId = ctx.materialId || null;
  if (preMaterialId) delete window.quiznovaContext.materialId;
  const preSource = preMaterialId ? "material" : "custom";
  const hasMaterial = materials.length > 0;

  const sources = [
    ["custom", "Custom Topic"],
    ["material", "Uploaded Material"],
    ["mistakes", "Mistake Journal"],
    ["skilltree", "Skill Tree Node"],
  ];

  view.innerHTML = `
    <div class="view-heading"><h2>Create Quiz</h2></div>
    <div class="card quiz-setup">
      <div class="view-section">
        <span class="label">Source</span>
        <div style="display:flex;flex-wrap:wrap;gap:10px;">
          ${sources
            .map(
              ([value, label]) => `
                <label class="chip quiz-source" style="cursor:pointer;${value === preSource ? "border-color:var(--primary);color:var(--primary);background:var(--active-bg);" : ""}">
                  <input type="radio" name="quizSource" value="${value}" ${value === preSource ? "checked" : ""} style="display:none;">
                  ${label}
                </label>`
            )
            .join("")}
        </div>
      </div>

      <div class="view-section" id="quizTopicWrap">
        <span class="label">Topic</span>
        <input class="input" id="quizTopic" placeholder="e.g. Photosynthesis, World War II, JavaScript...">
      </div>
      <div class="view-section" id="quizMaterialWrap" style="display:${preMaterialId ? "block" : "none"};">
        <span class="label">Material</span>
        <select class="select" id="quizMaterial">
          ${hasMaterial ? materials.map((m) => `<option value="${m.id}" ${m.id === preMaterialId ? "selected" : ""}>${escapeHTML(m.name)}</option>`).join("") : '<option value="">No material uploaded</option>'}
        </select>
      </div>
      <div class="view-section" id="quizMistakesWrap" style="display:none;">
        <p class="card-subtitle">Questions will be based on your ${appState.mistakeJournal.length} logged mistakes.</p>
      </div>
      <div class="view-section" id="quizSkillWrap" style="display:none;">
        <p class="card-subtitle">Questions will cover your skill tree topics.</p>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;">
        <div>
          <span class="label">Difficulty</span>
          <select class="select" id="quizDifficulty">${["Easy", "Medium", "Hard", "Adaptive"].map((d) => `<option>${d}</option>`).join("")}</select>
        </div>
        <div>
          <span class="label">Questions</span>
          <select class="select" id="quizCount">${[5, 10, 15, 20, 25].map((c) => `<option>${c}</option>`).join("")}</select>
        </div>
        <div>
          <span class="label">Timer</span>
          <select class="select" id="quizTimer">
            <option value="none">None</option>
            <option value="180">3 min</option>
            <option value="300">5 min</option>
            <option value="600">10 min</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div id="quizCustomWrap" style="display:none;">
          <span class="label">Minutes</span>
          <input class="input" id="quizCustomTimer" type="number" min="1" max="120" value="2">
        </div>
        <div>
          <span class="label">Mode</span>
          <select class="select" id="quizMode">${["Practice", "Exam", "Endless", "Full-Length"].map((m) => `<option>${m}</option>`).join("")}</select>
        </div>
        <div>
          <span class="label">Question type</span>
          <select class="select" id="quizType">${["MCQ", "True-False", "Mixed"].map((t) => `<option>${t}</option>`).join("")}</select>
        </div>
        <div>
          <span class="label">Language</span>
          <input class="input" id="quizLanguage" value="${escapeAttr(appState.settings.language || "English")}">
        </div>
      </div>

      <div style="margin-top:18px;">
        <button class="btn btn-primary btn-lg btn-block" id="startQuizBtn"><i class="fa-solid fa-bolt"></i> Start Quiz</button>
      </div>
    </div>
    ${hasMaterial ? "" : renderEmptyState("folder-open", "Tip: upload material to quiz from it.")}
  `;

  bindSetup(view, hasMaterial);
}

function bindSetup(view, hasMaterial) {
  view.querySelector("#startQuizBtn").addEventListener("click", onStartQuiz);

  view.querySelectorAll("input[name=quizSource]").forEach((radio) => {
    radio.addEventListener("change", () => {
      const v = radio.value;
      const topicWrap = view.querySelector("#quizTopicWrap");
      const matWrap = view.querySelector("#quizMaterialWrap");
      const misWrap = view.querySelector("#quizMistakesWrap");
      const skillWrap = view.querySelector("#quizSkillWrap");
      topicWrap.style.display = v === "custom" ? "block" : "none";
      matWrap.style.display = v === "material" ? "block" : "none";
      misWrap.style.display = v === "mistakes" ? "block" : "none";
      skillWrap.style.display = v === "skilltree" ? "block" : "none";
      view.querySelectorAll(".quiz-source").forEach((chip) => {
        const active = chip.querySelector("input").value === v;
        chip.style.borderColor = active ? "var(--primary)" : "var(--border)";
        chip.style.color = active ? "var(--primary)" : "";
        chip.style.background = active ? "var(--active-bg)" : "";
      });
    });
  });

  const timerSel = view.querySelector("#quizTimer");
  if (timerSel) {
    timerSel.addEventListener("change", () => {
      view.querySelector("#quizCustomWrap").style.display = timerSel.value === "custom" ? "block" : "none";
    });
  }
}

// ============================================
// Config → Generation
// ============================================

function sourceLabel(config) {
  if (config.source === "material") {
    const m = appState.studyMaterial.find((x) => x.id === config.materialId);
    return m ? m.name : "Material";
  }
  if (config.source === "custom") return config.topic || "Custom";
  return config.source;
}

function readConfigFromForm() {
  const view = document.getElementById("view-quiz");
  const val = (sel) => {
    const el = view.querySelector(sel);
    return el ? el.value : "";
  };
  const checked = view.querySelector("input[name=quizSource]:checked");
  const source = checked ? checked.value : "custom";
  const timerSel = val("#quizTimer");
  const customMinutes = Number(val("#quizCustomTimer") || 0);
  const typeRaw = val("#quizType") || "MCQ";

  return {
    source,
    topic: val("#quizTopic").trim(),
    materialId: val("#quizMaterial"),
    difficulty: val("#quizDifficulty") || "Medium",
    count: Number(val("#quizCount") || 10),
    timerSeconds: timerSel === "custom" ? customMinutes * 60 : timerSel === "none" ? 0 : Number(timerSel),
    mode: val("#quizMode") || "Practice",
    type: typeRaw === "True-False" ? "tf" : typeRaw === "Mixed" ? "mixed" : "mcq",
    language: val("#quizLanguage").trim() || appState.settings.language || "English",
  };
}

function validateConfig(config) {
  if (config.source === "custom" && !config.topic) {
    showToast("Enter a topic for your quiz.", "warning");
    return false;
  }
  if (config.source === "material" && !config.materialId) {
    showToast("Select a material to quiz from.", "warning");
    return false;
  }
  if (config.source === "mistakes" && !appState.mistakeJournal.length) {
    showToast("No mistakes in your journal yet.", "warning");
    return false;
  }
  if (config.source === "skilltree" && !appState.skillTree) {
    showToast("No skill tree found.", "warning");
    return false;
  }
  if (config.mode === "Full-Length") config.type = "fr";
  return true;
}

async function onStartQuiz() {
  const config = readConfigFromForm();
  if (!validateConfig(config)) return;
  showLoader(`Generating ${config.count} ${config.difficulty} questions...`);
  try {
    const questions = await generateQuiz(config);
    hideLoader();
    if (!questions.length) {
      showToast("No questions were generated.", "error");
      return;
    }
    startQuiz(questions, config);
  } catch (err) {
    hideLoader();
    showToast(err.message || "Failed to generate quiz.", "error");
  }
}

function buildQuizPrompt(config) {
  let typeInstr;
  if (config.mode === "Full-Length") {
    typeInstr = "open-ended (free-response) questions with NO multiple-choice options";
  } else if (config.type === "tf") {
    typeInstr = 'true/false questions with exactly the options ["True", "False"]';
  } else if (config.type === "mixed") {
    typeInstr =
      'a mix of multiple-choice questions (exactly 4 options) and true/false questions (options ["True", "False"])';
  } else {
    typeInstr = "multiple-choice questions with exactly 4 options each";
  }

  const difficulty = config.difficulty.toLowerCase() === "adaptive" ? "a mix of easy, medium and hard" : config.difficulty.toLowerCase();
  const topic = config.topic || sourceLabel(config) || "general knowledge";

  let sourceContext = "";
  if (config.source === "material") {
    const m = appState.studyMaterial.find((x) => x.id === config.materialId);
    if (m && m.text) sourceContext = `\n\nStudy material to base questions on:\n${m.text.slice(0, 12000)}`;
  } else if (config.source === "mistakes") {
    const recent = appState.mistakeJournal.slice(-10);
    if (recent.length) sourceContext = `\n\nBase questions on these past mistakes:\n${recent.map((m) => `- ${m.question}`).join("\n")}`;
  } else if (config.source === "skilltree") {
    const nodes = Array.isArray(appState.skillTree && appState.skillTree.nodes) ? appState.skillTree.nodes : [];
    const names = nodes.map((n) => n.name || n.title).filter(Boolean);
    if (names.length) sourceContext = `\n\nTopics to cover: ${names.join(", ")}`;
  }

  const base =
    `Generate exactly ${config.count} ${difficulty} ${typeInstr} about "${topic}" in ${config.language}.\n` +
    `Respond with ONLY a valid JSON array (no markdown fences, no commentary). Each element must be:\n` +
    `{"q":"question text","options":["opt1","opt2","opt3","opt4"],"ans":<0-based index of correct option>,"exp":"short explanation","type":"mcq" or "tf","topicTag":"topic"}\n` +
    `For true/false questions options must be exactly ["True","False"] and ans 0 or 1.\n` +
    `For open-ended questions omit options, set type "fr", and put a model answer in "exp".\n` +
    `Rules: exactly ${config.count} items, answer indexes must be valid, questions must be realistic ${difficulty} difficulty.` +
    sourceContext;

  return buildPrompt(base, config.language);
}

async function generateQuiz(config) {
  const prompt = buildQuizPrompt(config);
  const raw = await callGemini(prompt);
  const parsed = parseJSONResponse(raw);
  return validateQuestions(parsed, config);
}

function validateQuestions(parsed, config) {
  if (!Array.isArray(parsed)) {
    throw new Error("AI did not return a valid list of questions.");
  }
  const forceType = config.mode === "Full-Length" ? "fr" : null;
  const cleaned = parsed
    .map((raw) => {
      const q = {
        q: String(raw.q || raw.question || "").trim(),
        options: Array.isArray(raw.options) ? raw.options.map(String) : [],
        ans: Number.isInteger(raw.ans) ? raw.ans : Number(raw.answer),
        exp: String(raw.exp || raw.explanation || "").trim(),
        type: raw.type === "tf" ? "tf" : forceType || "mcq",
        topicTag: String(raw.topicTag || config.topic || sourceLabel(config) || "General").trim(),
      };
      if (q.type === "tf") {
        q.options = ["True", "False"];
        q.ans = q.ans === 1 ? 1 : 0;
      }
      if (q.type === "fr") {
        q.options = [];
        q.ans = null;
      }
      if (!q.q || q.type === "mcq" && (!Number.isInteger(q.ans) || q.options.length < 2)) {
        return null;
      }
      return q;
    })
    .filter(Boolean);

  if (!cleaned.length) {
    throw new Error("No valid questions could be parsed.");
  }
  return cleaned.slice(0, config.count);
}

// ============================================
// Quiz session
// ============================================

function startQuiz(questions, config) {
  clearTimer();
  disableKeyboard();
  quizState = {
    questions,
    config,
    current: 0,
    answers: [],
    startTime: Date.now(),
    hintsUsed: 0,
    timeBonus: 0,
    selected: null,
    revealed: false,
    hintText: "",
  };
  if (config.timerSeconds > 0) quizState.timeLeft = config.timerSeconds;
  renderQuestion();
  enableKeyboard();
  if (config.timerSeconds > 0) startTimer(config.timerSeconds);
}

function clearQuiz() {
  clearTimer();
  disableKeyboard();
  quizState = null;
}

function exitQuiz() {
  const doExit = () => {
    clearQuiz();
    renderQuiz();
  };
  if (quizState && quizState.answers.length) {
    confirmAction("Exit this quiz? Your progress will be lost.").then((ok) => ok && doExit());
  } else {
    confirmAction("Exit this quiz?").then((ok) => ok && doExit());
  }
}

// ---- Timer ----
function formatTimer(sec) {
  const s = Math.max(0, sec || 0);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function startTimer(totalSeconds) {
  clearTimer();
  quizState.timeLeft = totalSeconds;
  updateTimerDisplay();
  timerInterval = setInterval(() => {
    quizState.timeLeft -= 1;
    updateTimerDisplay();
    if (quizState.timeLeft <= 0) {
      clearTimer();
      forceSubmitOnTimeout();
    }
  }, 1000);
}

function clearTimer() {
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function updateTimerDisplay() {
  const el = document.getElementById("quizTimer");
  if (!el || !quizState) return;
  const t = Math.max(0, quizState.timeLeft || 0);
  el.textContent = `⏱️ ${formatTimer(t)}`;
  el.classList.toggle("badge-danger", t <= 15);
  el.classList.toggle("badge-warning", t > 15 && t <= 30);
}

function addTimeBonus() {
  if (!quizState || quizState.revealed || quizState.config.timerSeconds <= 0) return;
  quizState.timeBonus += 20;
  quizState.timeLeft += 20;
  updateTimerDisplay();
  showToast("+20 seconds added.", "info");
}

// ---- Keyboard ----
function enableKeyboard() {
  if (keyboardHandler) return;
  keyboardHandler = (e) => {
    const view = document.getElementById("view-quiz");
    if (!quizState || !view || !view.classList.contains("active")) return;
    if (e.key >= "1" && e.key <= "4") {
      selectOption(Number(e.key) - 1);
    } else if (e.key === "Enter") {
      submitOrNext();
    } else if (e.key.toLowerCase() === "h") {
      useHint();
    } else if (e.key.toLowerCase() === "t") {
      addTimeBonus();
    }
  };
  window.addEventListener("keydown", keyboardHandler);
}

function disableKeyboard() {
  if (keyboardHandler) {
    window.removeEventListener("keydown", keyboardHandler);
    keyboardHandler = null;
  }
}

// ---- Question rendering ----
function renderQuestion() {
  const view = document.getElementById("view-quiz");
  if (!view || !quizState) return;
  const { questions, current, config } = quizState;
  const q = questions[current];
  const total = questions.length;
  const isRevealed = quizState.revealed;
  const isFR = q.type === "fr";

  view.innerHTML = `
    <div class="quiz-screen">
      <div class="quiz-meta">
        <span class="badge badge-primary">Q ${current + 1} of ${total}</span>
        <span class="badge badge-warning">${escapeHTML(config.difficulty)}</span>
        ${q.topicTag ? `<span class="badge badge-info">${escapeHTML(q.topicTag)}</span>` : ""}
        ${config.timerSeconds > 0 ? `<span class="badge badge-danger" id="quizTimer">⏱️ ${formatTimer(quizState.timeLeft || 0)}</span>` : ""}
      </div>
      <div class="quiz-progress">
        <div class="progress-bar"><div class="progress-fill" style="width:${((current + 1) / total) * 100}%"></div></div>
      </div>
      <div class="quiz-question">${escapeHTML(q.q)}</div>
      ${isFR ? `<textarea class="textarea" id="frAnswer" placeholder="Type your answer..." style="min-height:120px;">${escapeHTML(quizState.frAnswer || "")}</textarea>` : optionsHTML(q, isRevealed)}
      ${isRevealed ? revealHTML(q) : ""}
      ${quizState.hintText ? `<div class="card" style="border-left:4px solid var(--warning);margin-top:12px;"><i class="fa-solid fa-lightbulb"></i> ${escapeHTML(quizState.hintText)}</div>` : ""}
      <div class="quiz-actions" style="display:flex;gap:10px;justify-content:center;margin-top:20px;flex-wrap:wrap;">
        <button class="btn btn-primary" id="quizSubmitBtn">${isRevealed ? "Next" : "Submit"}</button>
        ${!isRevealed ? `<button class="btn btn-ghost" id="quizHintBtn"><i class="fa-solid fa-lightbulb"></i> Hint</button>
        <button class="btn btn-ghost" id="quizTimeBtn"><i class="fa-solid fa-hourglass-half"></i> +20s</button>` : ""}
        <button class="btn btn-ghost" id="quizExitBtn">Exit</button>
      </div>
      <p style="text-align:center;color:var(--text-muted);font-size:.75rem;margin-top:14px;">1-4 select · Enter submit · H hint · T +20s</p>
    </div>
  `;

  view.querySelector("#quizSubmitBtn").addEventListener("click", submitOrNext);
  view.querySelector("#quizExitBtn").addEventListener("click", exitQuiz);

  if (isFR && !isRevealed) {
    const ta = view.querySelector("#frAnswer");
    if (ta) ta.addEventListener("input", () => (quizState.frAnswer = ta.value));
  }

  if (!isRevealed) {
    view.querySelectorAll("[data-option]").forEach((btn) =>
      btn.addEventListener("click", () => selectOption(Number(btn.dataset.option)))
    );
    const hintBtn = view.querySelector("#quizHintBtn");
    if (hintBtn) hintBtn.addEventListener("click", useHint);
    const timeBtn = view.querySelector("#quizTimeBtn");
    if (timeBtn) timeBtn.addEventListener("click", addTimeBonus);
  }
}

function optionsHTML(q, isRevealed) {
  const letters = ["A", "B", "C", "D", "E", "F"];
  const selected = quizState.selected;
  return `<div class="quiz-options">
    ${q.options
      .map((opt, i) => {
        let cls = "quiz-option";
        let icon = "";
        let extra = "";
        if (isRevealed) {
          if (i === q.ans) {
            cls += " correct";
            icon = ' <i class="fa-solid fa-check"></i>';
          } else if (i === selected) {
            cls += " wrong";
            icon = ' <i class="fa-solid fa-xmark"></i>';
          }
        } else if (selected === i) {
          cls += " selected";
          extra = "border-color:var(--primary);background:var(--active-bg);";
        }
        return `<button type="button" class="${cls}" data-option="${i}" ${isRevealed ? "disabled" : ""} style="${extra}">
          <span class="option-letter">${letters[i]}</span> ${escapeHTML(opt)}${icon}
        </button>`;
      })
      .join("")}
  </div>`;
}

function revealHTML(q) {
  const a = quizState.answers.find((x) => x.qIndex === quizState.current);
  if (!a) return "";
  if (q.type === "fr") {
    const score = a.score !== undefined ? a.score : 0;
    const good = score >= 50;
    return `<div class="card" style="border-left:4px solid ${good ? "var(--secondary)" : "var(--danger)"};margin-top:14px;">
      <span class="badge ${good ? "badge-success" : "badge-danger"}">${good ? "Good answer" : "Needs work"} · ${score}%</span>
      ${a.feedback ? `<p style="margin-top:8px;">${escapeHTML(a.feedback)}</p>` : ""}
      ${a.correctAnswer ? `<p style="margin-top:8px;"><strong>Reference answer:</strong> ${escapeHTML(a.correctAnswer)}</p>` : ""}
    </div>`;
  }
  const correct = a.correct === true;
  const correctText = q.options[q.ans] || "";
  const selectedText = a.selected != null ? q.options[a.selected] : null;
  return `<div class="card" style="border-left:4px solid ${correct ? "var(--secondary)" : "var(--danger)"};margin-top:14px;">
    <span class="badge ${correct ? "badge-success" : "badge-danger"}">${correct ? "Correct!" : "Incorrect"}</span>
    ${!correct ? `<p style="margin-top:8px;"><strong>Your answer:</strong> ${selectedText != null ? escapeHTML(selectedText) : "No answer"}</p>
    <p><strong>Correct:</strong> ${escapeHTML(correctText)}</p>` : ""}
    ${q.exp ? `<p style="margin-top:8px;color:var(--text-muted);"><strong>Why:</strong> ${escapeHTML(q.exp)}</p>` : ""}
  </div>`;
}

// ---- Interactions ----
function selectOption(idx) {
  if (!quizState || quizState.revealed) return;
  const q = quizState.questions[quizState.current];
  if (q.type === "fr") return;
  if (idx < 0 || idx >= q.options.length) return;
  quizState.selected = idx;
  const view = document.getElementById("view-quiz");
  view.querySelectorAll("[data-option]").forEach((btn) => {
    const i = Number(btn.dataset.option);
    btn.style.borderColor = i === idx ? "var(--primary)" : "var(--border)";
    btn.style.background = i === idx ? "var(--active-bg)" : "var(--card-bg)";
  });
}

function submitOrNext() {
  if (!quizState) return;
  if (quizState.revealed) nextQuestion();
  else submitAnswer();
}

function submitAnswer() {
  if (!quizState || quizState.revealed) return;
  const q = quizState.questions[quizState.current];
  if (q.type === "fr") {
    submitFreeResponse(q);
    return;
  }
  const selected = quizState.selected;
  if (selected === null || selected === undefined) {
    showToast("Select an option first.", "warning");
    return;
  }
  const correct = selected === q.ans;
  quizState.answers.push({ qIndex: quizState.current, selected, correct, exp: q.exp });

  if (!correct) addMistake(q, selected, null);
  else if (typeof quizState.config.onCorrect === "function") quizState.config.onCorrect(q);

  if (quizState.config.mode === "Exam") {
    quizState.current += 1;
    quizState.selected = null;
    quizState.revealed = false;
    if (quizState.current >= quizState.questions.length) finishQuiz();
    else renderQuestion();
    return;
  }
  quizState.revealed = true;
  renderQuestion();
}

async function submitFreeResponse(q) {
  const view = document.getElementById("view-quiz");
  const ta = view.querySelector("#frAnswer");
  const answerText = (ta ? ta.value : quizState.frAnswer || "").trim();
  if (!answerText) {
    showToast("Type an answer first.", "warning");
    return;
  }
  showLoader("Grading your answer with AI...");
  try {
    const gradeRaw = await callGemini(
      buildPrompt(
        `You are a strict examiner.\nQuestion: "${q.q}"\nStudent answer: "${answerText}"\nModel answer: ${q.exp || "n/a"}\nReturn ONLY JSON: {"score": 0-100, "feedback": "short comment", "correct_answer": "ideal answer"}`
      )
    );
    const grade = parseJSONResponse(gradeRaw) || { score: 0, feedback: "Could not be graded.", correct_answer: "" };
    const score = Math.max(0, Math.min(100, Number(grade.score) || 0));
    const correct = score >= 50;
    quizState.answers.push({
      qIndex: quizState.current,
      selected: null,
      correct,
      score,
      feedback: grade.feedback || "",
      correctAnswer: grade.correct_answer || "",
      answerText,
    });
    if (!correct) addMistake(q, null, answerText);
    quizState.revealed = true;
    renderQuestion();
  } catch (err) {
    showToast(`Grading failed: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

function addMistake(q, selected, answerText) {
  appState.mistakeJournal.push({
    id: generateId(),
    question: q.q,
    options: q.options,
    ans: q.ans,
    explanation: q.exp || q.explanation || "",
    correctAnswer: q.options[q.ans] || "",
    userAnswer: answerText != null ? answerText : selected != null ? q.options[selected] : "No answer",
    topic: q.topicTag || (quizState && quizState.config.topic) || "General",
    date: Date.now(),
    corrected: false,
  });
  addWeakTopic(q.topicTag || (quizState && quizState.config.topic));
  saveState();
}

function addWeakTopic(topic) {
  if (!topic) return;
  const existing = appState.weakTopics.find((t) => (t.topic || t.name) === topic);
  if (existing) existing.count = (existing.count || 1) + 1;
  else appState.weakTopics.push({ topic, count: 1 });
}

function nextQuestion() {
  if (!quizState) return;
  quizState.current += 1;
  quizState.selected = null;
  quizState.revealed = false;
  quizState.hintText = "";
  if (quizState.current >= quizState.questions.length) {
    finishQuiz();
  } else {
    renderQuestion();
  }
}

function forceSubmitOnTimeout() {
  if (!quizState || quizState.revealed) return;
  // Total-quiz timer: when time expires, submit every remaining question
  // (including the current one) as wrong and finish the quiz.
  while (quizState.current < quizState.questions.length) {
    const q = quizState.questions[quizState.current];
    if (q.type === "fr") {
      quizState.answers.push({ qIndex: quizState.current, selected: null, correct: false, score: 0, feedback: "Time ran out.", answerText: "" });
    } else {
      quizState.answers.push({ qIndex: quizState.current, selected: null, correct: false });
    }
    addMistake(q, null, "No answer (timeout)");
    quizState.current += 1;
  }
  finishQuiz();
}

async function useHint() {
  if (!quizState || quizState.revealed) return;
  showLoader("Thinking of a hint...");
  try {
    const q = quizState.questions[quizState.current];
    const hint = await callGemini(
      buildPrompt(`Give a short, helpful hint (1-2 sentences) for this question without revealing the answer directly:\n"${q.q}"`)
    );
    quizState.hintText = hint.trim();
    quizState.hintsUsed += 1;
    renderQuestion();
  } catch (err) {
    showToast(`Hint failed: ${err.message}`, "error");
  } finally {
    hideLoader();
  }
}

// ============================================
// Finish & results
// ============================================

function computeXP(score, total, config) {
  const difficultyMult = DIFFICULTY_MULT[config.difficulty.toLowerCase()] || 1;
  const modeMult = MODE_MULT[config.mode.toLowerCase()] || 1;
  return Math.max(1, Math.round(score * 10 * difficultyMult * modeMult));
}

function finishQuiz() {
  clearTimer();
  disableKeyboard();
  const { questions, answers, config } = quizState;
  const total = questions.length;
  const elapsedSec = Math.round((Date.now() - quizState.startTime) / 1000);

  let score;
  let accuracy;
  if (config.mode === "Full-Length") {
    const avg = answers.length ? answers.reduce((s, a) => s + (a.score || 0), 0) / answers.length : 0;
    accuracy = Math.round(avg);
    score = Math.round((accuracy / 100) * total);
  } else {
    score = answers.filter((a) => a.correct).length;
    accuracy = total ? Math.round((score / total) * 100) : 0;
  }

  const xp = computeXP(score, total, config);
  addXP(xp, `Quiz · ${sourceLabel(config)}`);
  completeChallenge("quiz");

  appState.history.push({
    id: generateId(),
    topic: sourceLabel(config),
    difficulty: config.difficulty,
    mode: config.mode,
    language: config.language,
    date: Date.now(),
    score,
    total,
    accuracy,
    time: elapsedSec,
    xp,
  });
  saveState();

  if (config.source === "material" && config.materialId) {
    trackUsage(config.materialId, "quizzes");
  }

  quizState.result = { score, total, accuracy, time: elapsedSec, xp };
  renderResults();
  mascot.react(accuracy >= 80 ? "quiz-pass" : "quiz-fail");
}

function renderResults() {
  const view = document.getElementById("view-quiz");
  if (!view || !quizState) return;
  const { result, questions, answers, config } = quizState;
  const wrong = answers.filter((a) => !a.correct);

  view.innerHTML = `
    <div class="quiz-result">
      <h2 style="margin-bottom:6px;">Quiz Complete!</h2>
      <p class="card-subtitle">${escapeHTML(sourceLabel(config))} · ${escapeHTML(config.mode)} · ${escapeHTML(config.difficulty)}</p>
      <div class="score-circle" style="--score:${result.accuracy};"><span>${result.accuracy}%</span></div>
      <div style="display:flex;gap:24px;justify-content:center;flex-wrap:wrap;margin-bottom:20px;">
        <div class="stat-card"><span class="stat-value">${result.score}/${result.total}</span><span class="stat-label">Score</span></div>
        <div class="stat-card"><span class="stat-value">${result.time}s</span><span class="stat-label">Time</span></div>
        <div class="stat-card"><span class="stat-value">+${result.xp} XP</span><span class="stat-label">Earned</span></div>
        ${quizState.hintsUsed ? `<div class="stat-card"><span class="stat-value">${quizState.hintsUsed}</span><span class="stat-label">Hints Used</span></div>` : ""}
      </div>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap;margin-bottom:24px;">
        ${config.mode === "Endless" ? `<button class="btn btn-primary" id="endlessMoreBtn"><i class="fa-solid fa-plus"></i> Generate 5 more?</button>` : ""}
        <button class="btn btn-primary" id="retakeBtn"><i class="fa-solid fa-rotate-right"></i> Retake</button>
        <button class="btn btn-ghost" id="newQuizBtn"><i class="fa-solid fa-plus"></i> New Quiz</button>
        ${wrong.length ? `<button class="btn btn-warning" id="journalBtn"><i class="fa-solid fa-book-open"></i> Save to Journal</button>` : ""}
      </div>
      ${breakdownHTML(questions, answers)}
    </div>
  `;

  view.querySelector("#retakeBtn").addEventListener("click", retakeQuiz);
  view.querySelector("#newQuizBtn").addEventListener("click", () => {
    clearQuiz();
    renderQuiz();
  });
  const journalBtn = view.querySelector("#journalBtn");
  if (journalBtn) {
    journalBtn.addEventListener("click", () => {
      showToast(`Saved ${wrong.length} mistake${wrong.length > 1 ? "s" : ""} to your journal.`, "success");
      window.nav("mistakes");
    });
  }
  const endlessBtn = view.querySelector("#endlessMoreBtn");
  if (endlessBtn) endlessBtn.addEventListener("click", continueEndless);
}

function retakeQuiz() {
  if (!quizState) return;
  startQuiz(shuffleArray(quizState.questions), quizState.config);
}

async function continueEndless() {
  if (!quizState || endlessGenerating) return;
  endlessGenerating = true;
  showLoader("Generating 5 more questions...");
  try {
    const more = await generateQuiz({ ...quizState.config, count: 5 });
    hideLoader();
    quizState.questions = quizState.questions.concat(more);
    quizState.answers = [];
    quizState.current = 0;
    quizState.selected = null;
    quizState.revealed = false;
    quizState.hintText = "";
    quizState.startTime = Date.now();
    quizState.timeBonus = 0;
    renderQuestion();
  } catch (err) {
    hideLoader();
    showToast(err.message || "Failed to generate more questions.", "error");
  } finally {
    endlessGenerating = false;
  }
}

function breakdownHTML(questions, answers) {
  return `<div class="view-section">
    <div class="view-heading"><h2>Review</h2></div>
    <div style="display:flex;flex-direction:column;gap:10px;">
      ${questions
        .map((q, i) => {
          const a = answers.find((x) => x.qIndex === i);
          const isFR = q.type === "fr";
          const good = a ? (isFR ? (a.score || 0) >= 50 : a.correct === true) : false;
          const status = a ? (good ? "badge-success Correct" : "badge-danger Incorrect") : "badge-warning Skipped";
          return `<div class="card review-card">
            <div style="display:flex;justify-content:space-between;gap:10px;align-items:flex-start;">
              <strong style="flex:1;">Q${i + 1}. ${escapeHTML(q.q)}</strong>
              <span class="badge ${status}"></span>
            </div>
            ${!isFR && q.options.length ? `<p style="margin-top:6px;font-size:.85rem;color:var(--text-muted);">Answer: ${escapeHTML(q.options[q.ans] || "")}${a && !good && a.selected != null ? ` · You chose: ${escapeHTML(q.options[a.selected] || "")}` : ""}</p>` : ""}
            ${isFR && a ? `<p style="margin-top:6px;font-size:.85rem;color:var(--text-muted);">Score ${a.score}% · ${escapeHTML(a.feedback || "")}</p>` : ""}
            ${q.exp ? `<p style="margin-top:4px;font-size:.82rem;">💡 ${escapeHTML(q.exp)}</p>` : ""}
          </div>`;
        })
        .join("")}
    </div>
  </div>`;
}

export {
  renderQuiz,
  generateQuiz,
  startQuiz,
  clearQuiz,
  buildQuizPrompt,
  validateQuestions,
  computeXP,
  finishQuiz,
};
