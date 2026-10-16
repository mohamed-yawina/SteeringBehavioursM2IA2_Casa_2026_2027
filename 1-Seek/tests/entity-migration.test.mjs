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

test('Boss entry completes and phases one/two use bounded reactive steering', () => {
  const { classes: { Boss, Vehicle } } = loadEntities();
  const boss = new Boss();
  const player = { pos: new Vector(600, 200) };
  let integrations = 0, forces = 0;
  const integrate = Vehicle.prototype.update;
  Vehicle.prototype.update = function () { integrations++; return integrate.call(this); };
  const apply = boss.applyForce.bind(boss);
  boss.applyForce = force => {
    assert.ok(force.mag() <= boss.maxForce + 1e-12);
    forces++; apply(force);
  };
  for (let i = 0; i < 600 && boss.entering; i++) {
    boss.update(player);
    assert.equal(boss.maxSpeed, 6);
    assert.ok(boss.vel.mag() <= 6 + 1e-12);
  }
  assert.equal(boss.entering, false, 'entry must terminate without position snapping');
  assert.ok(Vector.dist(boss.pos, new Vector(400, 200)) <= 2);
  assert.equal(integrations, forces);

  boss.entering = false; boss.pos.set(400, 200); boss.health = 1000;
  boss.vel.set(0, 0);
  boss.update({ pos: new Vector(800, 200) });
  near(boss.pos.x, 400.4); near(boss.pos.y, 200); assert.equal(boss.phase, 1);

  boss.health = 500; boss.moveTimer = 0; boss.shootTimer = 0;
  const before = boss.pos.copy();
  const expectedTarget = new Vector(400 + Math.cos(0.02) * 150, 250 + Math.sin(0.02) * 75);
  const expectedForce = boss.seek(expectedTarget);
  const expectedVelocity = boss.vel.copy().add(expectedForce).limit(boss.maxSpeed);
  boss.update({ pos: new Vector(800, 200) });
  near(boss.pos.x, before.x + expectedVelocity.x);
  near(boss.pos.y, before.y + expectedVelocity.y);
  assert.ok(Vector.dist(boss.pos, expectedTarget) > 1, 'ellipse is a target, not an imposed position');
  assert.equal(boss.phase, 2);
  assert.equal(integrations, forces);
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

test('player composition locally caps avoidance before combining and caps the total without integrating', () => {
  const { context } = loadEntities();
  const sketch = readFileSync(new URL('../sketch.js', import.meta.url), 'utf8');
  vm.runInContext(sketch, context);
  const compose = vm.runInContext('calculatePlayerSteering', context);
  const targets = new Vector(70, 80), obstacles = [];
  const agent = {
    maxForce: 0.4,
    arrive(target, radius) { assert.equal(target, targets); assert.equal(radius, 100); return new Vector(.4, 0); },
    avoid(items) { assert.equal(items, obstacles); return new Vector(0, 1.2); },
    boundaries(margin) { assert.equal(margin, 80); return new Vector(0, 0); },
    applyForce() { assert.fail('composition must only return its force'); },
    update() { assert.fail('composition must not integrate'); }
  };
  let force = compose(agent, targets, obstacles);
  near(force.mag(), .4); near(force.x, .4 / Math.sqrt(2)); near(force.y, force.x);
  agent.avoid = () => new Vector(-1.2, 0);
  force = compose(agent, targets, obstacles); near(force.mag(), 0);
  agent.maxForce = 0;
  force = compose(agent, targets, obstacles); near(force.mag(), 0);
  assert.equal((sketch.match(/player\.applyForce\(/g) || []).length, 1, 'single player force application in active challenge');
});

test('player real steering remains finite and capped near obstacles and borders with speed boosts', () => {
  const { context, classes: { Vehicle, Obstacle } } = loadEntities();
  vm.runInContext(readFileSync(new URL('../sketch.js', import.meta.url), 'utf8'), context);
  const compose = vm.runInContext('calculatePlayerSteering', context);
  const agent = new Vehicle(20, 20); agent.vel.set(1, 0);
  for (const speed of [6, 9.6]) {
    agent.maxSpeed = speed;
    for (const target of [agent.pos.copy(), new Vector(700, 500)]) {
      for (const obstacles of [[], [new Obstacle(80, 20, 40)]]) {
        const before = agent.pos.copy();
        const force = compose(agent, target, obstacles);
        assert.ok(Number.isFinite(force.x) && Number.isFinite(force.y));
        assert.ok(force.mag() <= agent.maxForce + 1e-12);
        assert.deepEqual([agent.pos.x, agent.pos.y], [before.x, before.y]);
      }
    }
  }
});

test('boss keeps attack thresholds and patterns in all three phases', () => {
  const { context, classes: { Boss } } = loadEntities();
  const boss = new Boss(); boss.entering = false; boss.pos.set(400, 200);
  const player = { pos: new Vector(600, 300) };
  const shots = () => vm.runInContext('projectiles', context);
  boss.shootTimer = 58;
  boss.update(player); assert.equal(shots().length, 0);
  boss.update(player); assert.equal(shots().length, 3); assert.equal(boss.shootTimer, 0);
  boss.health = 660; boss.shootTimer = 6;
  boss.update(player); assert.equal(boss.phase, 2); assert.equal(shots().length, 3);
  boss.update(player); assert.equal(shots().length, 4); assert.equal(boss.shootTimer, 0);
  near(shots()[3].vel.mag(), 5); near(boss.spiralAngle, .4);
  boss.health = 330; boss.shootTimer = 23; boss.moveTimer = 118;
  boss.update(player); assert.equal(boss.phase, 3); assert.equal(shots().length, 4);
  boss.update(player); assert.equal(shots().length, 6); assert.equal(boss.moveTimer, 0);
  assert.equal(context.particles.length, 20);
  near(shots()[4].vel.mag(), 7); near(shots()[5].vel.mag(), 7);
  assert.deepEqual([boss.pos.x, boss.pos.y, boss.vel.mag(), boss.acc.mag()], [400, 215, 0, 0]);
});

test('boss maintains force/speed limits and integrates once per live step across phase transitions', () => {
  const { classes: { Boss, Vehicle } } = loadEntities();
  const boss = new Boss(); boss.entering = false; boss.pos.set(400, 200);
  let updates = 0, applications = 0;
  const integrate = Vehicle.prototype.update;
  Vehicle.prototype.update = function () { updates++; return integrate.call(this); };
  const apply = boss.applyForce.bind(boss);
  boss.applyForce = force => { applications++; assert.ok(force.mag() <= .4 + 1e-12); apply(force); };
  for (let i = 0; i < 360; i++) {
    boss.health = i < 60 ? 1000 : i < 240 ? 500 : 100;
    boss.update({ pos: new Vector(i % 2 ? 780 : 20, 200) });
    assert.equal(boss.maxSpeed, 6);
    assert.ok(boss.vel.mag() <= 6 + 1e-12);
    assert.ok(Number.isFinite(boss.pos.x) && Number.isFinite(boss.pos.y));
    near(boss.acc.mag(), 0);
    assert.equal(updates, i + 1); assert.equal(applications, i + 1);
  }
  boss.takeDamage(1000); boss.update({ pos: new Vector(0, 0) });
  assert.equal(updates, 360); assert.equal(boss.isDead, true);
});
