const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.resolve(__dirname, '..');
const dataSource = fs.readFileSync(path.join(root, 'data/game-data.js'), 'utf8');
const context = { window: {} };
vm.createContext(context);
vm.runInContext(dataSource, context);

const data = context.window.YONGGANG_GAME_DATA;
const physics = data && data.physics;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function numberInRange(value, min, max, name) {
  assert(Number.isFinite(value), `${name} must be a finite number`);
  assert(value >= min && value <= max, `${name} must be between ${min} and ${max}, got ${value}`);
}

assert(physics && typeof physics === 'object', 'physics config is missing');

assert(physics.engine && typeof physics.engine === 'object', 'physics.engine is missing');
numberInRange(physics.engine.gravityY, 0.95, 1.12, 'physics.engine.gravityY');
numberInRange(physics.engine.positionIterations, 10, 14, 'physics.engine.positionIterations');
numberInRange(physics.engine.velocityIterations, 8, 12, 'physics.engine.velocityIterations');
numberInRange(physics.engine.constraintIterations, 4, 6, 'physics.engine.constraintIterations');
assert(physics.engine.enableSleeping === true, 'physics.engine.enableSleeping must be true');

assert(physics.body && typeof physics.body === 'object', 'physics.body is missing');
numberInRange(physics.body.frictionStatic, 0.82, 0.92, 'physics.body.frictionStatic');
numberInRange(physics.body.frictionAirBase, 0.01, 0.018, 'physics.body.frictionAirBase');
numberInRange(physics.body.frictionAirRadiusFactor, 0.00001, 0.00008, 'physics.body.frictionAirRadiusFactor');
numberInRange(physics.body.slop, 0.008, 0.016, 'physics.body.slop');
numberInRange(physics.body.angularVelocityJitter, 0.015, 0.035, 'physics.body.angularVelocityJitter');

assert(physics.drop && typeof physics.drop === 'object', 'physics.drop is missing');
numberInRange(physics.drop.cooldownMs, 380, 520, 'physics.drop.cooldownMs');
numberInRange(physics.drop.lineY, 50, 70, 'physics.drop.lineY');
numberInRange(physics.drop.initialVelocityY, 0.65, 0.95, 'physics.drop.initialVelocityY');
numberInRange(physics.drop.randomVelocityX, 0.08, 0.20, 'physics.drop.randomVelocityX');

assert(physics.merge && typeof physics.merge === 'object', 'physics.merge is missing');
numberInRange(physics.merge.velocityCarry, 0.20, 0.32, 'physics.merge.velocityCarry');
numberInRange(physics.merge.upwardForcePerMass, 0.010, 0.015, 'physics.merge.upwardForcePerMass');
numberInRange(physics.merge.maxUpwardForce, 0.70, 1.20, 'physics.merge.maxUpwardForce');
numberInRange(physics.merge.popFrames, 12, 20, 'physics.merge.popFrames');

assert(physics.gameOver && typeof physics.gameOver === 'object', 'physics.gameOver is missing');
numberInRange(physics.gameOver.lineY, 86, 98, 'physics.gameOver.lineY');
numberInRange(physics.gameOver.spawnGraceFrames, 130, 180, 'physics.gameOver.spawnGraceFrames');
numberInRange(physics.gameOver.settleFrames, 130, 180, 'physics.gameOver.settleFrames');
numberInRange(physics.gameOver.maxSettledVelocityX, 0.70, 1.00, 'physics.gameOver.maxSettledVelocityX');
numberInRange(physics.gameOver.maxSettledVelocityY, 0.70, 1.00, 'physics.gameOver.maxSettledVelocityY');

console.log('validated physics engine config');
