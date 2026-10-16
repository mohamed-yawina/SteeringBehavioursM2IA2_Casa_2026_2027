import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector(this.x, this.y); }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  setMag(n) { const m = this.mag(); if (m) this.mult(n / m); return this; }
  limit(n) { if (this.mag() > n) this.setMag(n); return this; }
  static random2D() { return new Vector(1, 0); }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
}

function loadEntities() {
  const context = vm.createContext({
    createVector: (x, y) => new Vector(x, y),
    p5: { Vector },
    color: (...values) => values,
    random: (min, max) => max === undefined ? (min ?? 0) / 2 : (min + max) / 2,
    TWO_PI: Math.PI * 2,
    width: 500,
    height: 400,
  });
  for (const file of ['vehicle.js', 'obstacle.js', 'target-selection.js', 'target.js', 'bouncingBall.js', 'pursuit-agent.js', 'powerup.js', 'particle.js', 'shockwave.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
  }
  return vm.runInContext('({ Vehicle, Obstacle, PowerUp, Particle, Shockwave })', context);
}

test('PowerUp extends Vehicle and remains stationary while its pulse, rotation and lifetime advance', () => {
  const { Vehicle, PowerUp } = loadEntities();
  const powerUp = new PowerUp(40, 60, 'speed');
  assert.ok(powerUp instanceof Vehicle);
  powerUp.update();
  assert.deepEqual([powerUp.pos.x, powerUp.pos.y], [40, 60]);
  assert.equal(powerUp.pulse, Math.PI + 0.15);
  assert.equal(powerUp.rotation, 0.03);
  assert.equal(powerUp.life, 599);
  assert.equal(powerUp.collidesWith({ pos: new Vector(60, 60), r: 10 }), true);
});

test('Particle extends Vehicle and preserves ballistic position, drag, gravity and lifetime', () => {
  const { Vehicle, Particle } = loadEntities();
  const particle = new Particle(10, 20, 'cyan', 1, 5);
  assert.ok(particle instanceof Vehicle);
  particle.gravity = 0.2;
  particle.update();
  assert.deepEqual([particle.pos.x, particle.pos.y], [13, 20]);
  assert.deepEqual([particle.vel.x + particle.acc.x, particle.vel.y + particle.acc.y], [2.82, 0.2]);
  assert.equal(particle.life, 249);
  assert.equal(particle.trail.length, 0);

  particle.update();
  assert.deepEqual([particle.pos.x, particle.pos.y], [15.82, 20.2]);
  assert.deepEqual([particle.vel.x + particle.acc.x, particle.vel.y + particle.acc.y], [2.6508, 0.388]);
  assert.equal(particle.life, 243);
});

test('Shockwave extends Vehicle and stays at its origin while radius and lifetime animate', () => {
  const { Vehicle, Shockwave } = loadEntities();
  const shockwave = new Shockwave(80, 90, 'orange', 90);
  assert.ok(shockwave instanceof Vehicle);
  shockwave.update();
  assert.deepEqual([shockwave.pos.x, shockwave.pos.y], [80, 90]);
  assert.equal(shockwave.r, 13);
  assert.equal(shockwave.life, 245);
  assert.equal(shockwave.isDead(), false);
  for (let i = 0; i < 11; i++) shockwave.update();
  assert.equal(shockwave.r, 101);
  assert.equal(shockwave.isDead(), true);
});

test('Obstacle extends Vehicle, remains static and retains the Vehicle.avoid interface', () => {
  const { Vehicle, Obstacle } = loadEntities();
  const agent = new Vehicle(100, 100);
  agent.vel = new Vector(1, 0);
  const obstacle = new Obstacle(170, 100, 40);
  assert.ok(obstacle instanceof Vehicle);
  const obstacleBefore = obstacle.pos.copy();
  obstacle.update();
  const force = agent.avoid([obstacle]);
  assert.ok(force instanceof Vector);
  assert.ok(force.x < 0, 'avoidance steers away from an obstacle directly ahead');
  assert.deepEqual([obstacle.pos.x, obstacle.pos.y], [obstacleBefore.x, obstacleBefore.y]);
  assert.equal(obstacle.r, 40);
});

test('deferred ballistic forces preserve historical positions over 100 steps with changing gravity', () => {
  for (const gravity of [0, .2, -.3]) {
    const { Particle, Vehicle } = loadEntities();
    const p = new Particle(10, 20, 'cyan', 2, 5);
    const reference = { x: 10, y: 20, vx: 6, vy: 0 };
    let integrations = 0, applications = 0;
    const integrate = Vehicle.prototype.update;
    Vehicle.prototype.update = function () { integrations++; return integrate.call(this); };
    const apply = p.applyForce.bind(p);
    p.applyForce = force => { applications++; assert.ok(force instanceof Vector); apply(force); };
    for (let step = 0; step < 100; step++) {
      p.gravity = step < 50 ? gravity : -gravity;
      reference.x += reference.vx; reference.y += reference.vy;
      reference.vx *= .94; reference.vy = reference.vy * .94 + p.gravity;
      p.update();
      for (const [actual, expected] of [[p.pos.x, reference.x], [p.pos.y, reference.y],
        [p.vel.x + p.acc.x, reference.vx], [p.vel.y + p.acc.y, reference.vy]]) {
        assert.ok(Math.abs(actual - expected) <= 1e-11, `${actual} != ${expected}`);
      }
      assert.equal(p.life, 255 - 6 * (step + 1));
      assert.equal(p.isDead(), p.life <= 0);
      assert.equal(p.trail.length, 0);
      assert.equal(integrations, step + 1); assert.equal(applications, step + 1);
    }
  }
  const source = readFileSync(new URL('../particle.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /this\.vel\.(?:mult|add|set)\(|this\.vel\.[xy]\s*\+=/);
});

test('explosion still creates every particle and its separately loaded Shockwave', () => {
  const context = vm.createContext({
    createVector: (x, y) => new Vector(x, y), p5: { Vector },
    random: (a, b) => b === undefined ? (a ?? 1) / 2 : (a + b) / 2,
    color: (...args) => args, TWO_PI: Math.PI * 2, particles: [], shockwaves: []
  });
  for (const file of ['vehicle.js', 'particle.js', 'shockwave.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  }
  vm.runInContext("explode(40, 60, 'cyan', 12)", context);
  assert.equal(context.particles.length, 12); assert.equal(context.shockwaves.length, 1);
  assert.deepEqual([context.shockwaves[0].pos.x, context.shockwaves[0].pos.y, context.shockwaves[0].maxR], [40, 60, 120]);
});
