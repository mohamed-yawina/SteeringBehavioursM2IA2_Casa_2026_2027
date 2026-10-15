import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vector(this.x, this.y); }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  normalize() { const m = this.mag(); if (m) this.mult(1 / m); return this; }
  setMag(n) { const m = this.mag(); if (m) this.mult(n / m); return this; }
  limit(n) { if (this.mag() > n) this.setMag(n); return this; }
  rotate(angle) { const x = this.x, y = this.y; this.x = x * Math.cos(angle) - y * Math.sin(angle); this.y = x * Math.sin(angle) + y * Math.cos(angle); return this; }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static add(a, b) { return new Vector(a.x + b.x, a.y + b.y); }
  static mult(v, n) { return new Vector(v.x * n, v.y * n); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  static random2D() { return new Vector(1, 0); }
  static angleBetween(a, b) { const product = a.mag() * b.mag(); return product ? Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / product))) : 0; }
}

const near = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

function load() {
  const context = vm.createContext({
    createVector: (x, y) => new Vector(x, y),
    p5: { Vector },
    color: (...args) => args,
    random: (min = 1, max) => max === undefined ? min / 2 : (min + max) / 2,
    TWO_PI: Math.PI * 2,
    PI: Math.PI,
    map: (n, a, b, c, d) => c + (n - a) * (d - c) / (b - a),
    width: 500, height: 400, frameCount: 0, sin: Math.sin,
  });
  for (const file of ['vehicle.js', 'target-selection.js', 'target.js', 'bouncingBall.js', 'pursuit-agent.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  }
  return vm.runInContext('({ Vehicle, Target, BouncingBall, PursuitAgent, closestTargetTo, capturingHunterFor })', context);
}

test('reference Seek points toward the target and respects maxSpeed/maxForce', () => {
  const { Vehicle } = load();
  const vehicle = new Vehicle(0, 0);
  vehicle.maxSpeed = 5;
  vehicle.maxForce = 0.25;
  vehicle.vel = new Vector(0, 5);
  const force = vehicle.seek(new Vector(100, 0));
  near(force.x, Math.SQRT1_2 * 0.25);
  near(force.y, -Math.SQRT1_2 * 0.25);
  assert.ok(force.mag() <= vehicle.maxForce + 1e-9);
});

test('reference Flee constructs an away desired velocity before subtracting current velocity', () => {
  const { Vehicle } = load();
  const vehicle = new Vehicle(0, 0);
  vehicle.maxSpeed = 6;
  vehicle.maxForce = 0.5;
  vehicle.vel = new Vector(0, 6);
  const force = vehicle.flee(new Vector(10, 0));
  near(force.x, -Math.SQRT1_2 * 0.5);
  near(force.y, -Math.SQRT1_2 * 0.5);
  assert.ok(force.mag() <= vehicle.maxForce + 1e-9);
});

test('reference Pursuit predicts target position without mutating its velocity', () => {
  const { Vehicle } = load();
  const vehicle = new Vehicle(0, 0);
  vehicle.maxSpeed = 10;
  vehicle.maxForce = 0.3;
  const target = { pos: new Vector(20, 10), vel: new Vector(2, -1) };
  const originalVelocity = target.vel.copy();
  const predicted = new Vector(target.pos.x + 2 * 7, target.pos.y - 1 * 7);
  const expected = vehicle.seek(predicted);
  const actual = vehicle.pursue(target, 7);
  near(actual.x, expected.x);
  near(actual.y, expected.y);
  near(target.vel.x, originalVelocity.x);
  near(target.vel.y, originalVelocity.y);
  assert.ok(actual.mag() <= vehicle.maxForce + 1e-9);
});

test('reference Evade uses predicted position and an away desired velocity', () => {
  const { Vehicle } = load();
  const vehicle = new Vehicle(0, 0);
  vehicle.maxSpeed = 8;
  vehicle.maxForce = 0.4;
  vehicle.vel = new Vector(0, 8);
  const pursuer = { pos: new Vector(10, 5), vel: new Vector(1, 0) };
  const predicted = new Vector(10 + 1 * 4, 5);
  const expected = vehicle.flee(predicted);
  const actual = vehicle.evade(pursuer, 4);
  near(actual.x, expected.x);
  near(actual.y, expected.y);
  assert.ok(actual.mag() <= vehicle.maxForce + 1e-9);
});

test('reference behaviors handle zero distance and stationary target vectors', () => {
  const { Vehicle } = load();
  const vehicle = new Vehicle(12, 9);
  vehicle.vel = new Vector(0, 0);
  assert.equal(vehicle.seek(new Vector(12, 9)).mag(), 0);
  assert.equal(vehicle.flee(new Vector(12, 9)).mag(), 0);
  const stationary = { pos: new Vector(30, 9), vel: new Vector(0, 0) };
  assert.ok(vehicle.pursue(stationary, 30).mag() <= vehicle.maxForce + 1e-9);
  assert.ok(vehicle.evade(stationary, 30).mag() <= vehicle.maxForce + 1e-9);
});

test('nearest-target selection handles nearest, ties and empty arrays', () => {
  const { closestTargetTo, capturingHunterFor } = load();
  const agent = { pos: new Vector(0, 0) };
  const far = { pos: new Vector(8, 0) };
  const nearTarget = { pos: new Vector(2, 1) };
  assert.equal(closestTargetTo(agent, [far, nearTarget]), nearTarget);
  assert.equal(closestTargetTo(agent, []), null);
  const first = { pos: new Vector(1, 0) };
  const second = { pos: new Vector(-1, 0) };
  assert.equal(closestTargetTo(agent, [first, second]), first);

  const prey = { pos: new Vector(10, 0), r: 5 };
  const outside = { pos: new Vector(30, 0), r: 5 };
  const overlapping = { pos: new Vector(19, 0), r: 5 };
  const tangent = { pos: new Vector(20, 0), r: 5 };
  assert.equal(capturingHunterFor(prey, [outside]), null);
  assert.equal(capturingHunterFor(prey, [outside, overlapping]), overlapping);
  assert.equal(capturingHunterFor(prey, [tangent]), null);
});

test('PursuitAgent publishes the same prediction and force it asks Vehicle to calculate', () => {
  const { PursuitAgent } = load();
  const agent = new PursuitAgent(20, 30);
  agent.maxSpeed = 5;
  agent.maxForce = 0.2;
  const target = { pos: new Vector(100, 50), vel: new Vector(-2, 1) };
  const force = agent.steer('pursuit', target, 12);
  near(agent.lastSteering.predictedPosition.x, 76);
  near(agent.lastSteering.predictedPosition.y, 62);
  near(agent.lastSteering.force.x, force.x);
  near(agent.lastSteering.force.y, force.y);
  assert.ok(force.mag() <= agent.maxForce + 1e-9);
});

test('prediction handles high speed and a sudden target direction change without stale state', () => {
  const { PursuitAgent } = load();
  const agent = new PursuitAgent(0, 0);
  const target = { pos: new Vector(10, 20), vel: new Vector(100, 0) };
  const first = agent.predictedPosition(target, 30);
  near(first.x, 3010); near(first.y, 20);
  target.vel.set(0, -100);
  const afterTurn = agent.predictedPosition(target, 30);
  near(afterTurn.x, 10); near(afterTurn.y, -2980);
  assert.notEqual(first.y, afterTurn.y);
});

test('Target extends Vehicle, safely updates without pursuers and delegates locomotion', () => {
  const { Vehicle, Target } = load();
  const target = new Target(100, 100);
  assert.ok(target instanceof Vehicle);
  const before = target.pos.copy();
  const result = target.update();
  assert.equal(result.closest, null);
  assert.notEqual(target.pos.x, before.x);
  assert.equal(target.trail.length, 1);
});

test('radius-only perception evades inside its radius and stays idle outside it', () => {
  const { Target } = load();
  const target = new Target(100, 100);
  target.visionRadius = 150;
  target.vel.set(1, 0);
  const nearby = { pos: new Vector(220, 100), vel: new Vector(-1, 0) };
  const inside = target.update([nearby], { visionMode: 'radius', predictionFrames: 10 });
  assert.equal(inside.closest, nearby);
  assert.equal(inside.isAlerted, true);
  assert.ok(inside.force.mag() <= target.maxForce + 1e-9);

  const outside = target.update([{ pos: new Vector(300, 100), vel: new Vector(-1, 0) }], { visionMode: 'radius' });
  assert.equal(outside.isAlerted, false);
});

test('Target selects the closest pursuer when several agents are present', () => {
  const { Target } = load();
  const target = new Target(100, 100);
  target.visionRadius = 200;
  const far = { pos: new Vector(250, 100), vel: new Vector(-1, 0) };
  const close = { pos: new Vector(115, 100), vel: new Vector(-1, 0) };
  const result = target.update([far, close], { visionMode: 'radius' });
  assert.equal(result.closest, close);
});

test('BouncingBall extends Target, updates without arguments, and reflects at canvas edges', () => {
  const { Vehicle, Target, BouncingBall } = load();
  const slow = new BouncingBall(100, 100, 2);
  const fast = new BouncingBall(120, 100, 6);
  assert.ok(slow instanceof Target);
  assert.ok(slow instanceof Vehicle);
  assert.notEqual(slow.vel.mag(), fast.vel.mag());
  slow.pos.set(495, 100);
  slow.vel.set(3, 0);
  slow.testeCollisionAvecBordsDuCanvas();
  near(slow.pos.x, 490);
  assert.ok(slow.vel.x < 0);
  assert.doesNotThrow(() => slow.update([], { idle: true }));
});
