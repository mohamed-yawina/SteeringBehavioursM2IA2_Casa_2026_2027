import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Vector {
  constructor(x = 0, y = 0) { this.set(x, y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vector(this.x, this.y); }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  normalize() { const m = this.mag(); if (m) this.mult(1 / m); return this; }
  setMag(n) { const m = this.mag(); if (m) this.mult(n / m); return this; }
  limit(n) { if (this.mag() > n) this.setMag(n); return this; }
  rotate(a) { const x = this.x, y = this.y; this.x = x * Math.cos(a) - y * Math.sin(a); this.y = x * Math.sin(a) + y * Math.cos(a); return this; }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static add(a, b) { return new Vector(a.x + b.x, a.y + b.y); }
  static mult(v, n) { return new Vector(v.x * n, v.y * n); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  static random2D() { return new Vector(1, 0); }
}

function loadEntities() {
  const context = vm.createContext({
    createVector: (x, y) => new Vector(x, y),
    p5: { Vector },
    color: (...values) => values,
    random: (a, b) => {
      if (Array.isArray(a)) return a[0];
      if (b === undefined) return (a ?? 1) / 2;
      return (a + b) / 2;
    },
    map: (n, a, b, c, d) => c + (n - a) * (d - c) / (b - a),
    constrain: (n, a, b) => Math.max(a, Math.min(b, n)),
    sin: Math.sin, cos: Math.cos,
    TWO_PI: Math.PI * 2, PI: Math.PI,
    width: 800, height: 600, frameCount: 0,
    particles: [], enemies: [],
  });
  for (const file of ['vehicle.js', 'obstacle.js', 'target.js', 'projectile.js', 'particle.js', 'powerup.js', 'boss.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context, { filename: file });
  }
  return { context, classes: vm.runInContext('({ Vehicle, Obstacle, Target, Projectile, Particle, PowerUp, Boss })', context) };
}

const near = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} != ${expected}`);

test('reference Target flee trajectory and wall reflection are deterministic', () => {
  const { classes: { Target } } = loadEntities();
  const target = new Target(100, 100, 'basic');
  target.vel.set(1, 0);
  target.update([{ pos: new Vector(120, 100), vel: new Vector(0, 0) }]);
  // Steering is capped at 0.3: one frame decelerates the positive velocity
  // from 1 to 0.7 before it can reverse direction.
  near(target.pos.x, 100.7); near(target.pos.y, 100);
  near(target.vel.x, 0.7); near(target.acc.mag(), 0);

  target.pos.set(785, 200); target.vel.set(2, 0);
  target.update([]);
  near(target.pos.x, 786); near(target.vel.x, -2);
});

test('reference Projectile preserves linear and homing trajectories, trail, collision and lifetime', () => {
  const { classes: { Projectile, Vehicle } } = loadEntities();
  const projectile = new Projectile(10, 20, 3, -2);
  projectile.applyForce(new Vector(0.5, 0.25));
  const player = new Vehicle(24, 20);
  assert.equal(projectile.collidesWith(player), true);
  projectile.update();
  assert.deepEqual([projectile.pos.x, projectile.pos.y], [13.5, 18.25]);
  assert.deepEqual([projectile.vel.x, projectile.vel.y], [3.5, -1.75]);
  assert.deepEqual([projectile.trail.length, projectile.trail[0].x, projectile.trail[0].y, projectile.life], [1, 10, 20, 299]);

  const homing = new Projectile(10, 40, 0, 0, 10, true);
  homing.update({ pos: new Vector(100, 40) });
  near(homing.pos.x, 10.3); near(homing.pos.y, 40);
  assert.equal(homing.trail[0].x, 10);
});

test('reference Boss entry and phase one/two paths keep their frame-based positions', () => {
  const { classes: { Boss } } = loadEntities();
  const boss = new Boss();
  boss.update({ pos: new Vector(600, 200) });
  near(boss.pos.x, 400); near(boss.pos.y, -98);

  boss.entering = false; boss.pos.set(400, 200); boss.health = 1000;
  boss.update({ pos: new Vector(800, 200) });
  near(boss.pos.x, 402); near(boss.pos.y, 200); assert.equal(boss.phase, 1);

  boss.health = 500; boss.moveTimer = 0; boss.shootTimer = 0;
  boss.update({ pos: new Vector(800, 200) });
  near(boss.pos.x, 400 + Math.cos(0.02) * 150);
  near(boss.pos.y, 250 + Math.sin(0.02) * 75);
  assert.equal(boss.phase, 2);
});

test('reference Boss phase three relocates on schedule and creates its explosion', () => {
  const { context, classes: { Boss } } = loadEntities();
  const boss = new Boss();
  boss.entering = false; boss.health = 100; boss.moveTimer = 119; boss.shootTimer = 0;
  boss.update({ pos: new Vector(600, 300) });
  assert.equal(boss.phase, 3);
  assert.deepEqual([boss.pos.x, boss.pos.y, boss.moveTimer], [400, 215, 0]);
  assert.equal(context.particles.length, 20);
});

test('PowerUp and Obstacle inherit Vehicle and preserve static position and collision behavior', () => {
  const { classes: { PowerUp, Obstacle, Vehicle } } = loadEntities();
  const item = new PowerUp(40, 50, 'speed');
  item.update();
  assert.ok(item instanceof Vehicle);
  assert.deepEqual([item.pos.x, item.pos.y, item.life, item.rotation], [40, 50, 599, 0.02]);
  assert.equal(item.collidesWith(new Vehicle(70, 50)), true);

  const obstacle = new Obstacle(160, 100, 30);
  assert.ok(obstacle instanceof Vehicle);
  const before = obstacle.pos.copy();
  obstacle.update();
  assert.deepEqual([obstacle.pos.x, obstacle.pos.y], [before.x, before.y]);
  const agent = new Vehicle(100, 100); agent.vel.set(1, 0);
  const avoidance = agent.avoid([obstacle]);
  assert.ok(avoidance.x < 0);
  assert.deepEqual([obstacle.pos.x, obstacle.pos.y, obstacle.r], [before.x, before.y, 30]);
});

test('Particle inherits Vehicle and keeps its ballistic displacement, drag and expiration schedule', () => {
  const { classes: { Particle, Vehicle } } = loadEntities();
  const particle = new Particle(10, 20, 'pink');
  assert.ok(particle instanceof Vehicle);
  particle.update(); particle.update();
  near(particle.pos.x, 15.85); near(particle.pos.y, 20);
  near(particle.vel.x, 2.7075); near(particle.life, 239);
  for (let i = 0; i < 30; i++) particle.update();
  assert.equal(particle.life, -1);
  assert.equal(particle.isDead(), true);
});

test('Target, Projectile and Boss inherit Vehicle and delegate their integration', () => {
  const { classes: { Target, Projectile, Boss, Vehicle } } = loadEntities();
  assert.ok(new Target(10, 10) instanceof Vehicle);
  assert.ok(new Projectile(10, 10, 1, 0) instanceof Vehicle);
  assert.ok(new Boss() instanceof Vehicle);

  for (const file of ['target.js', 'projectile.js']) {
    const source = readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
    assert.match(source, /super\.update\(\)/, `${file} must delegate locomotion`);
    assert.doesNotMatch(source, /this\.pos\.add\(this\.vel\)/, `${file} must not duplicate position integration`);
  }
});

test('Swarm Attack loads Obstacle after Vehicle and before sketch instantiation', () => {
  const html = readFileSync(new URL('../swarm-attack.html', import.meta.url), 'utf8');
  const vehicleIndex = html.indexOf('src="vehicle.js"');
  const obstacleIndex = html.indexOf('src="obstacle.js"');
  const sketchIndex = html.indexOf('src="sketch.js"');
  assert.ok(vehicleIndex >= 0 && vehicleIndex < obstacleIndex && obstacleIndex < sketchIndex);
});
