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
  setMag(n) { const m = this.mag(); if (m) this.mult(n / m); return this; }
  limit(n) { if (this.mag() > n) this.setMag(n); return this; }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  static random2D() { return new Vector(1, 0); }
}
function setup(courseVehicle = false) {
  const elements = new Map();
  const ids = ['behavior-select', 'target-select', 'count-slider', 'speed-slider', 'force-slider', 'radius-slider', 'trails-toggle', 'vectors-toggle', 'vectors-toggle-side', 'count-output', 'count-value', 'speed-output', 'force-output', 'radius-output', 'pause-button', 'resume-button', 'reset-button', 'simulation-canvas'];
  for (const id of ids) elements.set(id, { id, value: ({ 'behavior-select': 'seek', 'target-select': 'mouse', 'count-slider': '20', 'speed-slider': '4', 'force-slider': '0.1', 'radius-slider': '120' })[id] || '', checked: id.includes('vectors'), listeners: {}, textContent: '', addEventListener(name, fn) { (this.listeners[name] ||= []).push(fn); }, dispatchEvent(event) { for (const fn of this.listeners[event.type] || []) fn(event); }, getBoundingClientRect() { return { width: 800, height: 500 }; } });
  const scenarios = ['seek', 'flee', 'mobile', 'gentle'].map(name => ({ dataset: { scenario: name }, listeners: {}, classList: { toggle() {} }, addEventListener(event, fn) { this.listeners[event] = fn; }, click() { this.listeners.click({}); } }));
  const document = { getElementById: id => elements.get(id), querySelectorAll: () => scenarios };
  const context = vm.createContext({
    createVector: (x, y) => new Vector(x, y), p5: { Vector },
    color: (...values) => values, random: (min = 1, max) => max === undefined ? min / 2 : (min + max) / 2,
    constrain: (value, min, max) => Math.max(min, Math.min(max, value)),
    TWO_PI: Math.PI * 2,
    document,
    Event: class { constructor(type) { this.type = type; } },
  });
  if (courseVehicle) {
    // A two-argument constructor must still expose the supplied steering contract.
    const reference = readFileSync(new URL('../vehicle.js', import.meta.url), 'utf8');
    vm.runInContext(reference.replace('class Vehicle {', 'class ReferenceVehicle {'), context);
    vm.runInContext('class Vehicle extends ReferenceVehicle { constructor(x, y) { super(x, y); } }', context);
  } else {
    vm.runInContext(readFileSync(new URL('../vehicle.js', import.meta.url), 'utf8'), context);
  }
  for (const file of ['lab-vehicle.js', 'lab-target.js', 'lab-controller.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  }
  return { ...vm.runInContext('({ Vehicle, LabVehicle, LabTarget, controller: SteeringLab, creerVehicules })', context), elements, scenarios };
}

test('Seek construit desiredVelocity puis steering, bornés par maxSpeed et maxForce', () => {
  const { LabVehicle } = setup();
  const agent = new LabVehicle(10, 10); agent.maxSpeed = 5; agent.maxForce = 0.2;
  const force = agent.calculateSteering(new Vector(110, 10), 'seek');
  assert.ok(Math.abs(agent.vectors.desired.x - 5) < 1e-12);
  assert.equal(agent.vectors.desired.y, 0);
  assert.ok(Math.abs(force.mag() - 0.2) < 1e-12);
  assert.ok(force.x > 0);
});

test('Flee inverse la vitesse souhaitée avant de soustraire la vitesse courante', () => {
  const { LabVehicle } = setup();
  const seek = new LabVehicle(0, 0), flee = new LabVehicle(0, 0);
  seek.maxSpeed = flee.maxSpeed = 4; seek.maxForce = flee.maxForce = 2;
  seek.vel.set(0, 1); flee.vel.set(0, 1);
  const seekForce = seek.calculateSteering(new Vector(20, 0), 'seek');
  const fleeForce = flee.calculateSteering(new Vector(20, 0), 'flee');
  assert.equal(flee.vectors.desired.x, -seek.vectors.desired.x);
  assert.equal(flee.vectors.desired.y, -seek.vectors.desired.y);
  assert.deepEqual([fleeForce.x, fleeForce.y], [-seekForce.x, seekForce.y]);
  const outside = flee.calculateSteering(new Vector(500, 0), 'flee', 100);
  assert.deepEqual([outside.x, outside.y], [0, 0]);
  const inside = flee.calculateSteering(new Vector(20, 0), 'flee', 100);
  assert.ok(inside.x < 0);
});

test('maxSpeed élevé ne change pas la limite maxForce et maxForce faible reste respectée', () => {
  const { LabVehicle } = setup();
  const agent = new LabVehicle(0, 0); agent.maxSpeed = 80; agent.maxForce = 0.01;
  assert.ok(agent.calculateSteering(new Vector(500, 0), 'seek').mag() <= 0.0100000001);
  agent.vel.set(-8, 0);
  assert.ok(agent.calculateSteering(new Vector(500, 0), 'seek').mag() <= 0.0100000001);
});

test('step délègue la locomotion, puis reboucle sur les quatre bords', () => {
  const { LabVehicle } = setup();
  const agent = new LabVehicle(104, 50); agent.r = 5; agent.vel.set(3, 0);
  agent.step(new Vector(50, 50), 'seek', { width: 100, height: 100 }, true);
  assert.equal(agent.pos.x, -5);
  assert.ok(agent.vel.mag() <= agent.maxSpeed);
  assert.equal(agent.trail.length, 1, 'le tracé est coupé au passage de bord');
  for (const [x, y, expectedX, expectedY] of [
    [-6, 50, 105, 50], [50, 106, 50, -5], [50, -6, 50, 105],
  ]) {
    agent.pos.set(x, y); agent.wrap(100, 100);
    assert.deepEqual([agent.pos.x, agent.pos.y], [expectedX, expectedY]);
  }
});

test('LabTarget hérite de Vehicle, se déplace et rebondit dans le canvas', () => {
  const { Vehicle, LabTarget } = setup();
  const target = new LabTarget(95, 50, () => 0.5); target.r = 5; target.vel.set(2, 0);
  const before = target.pos.x; target.step(100, 100);
  assert.ok(target instanceof Vehicle); assert.ok(target.pos.x <= 95); assert.ok(target.vel.x < 0); assert.equal(before, 95);
  target.pos.set(50, 95); target.vel.set(0, 2); target.turnIn = 20; target.step(100, 100);
  assert.ok(target.pos.y <= 95); assert.ok(target.vel.y < 0);
});

test('LabVehicle et LabTarget restent compatibles avec le constructeur Vehicle du cours', () => {
  const { Vehicle, LabVehicle, LabTarget } = setup(true);
  const agent = new LabVehicle(10, 10), target = new LabTarget(80, 60, () => 1);
  assert.ok(agent instanceof Vehicle); assert.ok(target instanceof Vehicle);
  assert.deepEqual([agent.maxSpeed, agent.maxForce, agent.r], [4, 0.1, 7]);
  assert.deepEqual([target.maxSpeed, target.maxForce, target.r], [1.35, 0.025, 10]);
  target.vel.set(1, 0); target.step(100, 100);
  assert.ok(target.pos.x > 80);
});

test('Target peut réapparaître à une position bornée avec une nouvelle direction', () => {
  const { LabTarget } = setup();
  const target = new LabTarget(10, 10, (min, max) => (min + max) / 2); target.placeRandomly(100, 80);
  assert.ok(target.pos.x >= target.r && target.pos.x <= 100 - target.r);
  assert.ok(target.pos.y >= target.r && target.pos.y <= 80 - target.r);
});

test('détection d’arrivée et réapparition aléatoire réinitialisent position et mouvement', () => {
  const { LabVehicle, controller } = setup();
  const agent = new LabVehicle(100, 100), target = new Vector(116, 100);
  assert.equal(controller.hasArrived(agent, target), true);
  agent.vel.set(2, -1); agent.acc.set(0.5, 0.25);
  controller.respawnVehicle(agent, new Vector(30, 70));
  assert.deepEqual([agent.pos.x, agent.pos.y, agent.vel.mag(), agent.acc.mag()], [30, 70, 0, 0]);
  agent.pos.set(100, 100);
  assert.equal(controller.hasArrived(agent, target, 15), false);
});

test('contrôles dynamiques : population, sliders, scénarios, pause, reprise et reset', () => {
  const { controller, elements, scenarios, creerVehicules } = setup();
  controller.bind(); controller.createVehicles(20); controller.createTarget();
  const count = elements.get('count-slider'); count.value = '1'; count.dispatchEvent({ type: 'input' });
  assert.equal(controller.agents.length, 1);
  count.value = '7'; count.dispatchEvent({ type: 'input' });
  assert.equal(controller.agents.length, 7);
  creerVehicules(3); assert.equal(controller.agents.length, 3);
  elements.get('speed-slider').value = '9'; elements.get('speed-slider').dispatchEvent({ type: 'input' });
  elements.get('force-slider').value = '0.01'; elements.get('force-slider').dispatchEvent({ type: 'input' });
  assert.equal(controller.agents[0].maxSpeed, 9); assert.equal(controller.agents[0].maxForce, 0.01);
  const before = controller.agents[0].pos.copy();
  elements.get('pause-button').dispatchEvent({ type: 'click' });
  assert.equal(controller.paused, true);
  controller.tick(new Vector(120, 120), { width: 800, height: 500 });
  assert.deepEqual([controller.agents[0].pos.x, controller.agents[0].pos.y], [before.x, before.y]);
  elements.get('resume-button').dispatchEvent({ type: 'click' }); assert.equal(controller.paused, false);
  scenarios.find(button => button.dataset.scenario === 'flee').click();
  assert.equal(elements.get('behavior-select').value, 'flee');
  scenarios.find(button => button.dataset.scenario === 'mobile').click();
  assert.equal(elements.get('target-select').value, 'autonomous');
  elements.get('reset-button').dispatchEvent({ type: 'click' });
  assert.equal(controller.paused, false); assert.equal(controller.agents.length, 20);
  assert.throws(() => creerVehicules(101), { name: 'RangeError' });
});

test('clic sur un agent change la sélection scientifique', () => {
  const { controller } = setup();
  controller.createVehicles(2);
  controller.agents[0].pos.set(30, 30);
  controller.agents[1].pos.set(150, 90);
  assert.equal(controller.selectAgent(new Vector(151, 91)), controller.agents[1]);
  assert.equal(controller.selectedAgent, controller.agents[1]);
});

test('instantané des vecteurs garde origine, cible, vitesse et force du même calcul', () => {
  const { LabVehicle } = setup();
  const agent = new LabVehicle(10, 20), target = new Vector(100, 20);
  agent.vel.set(1, 0); agent.calculateSteering(target, 'seek');
  const sample = agent.vectors;
  agent.pos.set(16, 20); target.set(200, 30);
  assert.deepEqual([sample.origin.x, sample.origin.y], [10, 20]);
  assert.deepEqual([sample.target.x, sample.target.y], [100, 20]);
  assert.deepEqual([sample.velocity.x, sample.velocity.y], [1, 0]);
  assert.ok(sample.steering.x > 0 && sample.visible);
});

test('cible autonome ne reçoit au plus qu’une demande de réapparition par frame', () => {
  const { controller, elements } = setup();
  controller.bind(); controller.createVehicles(2); controller.createTarget();
  elements.get('target-select').value = 'autonomous';
  const target = controller.target;
  elements.get('trails-toggle').checked = true;
  controller.agents.forEach(agent => agent.pos.set(target.pos.x, target.pos.y));
  controller.agents.forEach(agent => agent.trail.push(agent.pos.copy()));
  let respawnRequests = 0;
  target.placeRandomly = () => respawnRequests++;
  controller.tick(new Vector(0, 0), { width: 800, height: 500 });
  assert.equal(respawnRequests, 1);
  assert.ok(controller.agents.every(agent => agent.vel.mag() === 0));
  assert.ok(controller.agents.every(agent => agent.trail.length === 0));
});

test('LabVehicle delegates Seek/Flee to Vehicle and snapshots the actual returned force', () => {
  const { Vehicle, LabVehicle } = setup();
  const agent = new LabVehicle(10, 20); agent.vel.set(1, 0);
  const target = new Vector(110, 20);
  for (const behavior of ['seek', 'flee']) {
    let calls = 0; const inherited = Vehicle.prototype[behavior];
    Vehicle.prototype[behavior] = function (goal) { calls++; return inherited.call(this, goal); };
    const force = agent.calculateSteering(target, behavior, 100);
    assert.equal(calls, 1, 'distance equal to perception radius remains active');
    assert.deepEqual([force.x, force.y], [agent.vectors.steering.x, agent.vectors.steering.y]);
    assert.deepEqual([agent.vectors.origin.x, agent.vectors.origin.y], [10, 20]);
    if (behavior === 'flee') {
      const idle = agent.calculateSteering(new Vector(110.001, 20), behavior, 100);
      assert.equal(calls, 1, 'outside radius must not call inherited Flee');
      assert.equal(idle.mag(), 0);
    }
    Vehicle.prototype[behavior] = inherited;
  }
  assert.deepEqual([target.x, target.y], [110, 20]);
});

test('inherited laboratory steering brakes at zero distance and keeps independent diagnostics', () => {
  const { LabVehicle } = setup();
  for (const behavior of ['seek', 'flee']) {
    const agent = new LabVehicle(30, 40); agent.vel.set(1, -2);
    const goal = new Vector(30, 40);
    const force = agent.calculateSteering(goal, behavior);
    assert.ok(force.x < 0 && force.y > 0);
    assert.ok(Math.abs(force.mag() - agent.maxForce) < 1e-12);
    assert.equal(agent.vectors.desired.mag(), 0);
    const snapshot = [agent.vectors.steering.x, agent.vectors.steering.y];
    force.set(100, 200); goal.set(-1, -1);
    assert.deepEqual([agent.vectors.steering.x, agent.vectors.steering.y], snapshot);
    assert.deepEqual([agent.vectors.target.x, agent.vectors.target.y], [30, 40]);
  }
});
