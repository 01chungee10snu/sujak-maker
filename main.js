// ═══════════════════════════════════════════
// 용강 만들기 — Steel Value Chain Merge Game
// ═══════════════════════════════════════════

const { Engine, World, Bodies, Body, Events, Composite, Vector } = Matter;

const GAME_DATA = window.YONGGANG_GAME_DATA;
const TIERS = GAME_DATA.tiers;
const PHYSICS_RULE = GAME_DATA.physics || { renderScale: 1 };
const RECIPE_QUIZZES = GAME_DATA.recipeQuizzes || [];
const RECIPE_RULE = GAME_DATA.recipeQuiz || { triggerEveryMerges: 4, firstTriggerMerge: 3, secondsPerCharacter: 3, correctBonusPerCharacter: 100 };
const APP_VERSION = GAME_DATA.version || 'unknown';
const UPDATE_CHECK_INTERVAL_MS = 60_000;
const MAX_TIER = TIERS.length - 1;
const CANVAS_W = 420;
const CANVAS_H = 640;
const WALL_THICKNESS = 24;
const DROP_COOLDOWN = 360;
const GAME_OVER_LINE = 92;
const SAFE_OVER_FRAMES = 90;
const DPR = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

let engine, world, canvas, ctx;
let score = 0;
let mergeCount = 0;
let maxTierReached = 0;
let currentTier = 0;
let nextTier = 0;
let canDrop = true;
let gameOver = false;
let mouseX = CANVAS_W / 2;
let dropLineY = 58;
let initialized = false;
let started = false;
let frameCount = 0;
let startedAt = Date.now();
let quizActive = false;
let activeQuiz = null;
let quizDeadline = 0;
let quizTimer = null;
let quizCorrectCount = 0;
let quizFailReason = '';
const askedQuizIndexes = new Set();
const effects = [];
const overLineFrames = new Map();
const images = {};

// ── 플레이어 정보 ──
let player = { nickname: '', employeeId: '', highScore: 0, isNew: false };
let gameStartScore = 0;

function loadStoredPlayer() {
  try {
    const stored = JSON.parse(localStorage.getItem('yonggang:player') || 'null');
    if (stored && stored.nickname && stored.employeeId) return stored;
  } catch (_) {}
  return null;
}

function savePlayer() {
  localStorage.setItem('yonggang:player', JSON.stringify({
    nickname: player.nickname,
    employeeId: player.employeeId
  }));
}

function init() {
  if (initialized && started) return;
  initialized = true;
  if (!started) {
    const overlay = document.getElementById('start-overlay');
    overlay.classList.remove('hidden');
    const hint = document.getElementById('touch-hint');
    const rules = document.getElementById('landing-rules');
    const okBtn = document.getElementById('landing-ok');
    const loginForm = document.getElementById('landing-login');
    const loginSubmit = document.getElementById('login-submit');

    hint.addEventListener('click', () => {
      hint.classList.add('hidden');
      rules.classList.remove('hidden');
    });

    okBtn.addEventListener('click', () => {
      rules.classList.add('hidden');
      // 기존 플레이어가 있으면 로그인 생략
      const stored = loadStoredPlayer();
      if (stored) {
        player.nickname = stored.nickname;
        player.employeeId = stored.employeeId;
        registerAndStart();
      } else {
        loginForm.classList.remove('hidden');
        document.getElementById('input-nickname').focus();
      }
    });

    loginForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const nickname = document.getElementById('input-nickname').value.trim();
      const employeeId = document.getElementById('input-employee-id').value.trim();
      if (!nickname || !employeeId) return;
      player.nickname = nickname;
      player.employeeId = employeeId;
      const btn = document.getElementById('login-submit');
      btn.textContent = '등록 중...';
      btn.disabled = true;
      registerAndStart();
    });

    return;
  }
  startGameCore();
}

function startGame() {
  if (started) return;
  started = true;
  document.getElementById('start-overlay').classList.add('hidden');
  if (!initialized) init();
  else startGameCore();
}

async function registerAndStart() {
  const endpoint = GAME_DATA.googleSheets.endpoint;
  const loginForm = document.getElementById('landing-login');
  const errEl = document.getElementById('login-error');

  if (endpoint) {
    try {
      const url = `${endpoint}?action=register&nickname=${encodeURIComponent(player.nickname)}&employeeId=${encodeURIComponent(player.employeeId)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.status === 'ok') {
        player.highScore = data.highScore || 0;
        player.isNew = !!data.isNew;
        savePlayer();
      } else {
        throw new Error(data.message || '등록 실패');
      }
    } catch (err) {
      // 오프라인이면 로컬로 진행
      console.warn('플레이어 등록 실패, 오프라인 모드', err);
    }
  }

  started = true;
  document.getElementById('start-overlay').classList.add('hidden');
  if (loginForm) loginForm.classList.add('hidden');
  if (errEl) errEl.classList.add('hidden');
  gameStartScore = 0;
  startGameCore();
}

function startGameCore() {
  validateTierPhysicsPolicy();
  canvas = document.getElementById('game-canvas');
  ctx = canvas.getContext('2d');
  resizeCanvasForDpr();
  loadImages();

  engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = 1.08;
  engine.positionIterations = 10;
  engine.velocityIterations = 8;
  engine.constraintIterations = 4;
  world = engine.world;

  createWalls();
  setupInput();
  setupCollision();
  setupKeyboard();
  setupRecipeQuiz();

  currentTier = pickRandomTier();
  nextTier = pickRandomTier();
  updateNextPreview();
  renderEvolutionChart();
  renderTopTierBar();
  updateDbStatus();
  setupLiveUpdateCheck();
  setupLeaderboard();

  document.getElementById('restart-btn').addEventListener('click', restart);
  requestAnimationFrame(gameLoop);
}

function resizeCanvasForDpr() {
  canvas.width = CANVAS_W * DPR;
  canvas.height = CANVAS_H * DPR;
  canvas.style.width = `${CANVAS_W}px`;
  canvas.style.height = `${CANVAS_H}px`;
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
}

function loadImages() {
  images.mascot = new Image();
  images.mascot.src = withAssetVersion('assets/generated/yonggang-mascot.png');
  images.sprites = new Image();
  images.sprites.src = withAssetVersion('assets/generated/value-chain-sprites.png');
  images.background = new Image();
  images.background.src = withAssetVersion('assets/generated/factory-background.png');
}

function withAssetVersion(path) {
  const separator = path.includes('?') ? '&' : '?';
  return `${path}${separator}v=${encodeURIComponent(APP_VERSION)}`;
}

function pickRandomTier() {
  const weights = [0.30, 0.25, 0.18, 0.12, 0.08, 0.05, 0.02];
  let r = Math.random();
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return 0;
}

function createWalls() {
  const opts = { isStatic: true, render: { visible: false }, friction: 0.9 };
  const floor = Bodies.rectangle(CANVAS_W / 2, CANVAS_H - WALL_THICKNESS / 2, CANVAS_W, WALL_THICKNESS, opts);
  const leftWall = Bodies.rectangle(WALL_THICKNESS / 2, CANVAS_H / 2, WALL_THICKNESS, CANVAS_H, opts);
  const rightWall = Bodies.rectangle(CANVAS_W - WALL_THICKNESS / 2, CANVAS_H / 2, WALL_THICKNESS, CANVAS_H, opts);
  const leftSlope = Bodies.rectangle(34, CANVAS_H - 52, 78, 12, { ...opts, angle: Math.PI * 0.12 });
  const rightSlope = Bodies.rectangle(CANVAS_W - 34, CANVAS_H - 52, 78, 12, { ...opts, angle: -Math.PI * 0.12 });
  World.add(world, [floor, leftWall, rightWall, leftSlope, rightSlope]);
}

function createPart(x, y, tierIndex, extra = {}) {
  const tier = TIERS[tierIndex];
  const collisionRadius = tier.radius;
  const body = Bodies.circle(x, y, collisionRadius, {
    restitution: tier.restitution,
    friction: tier.friction,
    frictionStatic: 0.82,
    frictionAir: 0.012,
    density: tier.density,
    slop: 0.015,
    label: 'part',
    tier: tierIndex,
    collisionRadius,
    renderRadius: collisionRadius * (PHYSICS_RULE.renderScale || 1),
    spawnFrame: frameCount,
    justMerged: extra.justMerged || 0,
    renderAngle: Math.random() * Math.PI * 2
  });
  Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.04);
  return body;
}

function validateTierPhysicsPolicy() {
  for (let i = 1; i < TIERS.length; i++) {
    const prev = TIERS[i - 1];
    const tier = TIERS[i];
    if (!(tier.radius > prev.radius)) {
      throw new Error(`tier radius must strictly increase: ${prev.id}=${prev.radius}, ${tier.id}=${tier.radius}`);
    }
    const prevNominalMass = Math.PI * prev.radius * prev.radius * prev.density;
    const nominalMass = Math.PI * tier.radius * tier.radius * tier.density;
    if (!(nominalMass > prevNominalMass)) {
      throw new Error(`tier nominal mass must strictly increase: ${prev.id}=${prevNominalMass.toFixed(4)}, ${tier.id}=${nominalMass.toFixed(4)}`);
    }
    if (!(tier.density >= prev.density * 0.75)) {
      throw new Error(`tier density dropped too sharply: ${prev.id}=${prev.density}, ${tier.id}=${tier.density}`);
    }
  }
}

function dropItem() {
  if (!canDrop || gameOver || quizActive) return;
  const tier = TIERS[currentTier];
  const x = clamp(mouseX, WALL_THICKNESS + tier.radius, CANVAS_W - WALL_THICKNESS - tier.radius);
  const body = createPart(x, dropLineY, currentTier);
  Body.setVelocity(body, { x: (Math.random() - 0.5) * 0.25, y: 1.0 });
  World.add(world, body);

  canDrop = false;
  setTimeout(() => { canDrop = true; }, DROP_COOLDOWN);
  currentTier = nextTier;
  nextTier = pickRandomTier();
  updateNextPreview();
}

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
  const mid = Vector.mult(Vector.add(a.position, b.position), 0.5);
  const velocity = Vector.mult(Vector.add(a.velocity, b.velocity), 0.35);

  World.remove(world, [a, b]);
  const newBody = createPart(mid.x, mid.y, newTier, { justMerged: 18 });
  Body.setVelocity(newBody, velocity);
  Body.applyForce(newBody, newBody.position, { x: 0, y: -0.018 * newBody.mass });
  World.add(world, newBody);

  score += tierData.score;
  mergeCount += 1;
  maxTierReached = Math.max(maxTierReached, newTier);
  updateScore();
  playMergeEffect(mid.x, mid.y, newTier);
  if (newTier === MAX_TIER) playYonggangBurst(mid.x, mid.y);
  if (shouldTriggerRecipeQuiz()) setTimeout(startRecipeQuiz, 180);
}

function setupRecipeQuiz() {
  const form = document.getElementById('recipe-quiz-card');
  if (!form) return;
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    submitRecipeQuiz();
  });
}

function shouldTriggerRecipeQuiz() {
  if (quizActive || gameOver || RECIPE_QUIZZES.length === 0) return false;
  const first = RECIPE_RULE.firstTriggerMerge || 3;
  const every = RECIPE_RULE.triggerEveryMerges || 4;
  return mergeCount >= first && (mergeCount - first) % every === 0;
}

function pickRecipeQuiz() {
  if (askedQuizIndexes.size >= RECIPE_QUIZZES.length) askedQuizIndexes.clear();
  const available = [];
  for (let i = 0; i < RECIPE_QUIZZES.length; i++) {
    if (!askedQuizIndexes.has(i)) available.push(i);
  }
  if (available.length === 0) {
    askedQuizIndexes.clear();
    for (let i = 0; i < RECIPE_QUIZZES.length; i++) available.push(i);
  }
  const index = available[Math.floor(Math.random() * available.length)];
  askedQuizIndexes.add(index);
  return { ...RECIPE_QUIZZES[index], index };
}

function answerCharCount(answer) {
  return [...String(answer || '').replace(/\s/g, '')].length;
}

function normalizeAnswer(value) {
  return String(value || '').trim().replace(/\s/g, '').toLocaleLowerCase('ko-KR');
}

function startRecipeQuiz() {
  if (quizActive || gameOver) return;
  activeQuiz = pickRecipeQuiz();
  const charCount = answerCharCount(activeQuiz.answer);
  const seconds = activeQuiz.timeLimitSeconds || charCount * (RECIPE_RULE.secondsPerCharacter || 3);
  activeQuiz.timeLimitSeconds = seconds;
  quizActive = true;
  canDrop = false;
  quizDeadline = performance.now() + seconds * 1000;

  const overlay = document.getElementById('recipe-quiz-overlay');
  const prompt = document.getElementById('recipe-quiz-prompt');
  const input = document.getElementById('recipe-quiz-input');
  const help = document.getElementById('recipe-quiz-help');
  const status = document.getElementById('recipe-quiz-status');
  prompt.textContent = activeQuiz.prompt;
  input.value = '';
  input.maxLength = Math.max(8, charCount + 4);
  help.textContent = `정답 ${charCount}글자 × 3초 = ${seconds}초`;
  status.textContent = '오답 또는 시간초과 시 GAME OVER DEAD';
  overlay.classList.remove('hidden');
  input.focus();
  updateRecipeTimer();
  clearInterval(quizTimer);
  quizTimer = setInterval(updateRecipeTimer, 100);
}

function updateRecipeTimer() {
  if (!quizActive || !activeQuiz) return;
  const remainingMs = Math.max(0, quizDeadline - performance.now());
  const remainingSeconds = remainingMs / 1000;
  const total = activeQuiz.timeLimitSeconds || 1;
  const ratio = Math.max(0, Math.min(1, remainingSeconds / total));
  document.getElementById('recipe-quiz-countdown').textContent = `${remainingSeconds.toFixed(1)}초`;
  document.querySelector('#recipe-quiz-timer span').style.transform = `scaleX(${ratio})`;
  if (remainingMs <= 0) failRecipeQuiz('timeout');
}

function submitRecipeQuiz() {
  if (!quizActive || !activeQuiz) return;
  const input = document.getElementById('recipe-quiz-input');
  const actual = normalizeAnswer(input.value);
  const expected = normalizeAnswer(activeQuiz.answer);
  if (actual !== expected) {
    failRecipeQuiz('wrong-answer');
    return;
  }
  clearRecipeQuizTimer();
  quizCorrectCount += 1;
  const bonus = answerCharCount(activeQuiz.answer) * (RECIPE_RULE.correctBonusPerCharacter || 100);
  score += bonus;
  updateScore();
  document.getElementById('recipe-quiz-overlay').classList.add('hidden');
  activeQuiz = null;
  quizActive = false;
  canDrop = true;
}

function failRecipeQuiz(reason) {
  if (!quizActive && gameOver) return;
  quizFailReason = reason;
  clearRecipeQuizTimer();
  document.getElementById('recipe-quiz-status').textContent = reason === 'timeout' ? '시간초과: GAME OVER DEAD' : '오답: GAME OVER DEAD';
  triggerGameOver('quiz-dead');
}

function clearRecipeQuizTimer() {
  clearInterval(quizTimer);
  quizTimer = null;
}

function updateScore() {
  document.getElementById('score').textContent = score.toLocaleString('ko-KR');
}

function updateNextPreview() {
  const box = document.getElementById('next-box');
  if (box) box.classList.add('hidden');
}

function renderTopTierBar() {
  const bar = document.getElementById('tier-bar');
  if (!bar) return;
  bar.innerHTML = '';
  TIERS.forEach((_, i) => {
    const pip = document.createElement('div');
    pip.className = `tier-pip ${i <= maxTierReached ? 'active' : ''}`;
    pip.title = TIERS[i].name;
    bar.appendChild(pip);
  });
}

function setupInfoPanel() {
  const btn = document.getElementById('info-btn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    // info panel removed; no-op until dedicated modal is added
  });
}

const ORB_ICONS = [
  'assets/generated/components-orb/01-iron-ore-orb.png',
  'assets/generated/components-orb/02-coal-orb.png',
  'assets/generated/components-orb/03-coke-orb.png',
  'assets/generated/components-orb/04-blast-furnace-orb.png',
  'assets/generated/components-orb/05-pig-iron-ladle-orb.png',
  'assets/generated/components-orb/06-steelmaking-converter-orb.png',
  'assets/generated/components-orb/07-casting-slab-orb.png',
  'assets/generated/components-orb/08-hot-rolled-coil-orb.png',
  'assets/generated/components-orb/09-cold-rolled-auto-sheet-orb.png',
  'assets/generated/components-orb/10-heavy-plate-orb.png',
  'assets/generated/components-orb/11-long-special-products-orb.png',
  'assets/generated/components-orb/12-yonggang-final-orb.png'
];

function renderEvolutionChart() {
  const container = document.getElementById('flow-items');
  if (!container) return;
  container.innerHTML = '';
  TIERS.forEach((t, i) => {
    const orb = document.createElement('img');
    orb.className = 'flow-orb';
    orb.src = withAssetVersion(ORB_ICONS[i]);
    orb.alt = t.name;
    orb.addEventListener('click', () => openFlowDetail(t));
    container.appendChild(orb);
  });
}

function openFlowDetail(tier) {
  const existing = document.getElementById('flow-detail-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.id = 'flow-detail-overlay';
  overlay.className = 'overlay';
  overlay.innerHTML = `
    <div class="flow-detail-card">
      <h2>${tier.name}</h2>
      <p class="flow-detail-stage">${tier.stage}</p>
      <p>${tier.desc}</p>
      <p class="small">${tier.detailDesc || ''}</p>
      ${tier.wikiLink ? `<a class="flow-detail-link" href="${tier.wikiLink}" target="_blank" rel="noopener">위키백과/나무위키에서 더보기</a>` : ''}
      <button type="button" data-close>닫기</button>
    </div>
  `;
  document.body.appendChild(overlay);
  overlay.addEventListener('click', (ev) => {
    if (ev.target.matches('[data-close]') || ev.target === overlay) overlay.remove();
  });
}

function updateDbStatus() {
  const el = document.getElementById('db-status');
  if (!el) return;
  const endpoint = GAME_DATA.googleSheets.endpoint;
  el.textContent = endpoint ? 'Google Sheets 연결 준비 완료' : '로컬 기록 우선, Sheets endpoint 주입 대기';
  updateVersionStatus('최신 데이터 확인 중');
}

function updateVersionStatus(message) {
  const el = document.getElementById('app-version-status');
  if (!el) return;
  el.textContent = `APP ${APP_VERSION} · ${message}`;
}

function extractDataVersion(scriptText) {
  const match = scriptText.match(/version:\s*['"]([^'"]+)['"]/);
  return match ? match[1] : '';
}

async function clearBrowserCaches() {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations();
    await Promise.all(registrations.map((registration) => registration.unregister()));
  }
  if ('caches' in window) {
    const keys = await caches.keys();
    await Promise.all(keys.map((key) => caches.delete(key)));
  }
}

function reloadWithFreshUrl(nextVersion) {
  const url = new URL(window.location.href);
  url.searchParams.set('v', nextVersion);
  url.searchParams.set('t', Date.now().toString());
  window.location.replace(url.toString());
}

async function checkForAppUpdate() {
  try {
    const response = await fetch(`data/game-data.js?update-check=${Date.now()}`, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const latestVersion = extractDataVersion(await response.text());
    if (!latestVersion) throw new Error('version field not found');
    if (latestVersion !== APP_VERSION) {
      updateVersionStatus(`새 버전 ${latestVersion} 발견, 자동 갱신 중`);
      await clearBrowserCaches();
      reloadWithFreshUrl(latestVersion);
      return;
    }
    updateVersionStatus('최신 데이터 적용됨');
  } catch (error) {
    console.warn('업데이트 확인 실패', error);
    updateVersionStatus('업데이트 확인 실패, 다음 주기에 재시도');
  }
}

function setupLiveUpdateCheck() {
  updateVersionStatus('최신 데이터 확인 중');
  checkForAppUpdate();
  window.setInterval(checkForAppUpdate, UPDATE_CHECK_INTERVAL_MS);
}

async function recordGameResult() {
  const payload = {
    action: 'recordResult',
    timestamp: new Date().toISOString(),
    nickname: player.nickname || 'local-player',
    employeeId: player.employeeId || '',
    startScore: gameStartScore,
    endScore: score,
    maxTier: TIERS[maxTierReached].name,
    durationMs: Date.now() - startedAt,
    mergeCount,
    quizCorrectCount,
    quizFailReason
  };
  localStorage.setItem('yonggang:lastResult', JSON.stringify(payload));
  const endpoint = GAME_DATA.googleSheets.endpoint;

  if (!endpoint) return { mode: 'local', payload };

  try {
    await fetch(endpoint, {
      method: 'POST',
      mode: 'no-cors',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    // no-cors 모드에서는 응답 본문을 읽을 수 없으므로 로컬 비교로 하이스코어 표시
    showHighScoreInfo();
    return { mode: 'sheets', payload };
  } catch (error) {
    console.warn('Sheets 기록 실패, localStorage fallback 사용', error);
    return { mode: 'local-fallback', payload };
  }
}

function showHighScoreInfo() {
  const el = document.getElementById('highscore-info');
  if (!el) return;
  const prevHigh = player.highScore;
  if (score > prevHigh) {
    el.textContent = `🏆 신기록! (이전 최고: ${prevHigh.toLocaleString('ko-KR')})`;
    player.highScore = score;
  } else {
    el.textContent = `최고 점수: ${prevHigh.toLocaleString('ko-KR')}`;
  }
  el.classList.remove('hidden');
}

function playMergeEffect(x, y, tier) {
  const data = TIERS[tier];
  effects.push({ type: 'ring', x, y, radius: 5, maxRadius: data.radius + 28, alpha: 1, color: data.color });
  for (let i = 0; i < 8; i++) {
    effects.push({ type: 'spark', x, y, vx: Math.cos(i * Math.PI / 4) * 2.2, vy: Math.sin(i * Math.PI / 4) * 2.2, life: 24, color: data.color });
  }
}

function playYonggangBurst(x, y) {
  for (let i = 0; i < 24; i++) {
    effects.push({ type: 'spark', x, y, vx: Math.cos(i * Math.PI / 12) * 4, vy: Math.sin(i * Math.PI / 12) * 4, life: 42, color: i % 2 ? '#ffbd3f' : '#18347a' });
  }
}

function updateEffects() {
  for (let i = effects.length - 1; i >= 0; i--) {
    const e = effects[i];
    if (e.type === 'ring') {
      e.radius += 3.5;
      e.alpha -= 0.055;
      if (e.alpha <= 0) effects.splice(i, 1);
    } else {
      e.x += e.vx;
      e.y += e.vy;
      e.vy += 0.08;
      e.life -= 1;
      if (e.life <= 0) effects.splice(i, 1);
    }
  }
}

function drawEffects() {
  for (const e of effects) {
    ctx.save();
    if (e.type === 'ring') {
      ctx.globalAlpha = e.alpha;
      ctx.beginPath();
      ctx.arc(e.x, e.y, e.radius, 0, Math.PI * 2);
      ctx.strokeStyle = e.color;
      ctx.lineWidth = 3;
      ctx.stroke();
    } else {
      ctx.globalAlpha = Math.max(0, e.life / 42);
      ctx.fillStyle = e.color;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

function checkGameOver() {
  if (gameOver || quizActive) return;
  const bodies = Composite.allBodies(world);
  for (const body of bodies) {
    if (body.label !== 'part') continue;
    if (frameCount - body.spawnFrame < 120) continue;
    if (Math.abs(body.velocity.y) > 0.22 || Math.abs(body.velocity.x) > 0.28) {
      overLineFrames.delete(body.id);
      continue;
    }
    const over = body.position.y - (body.collisionRadius || TIERS[body.tier].radius) < GAME_OVER_LINE;
    if (!over) {
      overLineFrames.delete(body.id);
      continue;
    }
    const count = (overLineFrames.get(body.id) || 0) + 1;
    overLineFrames.set(body.id, count);
    if (count > SAFE_OVER_FRAMES) {
      triggerGameOver();
      return;
    }
  }
}

async function triggerGameOver(reason = 'overline') {
  gameOver = true;
  quizActive = false;
  clearRecipeQuizTimer();
  document.getElementById('recipe-quiz-overlay').classList.add('hidden');
  const isQuizDead = reason === 'quiz-dead';
  document.getElementById('game-over-title').textContent = isQuizDead ? (RECIPE_RULE.failTitle || 'GAME OVER DEAD') : '공정 과밀';
  document.getElementById('game-over-message').textContent = isQuizDead ? (RECIPE_RULE.failMessage || '제철 레시피 입력퀴즈 실패.') : '용강까지 이어지는 흐름을 다시 설계하십시오.';
  document.getElementById('final-score').textContent = score.toLocaleString('ko-KR');
  // 게임 오버 시 출제된 레시피 전체 문구 표시
  const recipeEl = document.getElementById('game-over-recipe');
  const recipeTextEl = document.getElementById('game-over-recipe-text');
  if (isQuizDead && activeQuiz) {
    const fullText = activeQuiz.prompt.replace(/_+/g, activeQuiz.answer);
    recipeTextEl.textContent = fullText;
    recipeEl.classList.remove('hidden');
  } else {
    recipeEl.classList.add('hidden');
  }
  activeQuiz = null;
  document.getElementById('game-over-overlay').classList.remove('hidden');
  const result = await recordGameResult();
  const el = document.getElementById('db-status');
  el.textContent = result.mode === 'sheets' ? 'Google Sheets 기록 요청 완료' : '결과를 로컬 저장소에 기록함';
  fetchLeaderboard();
}

function restart() {
  const bodies = Composite.allBodies(world);
  for (const body of bodies) if (body.label === 'part') World.remove(world, body);
  score = 0;
  mergeCount = 0;
  maxTierReached = 0;
  gameOver = false;
  quizActive = false;
  activeQuiz = null;
  quizCorrectCount = 0;
  quizFailReason = '';
  askedQuizIndexes.clear();
  clearRecipeQuizTimer();
  canDrop = true;
  frameCount = 0;
  startedAt = Date.now();
  effects.length = 0;
  overLineFrames.clear();
  currentTier = pickRandomTier();
  nextTier = pickRandomTier();
  updateScore();
  updateNextPreview();
  renderTopTierBar();
  updateDbStatus();
  document.getElementById('recipe-quiz-overlay').classList.add('hidden');
  document.getElementById('game-over-title').textContent = '공정 과밀';
  document.getElementById('game-over-message').textContent = '용강까지 이어지는 흐름을 다시 설계하십시오.';
  document.getElementById('game-over-overlay').classList.add('hidden');
  const hsEl = document.getElementById('highscore-info');
  if (hsEl) hsEl.classList.add('hidden');
  gameStartScore = 0;
}

// ── 리더보드 ──
let leaderboardCache = [];

function setupLeaderboard() {
  const btn = document.getElementById('leaderboard-btn');
  const overlay = document.getElementById('leaderboard-overlay');
  const closeBtn = document.getElementById('leaderboard-close');
  if (btn) btn.addEventListener('click', () => { overlay.classList.remove('hidden'); fetchLeaderboard(); });
  if (closeBtn) closeBtn.addEventListener('click', () => overlay.classList.add('hidden'));
  fetchLeaderboard();
}

async function fetchLeaderboard() {
  const endpoint = GAME_DATA.googleSheets.endpoint;
  const list = document.getElementById('leaderboard-list');
  const empty = document.getElementById('leaderboard-empty');
  if (!endpoint || !list) return;

  try {
    const res = await fetch(`${endpoint}?action=leaderboard`);
    const data = await res.json();
    if (data.status !== 'ok') throw new Error('leaderboard fail');
    leaderboardCache = data.leaderboard || [];
    renderLeaderboard();
  } catch (err) {
    console.warn('리더보드 불러오기 실패', err);
  }
}

function renderLeaderboard() {
  const list = document.getElementById('leaderboard-list');
  const empty = document.getElementById('leaderboard-empty');
  if (!list) return;
  list.innerHTML = '';

  if (leaderboardCache.length === 0) {
    if (empty) empty.classList.remove('hidden');
    return;
  }
  if (empty) empty.classList.add('hidden');

  for (const entry of leaderboardCache) {
    const li = document.createElement('li');
    if (entry.nickname === player.nickname && String(entry.employeeId) === String(player.employeeId)) {
      li.classList.add('me');
    }
    const nameSpan = document.createElement('span');
    nameSpan.className = 'lb-name';
    nameSpan.textContent = entry.nickname;
    const scoreSpan = document.createElement('span');
    scoreSpan.className = 'lb-score';
    scoreSpan.textContent = (entry.highScore || 0).toLocaleString('ko-KR');
    li.appendChild(nameSpan);
    li.appendChild(scoreSpan);
    list.appendChild(li);
  }
}

function setupInput() {
  const getCanvasX = (clientX) => {
    const rect = canvas.getBoundingClientRect();
    const scale = CANVAS_W / rect.width;
    return (clientX - rect.left) * scale;
  };
  canvas.addEventListener('mousemove', (e) => { mouseX = getCanvasX(e.clientX); });
  canvas.addEventListener('click', dropItem);
  canvas.addEventListener('touchmove', (e) => {
    e.preventDefault();
    mouseX = getCanvasX(e.touches[0].clientX);
  }, { passive: false });
  canvas.addEventListener('touchend', (e) => {
    e.preventDefault();
    if (e.changedTouches.length > 0) mouseX = getCanvasX(e.changedTouches[0].clientX);
    dropItem();
  }, { passive: false });
}

function setupKeyboard() {
  window.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowLeft') mouseX = clamp(mouseX - 18, 0, CANVAS_W);
    if (e.key === 'ArrowRight') mouseX = clamp(mouseX + 18, 0, CANVAS_W);
    if (e.key === ' ' || e.key === 'Enter') dropItem();
  });
}

function drawBackground() {
  if (images.background && images.background.complete && images.background.naturalWidth) {
    ctx.drawImage(images.background, 0, 0, CANVAS_W, CANVAS_H);
    ctx.fillStyle = 'rgba(9, 18, 36, 0.42)';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
    grad.addColorStop(0, '#09172e');
    grad.addColorStop(0.55, '#13294a');
    grad.addColorStop(1, '#2e1d18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
  }
  ctx.fillStyle = 'rgba(255, 177, 59, 0.08)';
  ctx.fillRect(0, CANVAS_H - 118, CANVAS_W, 118);
}

function drawPart(body) {
  const tier = TIERS[body.tier];
  const { x, y } = body.position;
  const r = body.renderRadius || tier.radius;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(body.angle * 0.3 + body.renderAngle * 0.06);

  if (body.justMerged && body.justMerged > 0) {
    const scale = 1 + (body.justMerged / 18) * 0.25;
    ctx.scale(scale, scale);
    body.justMerged--;
  }

  if (drawTierSprite(body.tier, r)) {
    ctx.restore();
    return;
  }

  drawIndustrialShape(tier, r);
  ctx.restore();
}

function drawTierSprite(tierIndex, r) {
  if (!images.sprites || !images.sprites.complete || !images.sprites.naturalWidth) return false;
  const cols = 4;
  const rows = 3;
  const cellW = images.sprites.naturalWidth / cols;
  const cellH = images.sprites.naturalHeight / rows;
  const col = tierIndex % cols;
  const row = Math.floor(tierIndex / cols);

  // Circular clipping so square sprite cells render as orbs
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.clip();

  const pad = r * 0.06;
  ctx.drawImage(
    images.sprites,
    col * cellW,
    row * cellH,
    cellW,
    cellH,
    -r - pad,
    -r - pad,
    r * 2 + pad * 2,
    r * 2 + pad * 2
  );
  ctx.restore();

  // Glossy rim for 3D orb definition
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.18)';
  ctx.lineWidth = Math.max(1, r * 0.035);
  ctx.beginPath();
  ctx.arc(0, 0, r - 1, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();

  return true;
}

function drawIndustrialShape(tier, r) {
  // All tiers render as 3D sphere/orb with gradient + highlight
  const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.38, r * 0.08, 0, 0, r);
  grad.addColorStop(0, lightenColor(tier.color, 48));
  grad.addColorStop(0.68, tier.color);
  grad.addColorStop(1, tier.edge);
  ctx.fillStyle = grad;
  ctx.strokeStyle = tier.edge;
  ctx.lineWidth = Math.max(2, r * 0.055);

  // Always draw circle (orb shape)
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();

  // 3D specular highlight (top-left gloss)
  const hgrad = ctx.createRadialGradient(-r * 0.38, -r * 0.42, r * 0.02, -r * 0.38, -r * 0.42, r * 0.5);
  hgrad.addColorStop(0, 'rgba(255,255,255,0.42)');
  hgrad.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = hgrad;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, Math.PI * 2);
  ctx.fill();

  // Inner highlight dot
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.arc(-r * 0.35, -r * 0.38, r * 0.12, 0, Math.PI * 2);
  ctx.fill();

  // Rim light (bottom-right subtle glow)
  ctx.strokeStyle = lightenColor(tier.color, 30);
  ctx.lineWidth = Math.max(1, r * 0.03);
  ctx.beginPath();
  ctx.arc(0, 0, r - ctx.lineWidth, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // Icon
  ctx.fillStyle = '#fff8e8';
  ctx.font = `800 ${Math.max(13, r * 0.38)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,.38)';
  ctx.shadowBlur = 3;
  ctx.fillText(tier.icon, 0, -r * 0.10);
  // Name
  ctx.font = `700 ${Math.max(9, r * 0.17)}px system-ui, sans-serif`;
  ctx.fillText(tier.name, 0, r * 0.45);
  ctx.shadowBlur = 0;
}

function drawPreview() {
  if (!canDrop || gameOver) return;
  const tier = TIERS[currentTier];
  const x = clamp(mouseX, WALL_THICKNESS + tier.radius, CANVAS_W - WALL_THICKNESS - tier.radius);
  ctx.save();
  ctx.globalAlpha = 0.55;
  ctx.translate(x, dropLineY);
  if (!drawTierSprite(currentTier, tier.radius)) drawIndustrialShape(tier, tier.radius);
  ctx.restore();

  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 6]);
  ctx.beginPath();
  ctx.moveTo(x, dropLineY + tier.radius);
  ctx.lineTo(x, CANVAS_H - WALL_THICKNESS);
  ctx.stroke();
  ctx.restore();
}

function drawGameOverLine() {
  ctx.save();
  ctx.strokeStyle = 'rgba(255, 98, 67, 0.65)';
  ctx.lineWidth = 2;
  ctx.setLineDash([7, 5]);
  ctx.beginPath();
  ctx.moveTo(0, GAME_OVER_LINE);
  ctx.lineTo(CANVAS_W, GAME_OVER_LINE);
  ctx.stroke();
  ctx.fillStyle = 'rgba(255, 190, 80, .85)';
  ctx.font = '700 11px system-ui, sans-serif';
  ctx.fillText('공정 한계선', 56, GAME_OVER_LINE - 8);
  ctx.restore();
}

function drawHBeam(r) {
  ctx.beginPath();
  ctx.rect(-r * 0.72, -r * 0.55, r * 0.26, r * 1.1);
  ctx.rect(r * 0.46, -r * 0.55, r * 0.26, r * 1.1);
  ctx.rect(-r * 0.54, -r * 0.16, r * 1.08, r * 0.32);
  ctx.fill(); ctx.stroke();
}

function drawCity(r) {
  roundRect(-r * 0.82, -r * 0.58, r * 1.64, r * 1.16, r * 0.18);
  ctx.fill(); ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,.8)';
  for (let i = -2; i <= 2; i++) ctx.fillRect(i * r * 0.26 - 3, -r * 0.25, 6, r * 0.45);
}

function drawStar(radius, points) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i++) {
    const a = -Math.PI / 2 + i * Math.PI / points;
    const rr = i % 2 === 0 ? radius : radius * 0.48;
    const x = Math.cos(a) * rr;
    const y = Math.sin(a) * rr;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function lightenColor(hex, amount) {
  const num = parseInt(hex.slice(1), 16);
  const r = Math.min(255, (num >> 16) + amount);
  const g = Math.min(255, ((num >> 8) & 0xff) + amount);
  const b = Math.min(255, (num & 0xff) + amount);
  return `rgb(${r},${g},${b})`;
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function gameLoop() {
  if (!quizActive && !gameOver) Engine.update(engine, 1000 / 60);
  updateEffects();
  drawBackground();
  drawGameOverLine();
  for (const body of Composite.allBodies(world)) if (body.label === 'part') drawPart(body);
  drawPreview();
  drawEffects();
  frameCount++;
  if (frameCount % 20 === 0) checkGameOver();
  requestAnimationFrame(gameLoop);
}

if (document.readyState === 'loading') window.addEventListener('DOMContentLoaded', init);
else init();
