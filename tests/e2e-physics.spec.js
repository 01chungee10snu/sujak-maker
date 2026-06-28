/**
 * E2E Test: Physics configuration and runtime helpers
 *
 * Verifies:
 * 1. Matter.js engine uses the configured physics values
 * 2. Merge velocity and lift force are bounded by config
 * 3. Game-over settling rejects fresh/fast bodies and accepts stable overline bodies
 */

const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const PORT = 5182;

function startServer() {
  return new Promise((resolve) => {
    const mime = {
      '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json',
      '.md': 'text/markdown',
    };
    const server = http.createServer((req, res) => {
      let urlPath = req.url.split('?')[0];
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(ROOT, urlPath);
      if (!filePath.startsWith(ROOT) || !fs.existsSync(filePath)) {
        res.writeHead(404); res.end('Not found'); return;
      }
      const ext = path.extname(filePath);
      res.writeHead(200, { 'Content-Type': mime[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

const results = [];

function check(name, cond, detail = '') {
  const status = cond ? 'PASS' : 'FAIL';
  results.push({ name, status, detail });
  console.log(`  ${status}: ${name}${detail ? ' - ' + detail : ''}`);
  return cond;
}

(async () => {
  console.log('\n=== E2E Physics Test ===\n');

  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 480, height: 800 } });
  const consoleErrors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => consoleErrors.push(err.message));

  await page.goto(`http://127.0.0.1:${PORT}/`, { waitUntil: 'networkidle', timeout: 15000 });
  await page.waitForFunction(() => window.YONGGANG_GAME_DATA && window.Matter);
  await page.evaluate(() => { window.YONGGANG_GAME_DATA.googleSheets.endpoint = ''; });
  await page.click('#touch-hint');
  await page.click('#landing-ok');
  await page.fill('#input-nickname', 'PhysicsTest');
  await page.fill('#input-employee-id', 'physics-001');
  await page.click('#login-submit');
  await page.waitForSelector('#start-overlay', { state: 'hidden', timeout: 5000 });

  const state = await page.evaluate(() => {
    const cfg = window.YONGGANG_GAME_DATA.physics;
    const carry = cfg.merge.velocityCarry;
    const mergeVelocity = getMergeVelocity(
      { velocity: { x: 2, y: 1 } },
      { velocity: { x: -1, y: 3 } }
    );
    const smallLift = getMergeLiftForce(2).y;
    const largeLift = getMergeLiftForce(10000).y;
    const frame = cfg.gameOver.spawnGraceFrames + 1;
    const freshOverline = {
      velocity: { x: 0, y: 0 },
      position: { y: cfg.gameOver.lineY },
      collisionRadius: 20,
      spawnFrame: frame,
      tier: 0
    };
    const fastOverline = {
      velocity: { x: cfg.gameOver.maxSettledVelocityX + 0.2, y: 0 },
      position: { y: cfg.gameOver.lineY },
      collisionRadius: 20,
      spawnFrame: 0,
      tier: 0
    };
    const stableOverline = {
      velocity: { x: 0.05, y: 0.05 },
      position: { y: cfg.gameOver.lineY },
      collisionRadius: 20,
      spawnFrame: 0,
      tier: 0
    };
    const stableBelowLine = {
      velocity: { x: 0.05, y: 0.05 },
      position: { y: cfg.gameOver.lineY + 40 },
      collisionRadius: 20,
      spawnFrame: 0,
      tier: 0
    };

    return {
      gravityY: engine.gravity.y,
      positionIterations: engine.positionIterations,
      velocityIterations: engine.velocityIterations,
      constraintIterations: engine.constraintIterations,
      helperTypes: {
        getMergeVelocity: typeof getMergeVelocity,
        getMergeLiftForce: typeof getMergeLiftForce,
        isBodySettledForGameOver: typeof isBodySettledForGameOver
      },
      mergeVelocity,
      expectedMergeVelocity: { x: 1 * carry, y: 4 * carry },
      smallLift,
      largeLift,
      expectedLargeLift: -cfg.merge.maxUpwardForce,
      freshOverline: isBodySettledForGameOver(freshOverline, frame),
      fastOverline: isBodySettledForGameOver(fastOverline, frame),
      stableOverline: isBodySettledForGameOver(stableOverline, frame),
      stableBelowLine: isBodySettledForGameOver(stableBelowLine, frame),
      cfg
    };
  });

  console.log('\n--- Engine Config ---');
  check('Engine gravity uses config', state.gravityY === state.cfg.engine.gravityY, `${state.gravityY}`);
  check('Engine position iterations use config', state.positionIterations === state.cfg.engine.positionIterations, `${state.positionIterations}`);
  check('Engine velocity iterations use config', state.velocityIterations === state.cfg.engine.velocityIterations, `${state.velocityIterations}`);
  check('Engine constraint iterations use config', state.constraintIterations === state.cfg.engine.constraintIterations, `${state.constraintIterations}`);

  console.log('\n--- Runtime Helpers ---');
  check('Physics helper functions are available',
    Object.values(state.helperTypes).every((type) => type === 'function'),
    JSON.stringify(state.helperTypes)
  );
  check('Merge velocity uses configured carry',
    Math.abs(state.mergeVelocity.x - state.expectedMergeVelocity.x) < 0.0001 &&
    Math.abs(state.mergeVelocity.y - state.expectedMergeVelocity.y) < 0.0001,
    JSON.stringify(state.mergeVelocity)
  );
  check('Small merge lift remains negative', state.smallLift < 0, `${state.smallLift}`);
  check('Large merge lift is capped', state.largeLift === state.expectedLargeLift, `${state.largeLift}`);
  check('Fresh overline body is not game over eligible', state.freshOverline === false);
  check('Fast overline body is not game over eligible', state.fastOverline === false);
  check('Stable overline body is game over eligible', state.stableOverline === true);
  check('Stable below-line body is not game over eligible', state.stableBelowLine === false);
  check('No console errors', consoleErrors.length === 0, consoleErrors.slice(0, 3).join('; '));

  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  console.log(`\n${passed} passed, ${failed} failed out of ${results.length}`);

  await browser.close();
  server.close();
  process.exit(failed > 0 ? 1 : 0);
})().catch((err) => {
  console.error('FATAL:', err);
  process.exit(1);
});
