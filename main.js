// ═══════════════════════════════════════════
// 제철만들기 — Watermelon Game Clone (Industrial Theme)
// ═══════════════════════════════════════════

const { Engine, World, Bodies, Body, Events, Composite } = Matter;

// ── Config ──────────────────────────────────
const CANVAS_W = 400;
const CANVAS_H = 600;
const WALL_THICKNESS = 20;
const DROP_COOLDOWN = 400;
const GAME_OVER_LINE = 80;

// ── Tiers (11 levels) ───────────────────────
const TIERS = [
  { name: '못',     radius: 14,  color: '#a8a8a8', edge: '#6e6e6e', score: 1 },
  { name: '볼트',   radius: 20,  color: '#c0c0c0', edge: '#808080', score: 3 },
  { name: '너트',   radius: 27,  color: '#b8860b', edge: '#8b6508', score: 6 },
  { name: '와셔',   radius: 34,  color: '#71797e', edge: '#4a5054', score: 10 },
  { name: '핀',     radius: 42,  color: '#4682b4', edge: '#2f5d80', score: 15 },
  { name: '스크루', radius: 51,  color: '#daa520', edge: '#a87e18', score: 21 },
  { name: '스프링', radius: 61,  color: '#cd853f', edge: '#9c662f', score: 28 },
  { name: '베어링', radius: 72,  color: '#708090', edge: '#4d5966', score: 36 },
  { name: '기어',   radius: 85,  color: '#b8860b', edge: '#8b6508', score: 45 },
  { name: '강봉',   radius: 100, color: '#778899', edge: '#525e6b', score: 55 },
  { name: '용광로', radius: 120, color: '#ff4500', edge: '#cc3700', score: 100 },
];

const MAX_TIER = TIERS.length - 1;

// ── State ───────────────────────────────────
let engine, world;
let canvas, ctx;
let score = 0;
let currentTier = 0;
let nextTier = 0;
let canDrop = true;
let gameOver = false;
let mouseX = CANVAS_W / 2;
let previewBody = null;
let dropLineY = 50;
let gameOverCheckTimer = null;
let initialized = false;

// ── Init ────────────────────────────────────
function init() {
  if (initialized) return;
  initialized = true;
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');

  engine = Engine.create();
  engine.gravity.y = 1;
  world = engine.world;

  createWalls();
  setupInput();
  setupCollision();

  currentTier = pickRandomTier();
  nextTier = pickRandomTier();
  updateNextPreview();
  renderEvolutionChart();

  document.getElementById('restart-btn').addEventListener('click', restart);
  requestAnimationFrame(gameLoop);
}

function pickRandomTier() {
  // Only spawn tiers 0-4 for fairness
  const weights = [0.35, 0.30, 0.20, 0.10, 0.05];
  let r = Math.random();
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

// ── Walls ───────────────────────────────────
function createWalls() {
  const opts = { isStatic: true, render: { visible: false } };
  const floor = Bodies.rectangle(CANVAS_W/2, CANVAS_H - WALL_THICKNESS/2, CANVAS_W, WALL_THICKNESS, opts);
  const leftWall = Bodies.rectangle(WALL_THICKNESS/2, CANVAS_H/2, WALL_THICKNESS, CANVAS_H, opts);
  const rightWall = Bodies.rectangle(CANVAS_W - WALL_THICKNESS/2, CANVAS_H/2, WALL_THICKNESS, CANVAS_H, opts);
  World.add(world, [floor, leftWall, rightWall]);
}

// ── Drop ────────────────────────────────────
function dropItem() {
  if (!canDrop || gameOver) return;
  const tier = TIERS[currentTier];
  const x = clamp(mouseX, WALL_THICKNESS + tier.radius, CANVAS_W - WALL_THICKNESS - tier.radius);

  const body = Bodies.circle(x, dropLineY, tier.radius, {
    restitution: 0.2,
    friction: 0.5,
    density: 0.001,
    label: 'part',
    tier: currentTier,
  });
  World.add(world, body);

  canDrop = false;
  setTimeout(() => { canDrop = true; }, DROP_COOLDOWN);

  currentTier = nextTier;
  nextTier = pickRandomTier();
  updateNextPreview();
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ── Collision / Merge ───────────────────────
function setupCollision() {
  Events.on(engine, 'collisionStart', (event) => {
    const merged = new Set();
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      if (a.label !== 'part' || b.label !== 'part') continue;
      if (merged.has(a.id) || merged.has(b.id)) continue;
      if (a.tier === b.tier && a.tier < MAX_TIER) {
        merged.add(a.id);
        merged.add(b.id);
        mergeParts(a, b);
      }
    }
  });
}

function mergeParts(a, b) {
  const newTier = a.tier + 1;
  const tierData = TIERS[newTier];
  const mx = (a.position.x + b.position.x) / 2;
  const my = (a.position.y + b.position.y) / 2;

  World.remove(world, a);
  World.remove(world, b);

  const newBody = Bodies.circle(mx, my, tierData.radius, {
    restitution: 0.2,
    friction: 0.5,
    density: 0.001,
    label: 'part',
    tier: newTier,
    justMerged: 15, // animation frames
  });
  World.add(world, newBody);

  score += tierData.score;
  updateScore();
  playMergeEffect(mx, my, newTier);
}

// ── Score / UI ──────────────────────────────
function updateScore() {
  document.getElementById('score').textContent = score;
}

function updateNextPreview() {
  const t = TIERS[nextTier];
  document.getElementById('next-preview').textContent = t.name;
}

function renderEvolutionChart() {
  const container = document.getElementById('chart-items');
  container.innerHTML = '';
  for (const t of TIERS) {
    const item = document.createElement('div');
    item.className = 'chart-item';
    item.innerHTML = `<span class="dot" style="background:${t.color}"></span>${t.name}`;
    container.appendChild(item);
  }
}

// ── Effects ─────────────────────────────────
const effects = [];

function playMergeEffect(x, y, tier) {
  effects.push({ x, y, radius: 5, maxRadius: TIERS[tier].radius + 20, alpha: 1, color: TIERS[tier].color });
}

function updateEffects() {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    e.radius += 3;
    e.alpha -= 0.06;
    if (e.alpha <= 0) effects.splice(i, 1);
  }
}

function drawEffects() {
  for (const e of effects) {
    ctx.beginPath();
    ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255,255,255,${e.alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

// ── Game Over ───────────────────────────────
function checkGameOver() {
  if (gameOver) return;
  const bodies = Composite.allBodies(world);
  for (const body of bodies) {
    if (body.label !== 'part') continue;
    // Skip items still falling from drop zone
    if (body.position.y < GAME_OVER_LINE && Math.abs(body.velocity.y) > 0.5) continue;
    if (body.position.y - TIERS[body.tier].radius < GAME_OVER_LINE) {
      triggerGameOver();
      return;
    }
  }
}

function triggerGameOver() {
  gameOver = true;
  document.getElementById('final-score').textContent = score;
  document.getElementById('game-over-overlay').classList.remove('hidden');
}

function restart() {
  // Remove all parts
  const bodies = Composite.allBodies(world);
  for (const body of bodies) {
    if (body.label === 'part') World.remove(world, body);
  }
  score = 0;
  gameOver = false;
  canDrop = true;
  effects.length = 0;
  currentTier = pickRandomTier();
  nextTier = pickRandomTier();
  updateScore();
  updateNextPreview();
  document.getElementById('game-over-overlay').classList.add('hidden');
}

// ── Input ───────────────────────────────────
function setupInput() {
  const getCanvasX = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    const scale = CANVAS_W / rect.width;
    return (clientX - rect.left) * scale;
  };

  canvas.addEventListener('mousemove', (e) => {
    mouseX = getCanvasX(e.clientX);
  });

  canvas.addEventListener('click', () => {
    dropItem();
  });

  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    mouseX = getCanvasX(e.touches[0].clientX);
  }, { passive: false });

  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (e.changedTouches.length > 0) {
      mouseX = getCanvasX(e.changedTouches[0].clientX);
    }
    dropItem();
  }, { passive: false });
}

// ── Render ──────────────────────────────────
function drawPart(body) {
  const tier = TIERS[body.tier];
  const { x, y } = body.position;
  const r = tier.radius;

  ctx.save();

  // Merge pulse animation
  if (body.justMerged && body.justMerged > 0) {
    const scale = 1 + (body.justMerged / 15) * 0.3;
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.translate(-x, -y);
    body.justMerged--;
  }

  // Main body (metallic gradient)
  const grad = ctx.createRadialGradient(x - r*0.3, y - r*0.3, r*0.1, x, y, r);
  grad.addColorStop(0, lightenColor(tier.color, 40));
  grad.addColorStop(0.7, tier.color);
  grad.addColorStop(1, tier.edge);

  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = tier.edge;
  ctx.lineWidth = 2;
  ctx.stroke();

  // Highlight
  ctx.beginPath();
  ctx.arc(x - r*0.35, y - r*0.35, r*0.25, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.25)';
  ctx.fill();

  // Name label
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = `${Math.max(9, r * 0.35)}px sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(tier.name, x, y);

  ctx.restore();
}

function drawPreview() {
  if (!canDrop || gameOver) return;
  const tier = TIERS[currentTier];
  const x = clamp(mouseX, WALL_THICKNESS + tier.radius, CANVAS_W - WALL_THICKNESS - tier.radius);

  // Preview circle (ghost)
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.beginPath();
  ctx.arc(x, dropLineY, tier.radius, 0, Math.PI * 2);
  ctx.fillStyle = tier.color;
  ctx.fill();
  ctx.strokeStyle = tier.edge;
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 4]);
  ctx.stroke();
  ctx.restore();

  // Drop guide line
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([4, 4]);
  ctx.beginPath();
  ctx.moveTo(x, dropLineY + tier.radius);
  ctx.lineTo(x, CANVAS_H - WALL_THICKNESS);
  ctx.stroke();
  ctx.restore();
}

function drawGameOverLine() {
  ctx.save();
  ctx.strokeStyle = 'rgba(233, 69, 96, 0.3)';
  ctx.lineWidth = 1;
  ctx.setLineDash([6, 4]);
  ctx.beginPath();
  ctx.moveTo(0, GAME_OVER_LINE);
  ctx.lineTo(CANVAS_W, GAME_OVER_LINE);
  ctx.stroke();
  ctx.restore();
}

function lightenColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  let r = (num >> 16) + amount;
  let g = ((num >> 8) & 0xff) + amount;
  let b = (num & 0xff) + amount;
  r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
  return `rgb(${r},${g},${b})`;
}

// ── Game Loop ───────────────────────────────
let frameCount = 0;

function gameLoop() {
  Engine.update(engine, 1000 / 60);
  updateEffects();

  // Clear
  ctx.fillStyle = '#0f3460';
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

  drawGameOverLine();

  // Draw all parts
  const bodies = Composite.allBodies(world);
  for (const body of bodies) {
    if (body.label === 'part') drawPart(body);
  }

  drawPreview();
  drawEffects();

  // Check game over every 30 frames
  frameCount++;
  if (frameCount % 30 === 0) {
    checkGameOver();
  }

  requestAnimationFrame(gameLoop);
}

// ═══════════════════════════════════════════
// Start
// ═══════════════════════════════════════════
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
