// ============================================
// QuizNova X — confetti.js
// Lightweight canvas confetti for celebrations
// ============================================

const CONFETTI_ID = "quiznova-confetti";
const COLORS = ["#6366F1", "#8B5CF6", "#22C55E", "#F59E0B", "#EF4444", "#3B82F6", "#EC4899", "#14B8A6"];

let canvas = null;
let ctx = null;
let particles = [];
let rafId = null;
let active = false;

function ensureCanvas() {
  if (canvas && document.getElementById(CONFETTI_ID)) return;
  canvas = document.getElementById(CONFETTI_ID);
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.id = CONFETTI_ID;
    canvas.style.cssText =
      "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:10000;";
    document.body.appendChild(canvas);
  }
  ctx = canvas.getContext("2d");
  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  };
  resize();
  window.addEventListener("resize", resize);
}

function spawn(count, burstX, burstY) {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const fromCenter = burstX === undefined;
  const originX = fromCenter ? w / 2 : burstX;
  const originY = fromCenter ? h * 0.35 : burstY;
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = 4 + Math.random() * 9;
    particles.push({
      x: originX,
      y: originY,
      vx: Math.cos(angle) * speed * (fromCenter ? 1 : 0.6 + Math.random() * 0.8),
      vy: Math.sin(angle) * speed - 5,
      gravity: 0.22 + Math.random() * 0.12,
      size: 6 + Math.random() * 7,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      rotation: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      shape: Math.random() > 0.5 ? "rect" : "circle",
      life: 1,
      decay: 0.008 + Math.random() * 0.008,
    });
  }
}

function frame() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  let alive = 0;
  for (const p of particles) {
    p.x += p.vx;
    p.y += p.vy;
    p.vy += p.gravity;
    p.vx *= 0.99;
    p.rotation += p.vr;
    p.life -= p.decay;
    if (p.life <= 0 || p.y > canvas.height + 30) continue;
    alive++;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rotation);
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    if (p.shape === "rect") {
      ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
    } else {
      ctx.beginPath();
      ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
  if (alive > 0) {
    rafId = requestAnimationFrame(frame);
  } else {
    active = false;
    if (canvas) ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
}

function stopConfetti() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = null;
  particles = [];
  active = false;
  if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

// ---- Fire a burst of confetti ----
function burstConfetti(count = 120, x, y) {
  try {
    ensureCanvas();
    if (!ctx) return;
    if (active && particles.length > 250) return; // avoid overloading
    spawn(count, x, y);
    if (!active) {
      active = true;
      rafId = requestAnimationFrame(frame);
    }
  } catch (err) {
    console.warn("[QuizNova] Confetti failed:", err);
  }
}

export { burstConfetti, stopConfetti };
