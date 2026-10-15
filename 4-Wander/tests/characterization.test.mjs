import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const tdRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const activeScripts = [
  'js/vehicle.js', 'js/airplane.js', 'js/waypoint.js', 'js/weather.js',
  'js/particle.js', 'js/atc.js', 'js/ui.js', 'js/game.js'
];

// Test double for p5.Vector's two-dimensional operations used by the app.
// Runtime browser validation must still use the checked-in p5 library.
class P5Vector {
  constructor(x = 0, y = 0, z = 0) { this.x = x; this.y = y; this.z = z; }
  set(x, y, z = this.z) {
    if (x instanceof P5Vector || (x && typeof x === 'object')) ({ x, y, z = this.z } = x);
    this.x = x; this.y = y; this.z = z; return this;
  }
  copy() { return new P5Vector(this.x, this.y, this.z); }
  add(v) { this.x += v.x; this.y += v.y; this.z += v.z || 0; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z || 0; return this; }
  mult(n) { this.x *= n; this.y *= n; this.z *= n; return this; }
  div(n) { this.x /= n; this.y /= n; this.z /= n; return this; }
  magSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  mag() { return Math.sqrt(this.magSq()); }
  normalize() { const m = this.mag(); if (m) this.div(m); return this; }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { if (this.magSq() > n * n) this.setMag(n); return this; }
  heading() { return Math.atan2(this.y, this.x); }
  rotate(a) { const x = this.x, y = this.y; this.x = x * Math.cos(a) - y * Math.sin(a); this.y = x * Math.sin(a) + y * Math.cos(a); return this; }
  static sub(a, b) { return new P5Vector(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)); }
  static add(a, b) { return new P5Vector(a.x + b.x, a.y + b.y, (a.z || 0) + (b.z || 0)); }
  static mult(a, n) { return a.copy().mult(n); }
  static dist(a, b) { return P5Vector.sub(a, b).mag(); }
}

function fixedMath(randomValues = [0.5]) {
  const math = Object.create(Math);
  let index = 0;
  math.random = typeof randomValues === 'function' ? randomValues : () => randomValues[index++ % randomValues.length];
  return math;
}

class MockElement {
  constructor(id, rect = { left: 0, top: 0, width: 1000, height: 625 }) {
    this.id = id;
    this.value = ({ speed: '4', force: '0.15', sep: '80', dist: '80', radius: '40', angle: '0.2' })[id] ?? '';
    this.checked = true;
    this.textContent = '';
    this.dataset = {};
    this.listeners = new Map();
    this.classes = new Set();
    this.classList = {
      add: name => this.classes.add(name),
      remove: name => this.classes.delete(name)
    };
    this.rect = rect;
    this.width = 0;
    this.height = 0;
  }

  addEventListener(type, callback) {
    const callbacks = this.listeners.get(type) ?? [];
    callbacks.push(callback);
    this.listeners.set(type, callbacks);
  }

  dispatch(type, event = {}) {
    for (const callback of this.listeners.get(type) ?? []) callback(event);
  }

  getBoundingClientRect() { return { ...this.rect }; }
  getContext() { return { setTransform() {} }; }
}

function createHarness({ boot = false, randomValues = [0.5], observeResize = false } = {}) {
  const elements = new Map();
  const makeElement = (id, rect) => {
    if (!elements.has(id)) elements.set(id, new MockElement(id, rect));
    return elements.get(id);
  };
  const canvas = makeElement('game', { left: 25, top: 10, width: 1000, height: 625 });
  const radar = makeElement('radarCanvas', { left: 800, top: 30, width: 160, height: 160 });
  const modeButtons = ['wander', 'waypoints', 'formation', 'patrol'].map(mode => {
    const button = new MockElement(`mode-${mode}`);
    button.dataset.mode = mode;
    return button;
  });
  const windowListeners = new Map();
  const queuedFrames = [];
  const window = {
    devicePixelRatio: 1,
    addEventListener(type, callback) { windowListeners.set(type, callback); }
  };
  const document = {
    hidden: false,
    addEventListener(type, callback) { this.listeners.set(type, callback); },
    listeners: new Map(),
    getElementById: id => makeElement(id),
    querySelectorAll: selector => selector === '.mode-btn' ? modeButtons : []
  };
  const context = vm.createContext({
    Math: fixedMath(randomValues), window, document, p5: { Vector: P5Vector },
    ResizeObserver: observeResize ? class {
      constructor(callback) { window.resizeCallback = callback; window.observed = []; }
      observe(element) { window.observed.push(element); }
    } : undefined,
    requestAnimationFrame: callback => queuedFrames.push(callback),
    performance: { now: () => 1000 },
    console
  });

  for (const file of activeScripts) {
    vm.runInContext(readFileSync(path.join(tdRoot, file), 'utf8'), context, { filename: file });
  }
  vm.runInContext(readFileSync(path.join(tdRoot, 'js/wanderer.js'), 'utf8'), context, { filename: 'js/wanderer.js' });
  if (boot) vm.runInContext(readFileSync(path.join(tdRoot, 'js/main.js'), 'utf8'), context, { filename: 'js/main.js' });

  return {
    context, elements, canvas, radar, modeButtons, window, windowListeners, queuedFrames,
    get: expression => vm.runInContext(expression, context)
  };
}

const near = (actual, expected, epsilon = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= epsilon, `${actual} is not near ${expected}`);

function asPlain(value) {
  return JSON.parse(JSON.stringify(value, (_key, item) =>
    item instanceof P5Vector ? { x: item.x, y: item.y } : item));
}

test('active page references existing local assets and loads Vehicle before its entities', () => {
  const html = readFileSync(path.join(tdRoot, 'index.html'), 'utf8');
  const localReferences = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map(match => match[1])
    .filter(reference => !/^(?:https?:|#|mailto:|data:)/.test(reference));
  for (const reference of localReferences) {
    assert.ok(existsSync(path.join(tdRoot, reference)), `Missing local reference: ${reference}`);
  }
  const p5Index = html.indexOf('src="libraries/p5.min.js"');
  const vehicleIndex = html.indexOf('src="js/vehicle.js"');
  const mainIndex = html.indexOf('src="js/main.js"');
  assert.ok(vehicleIndex >= 0 && vehicleIndex < mainIndex);
  assert.ok(p5Index >= 0 && p5Index < vehicleIndex, 'local p5 must load before Vehicle');
  assert.equal(html.includes('sketch.js'), false, 'the active page currently does not load the legacy sketch');
});

test('Vehicle stores p5.Vector states and integrates one frame with capped speed and trail', () => {
  const { get } = createHarness();
  const result = get(`(() => {
    const v = new Vehicle(10, 20, { maxSpeed: 5, maxTrailLength: 2 });
    v.vel.set(3, 4);
    v.applyForce(new p5.Vector(3, 4));
    v.update();
    return { pos: v.pos, vel: v.vel, acc: v.acc, trail: v.trail, maxSpeed: v.maxSpeed };
  })()`);
  const state = asPlain(result);
  assert.deepEqual(state.pos, { x: 13, y: 24 });
  assert.deepEqual(state.vel, { x: 3, y: 4 });
  assert.deepEqual(state.acc, { x: 0, y: 0 });
  assert.deepEqual(state.trail, [{ x: 13, y: 24 }]);
  assert.equal(state.maxSpeed, 5);
});

test('seek points at its target, subtracts current velocity and limits the resultant force', () => {
  const { get } = createHarness();
  const force = asPlain(get(`(() => {
    const v = new Vehicle(0, 0, { maxSpeed: 4, maxForce: 0.25 });
    v.vel.set(0, 1);
    return v.seek({ x: 100, y: 0 });
  })()`));
  near(force.x, 4 * 0.25 / Math.hypot(4, -1));
  near(force.y, -0.25 / Math.hypot(4, -1));
  assert.ok(Math.hypot(force.x, force.y) <= 0.25 + 1e-12);
});

test('seek at zero distance returns a zero force even if the vehicle is moving', () => {
  const { get } = createHarness();
  const force = asPlain(get(`(() => {
    const v = new Vehicle(5, 6);
    v.vel.set(2, -3);
    return v.seek({ x: 5, y: 6 });
  })()`));
  assert.deepEqual(force, { x: 0, y: 0 });
});

test('wander circle centre, target and angle variation are reproducible with fixed randomness', () => {
  const { get } = createHarness({ randomValues: [0.75] });
  const geometry = asPlain(get(`(() => {
    const v = new Vehicle(10, 20, { circleDistance: 10, circleRadius: 5, angleVariation: 0.2 });
    v.pos.set(10, 20);
    v.vel.set(0, 2);
    v.wanderAngle = 0;
    let received;
    v.seek = target => { received = { x: target.x, y: target.y }; return new p5.Vector(0.1, 0.2); };
    const force = v.wander();
    return { target: received, angle: v.wanderAngle, force };
  })()`));
  near(geometry.target.x, 10 + Math.cos(0.1) * 5);
  near(geometry.target.y, 30 + Math.sin(0.1) * 5);
  near(geometry.angle, 0.1);
  assert.deepEqual(geometry.force, { x: 0.1, y: 0.2 });
});

test('wander at zero speed uses the current +x fallback and zero variation keeps its heading', () => {
  const { get } = createHarness();
  const result = asPlain(get(`(() => {
    const v = new Vehicle(4, 8, { circleDistance: 12, circleRadius: 6, angleVariation: 0 });
    v.pos.set(4, 8); v.vel.set(0, 0); v.wanderAngle = Math.PI / 2;
    let target;
    v.seek = t => { target = { x: t.x, y: t.y }; return new p5.Vector(0, 0); };
    v.wander();
    return { target, angle: v.wanderAngle };
  })()`));
  near(result.target.x, 16); near(result.target.y, 14); near(result.angle, Math.PI / 2);
});

test('boundaries and obstacle avoidance return steering forces bounded by maxForce', () => {
  const { get } = createHarness();
  const result = asPlain(get(`(() => {
    const v = new Vehicle(10, 50, { maxSpeed: 4, maxForce: 0.2 });
    v.vel.set(-3, 1);
    const edge = v.boundaries({ x: 0, y: 0, w: 500, h: 300 }, 40);
    v.pos.set(10, 50); v.vel.set(4, 0);
    const avoid = v.avoid([{ pos: new p5.Vector(55, 50), r: 10 }]);
    return { edge, avoid };
  })()`));
  for (const force of [result.edge, result.avoid]) assert.ok(Math.hypot(force.x, force.y) <= 0.2 + 1e-12);
  assert.ok(result.edge.x > 0);
  assert.ok(result.avoid.x < 0);
});

test('Airplane separation reports proximity levels and limits its individual result', () => {
  const { get } = createHarness();
  const result = asPlain(get(`(() => {
    const a = new Airplane(100, 100, { maxSpeed: 4, maxForce: 0.15, hue: 210 });
    const b = new Airplane(120, 100, { maxSpeed: 4, maxForce: 0.15, hue: 30 });
    a.vel.set(1, 0); b.vel.set(1, 0);
    const force = a.separate([a, b]);
    return { force, alert: a.alertLevel };
  })()`));
  assert.equal(result.alert, 2);
  assert.ok(result.force.x < 0);
  assert.ok(Math.hypot(result.force.x, result.force.y) <= 0.15 + 1e-12);
});

test('all visible entity classes in the active app and the optional Wanderer inherit Vehicle', () => {
  const { get } = createHarness();
  const result = get(`(() => {
    const base = new Vehicle(0, 0);
    return [
      new Airplane(1, 1) instanceof Vehicle,
      new Waypoint(2, 2) instanceof Vehicle,
      new WeatherZone(3, 3) instanceof Vehicle,
      new TrailParticle(4, 4) instanceof Vehicle,
      new Wanderer(5, 5) instanceof Vehicle
    ];
  })()`);
  assert.deepEqual(asPlain(result), [true, true, true, true, true]);
});

test('physical state and steering results are genuine p5.Vector instances', () => {
  const { get } = createHarness();
  assert.deepEqual(asPlain(get(`(() => {
    const v = new Vehicle(3, 4);
    const force = v.seek(new p5.Vector(30, 4));
    return [v.pos instanceof p5.Vector, v.vel instanceof p5.Vector,
      v.acc instanceof p5.Vector, force instanceof p5.Vector];
  })()`)), [true, true, true, true]);
});

test('multi-frame seek trajectory preserves the reference force integration', () => {
  const { get } = createHarness();
  const positions = asPlain(get(`(() => {
    const v = new Vehicle(0, 0, { maxSpeed: 4, maxForce: 0.25 });
    const samples = [];
    for (let i = 0; i < 4; i++) {
      v.applyForce(v.seek(new p5.Vector(10, 0)));
      v.update();
      samples.push({ x: v.pos.x, y: v.pos.y, vx: v.vel.x, vy: v.vel.y });
    }
    return samples;
  })()`));
  const expectedX = [0.25, 0.75, 1.5, 2.5];
  positions.forEach((sample, index) => {
    near(sample.x, expectedX[index], 1e-12);
    near(sample.y, 0, 1e-12);
    near(sample.vx, expectedX[index] - (expectedX[index - 1] ?? 0), 1e-12);
    near(sample.vy, 0, 1e-12);
  });
});

test('p5 is loaded locally without adding a p5 canvas or a competing animation loop', () => {
  const html = readFileSync(path.join(tdRoot, 'index.html'), 'utf8');
  const productionScripts = activeScripts.map(file => readFileSync(path.join(tdRoot, file), 'utf8')).join('\n');
  assert.match(html, /src="libraries\/p5\.min\.js"/);
  assert.doesNotMatch(productionScripts, /\bcreateCanvas\s*\(/);
  assert.doesNotMatch(productionScripts, /\b(?:window\.)?(?:setup|draw)\s*=/);
  assert.equal((productionScripts.match(/requestAnimationFrame\s*\(/g) ?? []).length, 2,
    'Game owns one RAF loop: one initial schedule and one recursive schedule');
});

test('Airplane dispatches each selected flight mode to its matching steering behavior', () => {
  const { get } = createHarness();
  const calls = asPlain(get(`(() => {
    const a = new Airplane(100, 100, { hue: 200 });
    const seen = { wander: 0, waypoints: 0, formation: 0, patrol: 0 };
    const zero = () => new p5.Vector(0, 0);
    a.wander = () => { seen.wander++; return zero(); };
    a.followWaypoints = () => { seen.waypoints++; return zero(); };
    a.formationFlight = () => { seen.formation++; return zero(); };
    a.patrol = () => { seen.patrol++; return zero(); };
    a.separate = zero;
    a.boundaries = zero;
    a.applyForce = () => {};
    for (const mode of ['wander', 'waypoints', 'formation', 'patrol']) {
      a.update(100, { x: 0, y: 0, w: 500, h: 300 }, [a], [], [], mode);
    }
    return seen;
  })()`));
  assert.deepEqual(calls, { wander: 1, waypoints: 1, formation: 1, patrol: 1 });
});

test('waypoint following advances its index when close; formation and patrol generate targets', () => {
  const { get } = createHarness();
  const result = asPlain(get(`(() => {
    const a = new Airplane(98, 100, { hue: 200 });
    const points = [{ pos: new p5.Vector(100, 100) }, { pos: new p5.Vector(300, 100) }];
    const arrived = [];
    a.arrive = (target, radius) => { arrived.push({ target: { x: target.x, y: target.y }, radius }); return new p5.Vector(0, 0); };
    a.followWaypoints(points);
    const targetIndexAfterWaypoint = a.targetIndex;
    a.pos.set(0, 0); a.targetIndex = 2;
    const leader = new Airplane(100, 100, { hue: 100 }); leader.vel.set(1, 0);
    a.formationFlight([leader, new Airplane(0, 0, { hue: 200 }), a]);
    let patrolTarget;
    a.seek = target => { patrolTarget = { x: target.x, y: target.y }; return new p5.Vector(0, 0); };
    a.patrol(0);
    return { targetIndexAfterWaypoint, arrived, patrolTarget };
  })()`));
  assert.equal(result.targetIndexAfterWaypoint, 1);
  assert.deepEqual(result.arrived, [
    { target: { x: 100, y: 100 }, radius: 80 },
    { target: { x: 50, y: 140 }, radius: 60 }
  ]);
  assert.ok(Number.isFinite(result.patrolTarget.x) && Number.isFinite(result.patrolTarget.y));
});

test('Airplane preserves weighted steering ratios and clamps the total force once', () => {
  const { get } = createHarness();
  const result = asPlain(get(`(() => {
    const a = new Airplane(100, 100, { maxSpeed: 10, maxForce: 0.15, hue: 210 });
    const force = () => new p5.Vector(0.1, 0);
    a.wander = force;
    a.separate = force;
    a.avoidWeather = force;
    a.boundaries = force;
    const appliedForces = [];
    a.applyForce = f => { appliedForces.push({ x: f.x, y: f.y }); a.acc.add(f); };
    a.update(0, { x: 0, y: 0, w: 500, h: 300 }, [a], [], [{}], 'wander');
    return { applied: appliedForces[0], appliedCount: appliedForces.length,
      speed: Math.hypot(a.vel.x, a.vel.y), maxForce: a.maxForce };
  })()`));
  near(result.applied.x, result.maxForce); near(result.applied.y, 0);
  assert.equal(result.appliedCount, 1);
  assert.ok(result.speed <= 10);
});

test('Airplane applies the capped weighted sum without changing component weights', () => {
  const { get } = createHarness();
  const force = asPlain(get(`(() => {
    const a = new Airplane(100, 100, { maxSpeed: 10, maxForce: 0.2, hue: 210 });
    a.wander = () => new p5.Vector(0.1, 0.02);
    a.separate = () => new p5.Vector(0.03, 0.04);
    a.avoidWeather = () => new p5.Vector(0.05, 0);
    a.boundaries = () => new p5.Vector(0, 0.02);
    let applied;
    a.applyForce = f => { applied = { x: f.x, y: f.y }; };
    a.update(0, { x: 0, y: 0, w: 500, h: 300 }, [a], [], [{}], 'wander');
    return applied;
  })()`));
  const rawMagnitude = Math.hypot(0.235, 0.16);
  near(Math.hypot(force.x, force.y), 0.2);
  near(force.x / force.y, 0.235 / 0.16);
  near(force.x, 0.2 * 0.235 / rawMagnitude);
});

test('Airplane preserves weather avoidance weighting before the total-force clamp', () => {
  const { get } = createHarness();
  const result = asPlain(get(`(() => {
    const a = new Airplane(0, 0, { maxSpeed: 4, maxForce: 0.1, hue: 200 });
    a.vel.set(1, 0);
    return a.avoidWeather([{ pos: { x: 20, y: 0 }, radius: 60 }]);
  })()`));
  assert.ok(result.x < 0);
  assert.ok(Math.hypot(result.x, result.y) > 0.1);
});

test('Vehicle preserves explicit zero physical limits for itself and Airplane', () => {
  const { get } = createHarness();
  const result = asPlain(get(`(() => {
    const v = new Vehicle(0, 0, { maxSpeed: 0, maxForce: 0 });
    const airplane = new Airplane(0, 0, { maxSpeed: 0, maxForce: 0, hue: 180 });
    return { vehicle: [v.maxSpeed, v.maxForce], airplane: [airplane.maxSpeed, airplane.maxForce] };
  })()`));
  assert.deepEqual(result, { vehicle: [0, 0], airplane: [0, 0] });
});

test('zero steering remains zero; non-finite and negative limits use finite non-negative defaults', () => {
  const { get } = createHarness();
  const result = asPlain(get(`(() => {
    const v = new Vehicle(5, 7, { maxSpeed: NaN, maxForce: Infinity });
    const negative = new Vehicle(0, 0, { maxSpeed: -1, maxForce: -0.5 });
    const invalidAirplane = new Airplane(0, 0, { maxSpeed: NaN, maxForce: Infinity, hue: 180 });
    const seekAtSelf = v.seek(new p5.Vector(5, 7));
    const arriveAtSelf = v.arrive(new p5.Vector(5, 7));
    v.applyForce(new p5.Vector(0, 0)); v.update();
    return { params: [v.maxSpeed, v.maxForce], negativeParams: [negative.maxSpeed, negative.maxForce], airplaneParams: [invalidAirplane.maxSpeed, invalidAirplane.maxForce], finiteParams: [Number.isFinite(v.maxSpeed), Number.isFinite(v.maxForce)], seek: seekAtSelf, arrive: arriveAtSelf,
      pos: v.pos, vel: v.vel, acc: v.acc };
  })()`));
  assert.deepEqual(result.params, [3, 0.2]);
  assert.deepEqual(result.negativeParams, [3, 0.2]);
  assert.deepEqual(result.airplaneParams, [4, 0.15]);
  assert.deepEqual(result.finiteParams, [true, true]);
  assert.deepEqual(result.seek, { x: 0, y: 0 });
  assert.deepEqual(result.arrive, { x: 0, y: 0 });
  assert.deepEqual(result.pos, { x: 5, y: 7 });
  assert.deepEqual(result.vel, { x: 0, y: 0 });
  assert.deepEqual(result.acc, { x: 0, y: 0 });
});

test('Waypoint and WeatherZone stay at their positions while their visual state advances', () => {
  const { get } = createHarness();
  const state = asPlain(get(`(() => {
    const w = new Waypoint(30, 40, 2); const z = new WeatherZone(80, 90, 55);
    const before = { wp: { x: w.pos.x, y: w.pos.y }, zone: { x: z.pos.x, y: z.pos.y } };
    w.update(); z.update();
    return { before, wp: w.pos, waypointPulse: w.pulse, zone: z.pos, pulse: z.pulse, rotation: z.rotation, speeds: [w.maxSpeed, w.maxForce, z.maxSpeed, z.maxForce] };
  })()`));
  assert.deepEqual(state.wp, state.before.wp); assert.deepEqual(state.zone, state.before.zone);
  near(state.waypointPulse, 0.05); near(state.pulse, 0.03); near(state.rotation, 0.005);
  assert.deepEqual(state.speeds, [0, 0, 0, 0]);
});

test('zero maxSpeed prevents displacement and zero maxForce prevents steering acceleration', () => {
  const { get } = createHarness();
  const result = asPlain(get(`(() => {
    const stopped = new Vehicle(2, 3, { maxSpeed: 0, maxForce: 0.2 });
    stopped.vel.set(5, 0);
    stopped.applyForce(stopped.seek(new p5.Vector(100, 3)));
    stopped.update();
    const forceLocked = new Vehicle(2, 3, { maxSpeed: 4, maxForce: 0 });
    const steering = forceLocked.seek(new p5.Vector(100, 3));
    forceLocked.applyForce(steering); forceLocked.update();
    return { stopped: { pos: stopped.pos, vel: stopped.vel },
      forceLocked: { steering, acc: forceLocked.acc, vel: forceLocked.vel } };
  })()`));
  assert.deepEqual(result.stopped.pos, { x: 2, y: 3 });
  assert.deepEqual(result.stopped.vel, { x: 0, y: 0 });
  assert.deepEqual(result.forceLocked.steering, { x: 0, y: 0 });
  assert.deepEqual(result.forceLocked.acc, { x: 0, y: 0 });
  assert.deepEqual(result.forceLocked.vel, { x: 0, y: 0 });
});

test('TrailParticle follows a straight frame-based path, caps speed and expires by life', () => {
  const { get } = createHarness();
  const result = asPlain(get(`(() => {
    const p = new TrailParticle(10, 20, { maxSpeed: 2, decay: 0.25 });
    p.vel.set(4, 0);
    p.update(); const first = { pos: { x: p.pos.x, y: p.pos.y }, vel: { x: p.vel.x, y: p.vel.y }, life: p.life };
    p.update(); p.update(); p.update();
    return { first, final: { pos: p.pos, life: p.life, alive: p.alive } };
  })()`));
  assert.deepEqual(result.first, { pos: { x: 12, y: 20 }, vel: { x: 2, y: 0 }, life: 0.75 });
  assert.deepEqual(result.final, { pos: { x: 18, y: 20 }, life: 0, alive: false });
});

test('Game initializes defaults, switches modes, applies sliders and toggles pause', () => {
  const h = createHarness({ boot: true });
  const game = h.get('Game');
  assert.equal(game.airplanes.length, 6);
  assert.equal(game.waypoints.length, 4);
  assert.equal(game.weatherZones.length, 2);
  assert.equal(h.queuedFrames.length, 1);

  h.modeButtons[1].dispatch('click');
  assert.equal(game.settings.mode, 'waypoints');
  assert.ok(game.airplanes.every(airplane => airplane.mode === 'waypoints'));

  h.elements.get('speed').value = '7.5';
  h.elements.get('speed').dispatch('input');
  game.update(20);
  assert.ok(game.airplanes.every(airplane => airplane.maxSpeed === 7.5));

  h.elements.get('showTrails').checked = false;
  h.elements.get('showTrails').dispatch('change', { target: h.elements.get('showTrails') });
  assert.equal(game.settings.showTrails, false);

  game.togglePause(); assert.equal(game.paused, true);
  game.togglePause(); assert.equal(game.paused, false);
});

test('UI buttons and canvas clicks add/remove planes; clear empties all entities and particles', () => {
  const h = createHarness({ boot: true });
  const game = h.get('Game');
  const initialPlanes = game.airplanes.length;

  h.elements.get('addBtn').dispatch('click');
  assert.equal(game.airplanes.length, initialPlanes + 1);
  h.canvas.dispatch('click', { clientX: 125, clientY: 110 });
  assert.equal(game.airplanes.length, initialPlanes + 2);
  near(game.airplanes.at(-1).pos.x, 100); near(game.airplanes.at(-1).pos.y, 100);

  h.canvas.dispatch('contextmenu', { preventDefault() {}, clientX: 125, clientY: 110 });
  assert.equal(game.airplanes.length, initialPlanes + 1);
  h.elements.get('clearBtn').dispatch('click');
  assert.deepEqual([game.airplanes.length, game.waypoints.length, game.weatherZones.length], [0, 0, 0]);
});

test('resize updates logical and DPR canvas dimensions and scales entity positions', () => {
  const h = createHarness({ boot: true });
  const game = h.get('Game');
  const plane = game.airplanes[0];
  plane.pos.set(900, 500);
  h.canvas.rect = { left: 0, top: 0, width: 600, height: 375 };
  h.radar.rect = { left: 400, top: 10, width: 120, height: 120 };
  h.window.devicePixelRatio = 3;
  h.windowListeners.get('resize')();
  assert.deepEqual([game.width, game.height, h.canvas.width, h.canvas.height], [600, 375, 1200, 750]);
  assert.deepEqual(asPlain(plane.pos), { x: 540, y: 300 });
});

test('physics advances once per update call regardless of deltaTime value', () => {
  const { get } = createHarness();
  const result = asPlain(get(`(() => {
    const v = new Vehicle(0, 0, { maxSpeed: 20 }); v.vel.set(1, 0);
    v.update(10); const after10 = { x: v.pos.x, y: v.pos.y };
    v.pos.set(0, 0); v.vel.set(1, 0);
    v.update(40); const after40 = { x: v.pos.x, y: v.pos.y };
    return { after10, after40 };
  })()`));
  assert.deepEqual(result.after10, { x: 1, y: 0 });
  assert.deepEqual(result.after40, { x: 1, y: 0 });
});

test('RAF runs fixed steps only after enough elapsed time, pauses cleanly and reschedules once', () => {
  const h = createHarness({ boot: true });
  const game = h.get('Game');
  const updates = [];
  game.update = delta => updates.push(delta);
  game.draw = () => {};
  h.get('UI').updateStats = () => {};
  assert.equal(h.queuedFrames.length, 1);
  game.loop(1000);
  game.loop(1017);
  assert.equal(updates.length, 1);
  near(updates[0], 1000 / 60);
  assert.equal(h.queuedFrames.length, 3);
  game.togglePause(); game.loop(50000);
  assert.equal(updates.length, 1);
  game.togglePause(); game.loop(50016);
  assert.equal(updates.length, 1);
  game.loop(50033);
  assert.equal(updates.length, 2);
  near(updates[1], 1000 / 60);
  assert.equal(h.queuedFrames.length, 6);
});

test('resizing scales vehicle, static entity and trail positions proportionally', () => {
  const h = createHarness({ boot: true });
  const game = h.get('Game');
  game.airplanes[0].pos.set(900, 500);
  game.airplanes[0].trail = [new P5Vector(850, 450)];
  game.waypoints[0].pos.set(200, 150);
  game.weatherZones[0].pos.set(400, 250);
  const before = asPlain(h.get(`(() => ({
    plane: Game.airplanes[0].pos, trail: Game.airplanes[0].trail,
    waypoint: Game.waypoints[0].pos, weather: Game.weatherZones[0].pos
  }))()`));
  h.canvas.rect = { left: 0, top: 0, width: 600, height: 375 };
  h.windowListeners.get('resize')();
  const after = asPlain(h.get(`(() => ({
    plane: Game.airplanes[0].pos, trail: Game.airplanes[0].trail,
    waypoint: Game.waypoints[0].pos, weather: Game.weatherZones[0].pos
  }))()`));
  assert.deepEqual(after, {
    plane: { x: before.plane.x * 0.6, y: before.plane.y * 0.6 },
    trail: [{ x: before.trail[0].x * 0.6, y: before.trail[0].y * 0.6 }],
    waypoint: { x: before.waypoint.x * 0.6, y: before.waypoint.y * 0.6 },
    weather: { x: before.weather.x * 0.6, y: before.weather.y * 0.6 }
  });
});

test('repeated resize restores normalized coordinates and preserves velocities, acceleration and particle trails', () => {
  const h = createHarness({ boot: true });
  const game = h.get('Game');
  game.airplanes[0].pos.set(400, 250);
  game.airplanes[0].vel.set(2, 3);
  game.airplanes[0].acc.set(0.2, -0.1);
  game.airplanes[0].trail = [new P5Vector(200, 125)];
  const initial = h.get(`(() => {
    const p = new TrailParticle(300, 200);
    p.pos.set(300, 200); p.trail = [new p5.Vector(100, 50)];
    ParticleSystem.particles.push(p);
    return { particle: p };
  })()`);
  assert.ok(initial.particle);
  h.canvas.rect = { left: 0, top: 0, width: 600, height: 375 };
  h.windowListeners.get('resize')();
  h.canvas.rect = { left: 0, top: 0, width: 1000, height: 625 };
  h.windowListeners.get('resize')();
  const result = asPlain(h.get(`(() => ({
    plane: Game.airplanes[0].pos, velocity: Game.airplanes[0].vel,
    acceleration: Game.airplanes[0].acc, trail: Game.airplanes[0].trail,
    particle: ParticleSystem.particles[0].pos,
    particleTrail: ParticleSystem.particles[0].trail
  }))()`));
  assert.deepEqual(result.plane, { x: 400, y: 250 });
  assert.deepEqual(result.velocity, { x: 2, y: 3 });
  assert.deepEqual(result.acceleration, { x: 0.2, y: -0.1 });
  assert.deepEqual(result.trail, [{ x: 200, y: 125 }]);
  assert.deepEqual(result.particle, { x: 300, y: 200 });
  assert.deepEqual(result.particleTrail, [{ x: 100, y: 50 }]);
});

test('zero-sized canvas dimensions stay finite and resized positions remain in bounds', () => {
  const h = createHarness({ boot: true });
  const game = h.get('Game');
  game.airplanes[0].pos.x = NaN;
  game.airplanes[0].pos.y = Infinity;
  game.airplanes[0].trail = [new P5Vector(-100, Infinity)];
  h.canvas.rect = { left: 0, top: 0, width: 0, height: 0 };
  h.windowListeners.get('resize')();
  const state = asPlain(h.get(`(() => ({
    size: [Game.width, Game.height], pos: Game.airplanes[0].pos,
    trail: Game.airplanes[0].trail
  }))()`));
  assert.deepEqual(state.size, [1, 1]);
  for (const point of [state.pos, ...state.trail]) {
    assert.ok(Number.isFinite(point.x) && Number.isFinite(point.y));
    assert.ok(point.x >= 0 && point.x <= 1 && point.y >= 0 && point.y <= 1);
  }
});

test('patrol target preserves its reference orbit at 1000x625 and scales with bounds', () => {
  const { get } = createHarness({ randomValues: [0.5] });
  const point = asPlain(get(`(() => {
    const airplane = new Airplane(0, 0, { hue: 200 });
    let target;
    airplane.seek = p => { target = { x: p.x, y: p.y }; return new p5.Vector(0, 0); };
    airplane.patrol(0);
    return target;
  })()`));
  near(point.x, 400 + Math.cos(26.5) * 200);
  near(point.y, 300 + Math.sin(26.5) * 120);
  const scaled = asPlain(get(`(() => {
    const airplane = new Airplane(0, 0, { hue: 200 });
    let target;
    airplane.seek = p => { target = { x: p.x, y: p.y }; return new p5.Vector(0, 0); };
    airplane.patrol(0, { x: 0, y: 0, w: 600, h: 375 });
    return target;
  })()`));
  near(scaled.x, point.x * 0.6);
  near(scaled.y, point.y * 0.6);
});

test('fixed simulation produces equivalent physical states at 30, 60 and 144 render FPS', () => {
  const results = [];
  for (const fps of [30, 60, 144]) {
    const h = createHarness({ boot: true });
    const game = h.get('Game');
    game.draw = () => {};
    h.get('UI').updateStats = () => {};
    for (let frame = 0; frame <= fps; frame++) {
      game.loop(1000 + frame * (1000 / fps));
    }
    results.push(asPlain(h.get(`(() => ({
      pos: Game.airplanes[0].pos, vel: Game.airplanes[0].vel,
      time: Game.time, waypointPulse: Game.waypoints[0].pulse,
      weatherPulse: Game.weatherZones[0].pulse, trailLength: Game.airplanes[0].trail.length
    }))()`)));
  }
  for (const result of results.slice(1)) {
    for (const key of ['pos', 'vel']) {
      near(result[key].x, results[0][key].x, 1e-8);
      near(result[key].y, results[0][key].y, 1e-8);
    }
    for (const key of ['time', 'waypointPulse', 'weatherPulse']) near(result[key], results[0][key], 1e-8);
    assert.equal(result.trailLength, results[0].trailLength);
  }
  near(results[0].time, 1000, 1e-8);
});

test('long RAF gaps are capped to five substeps and discarded time does not catch up later', () => {
  const h = createHarness({ boot: true });
  const game = h.get('Game');
  const steps = [];
  game.update = step => steps.push(step);
  game.draw = () => {};
  h.get('UI').updateStats = () => {};
  game.loop(1000);
  game.loop(100000);
  assert.equal(steps.length, 5);
  steps.length = 0;
  game.loop(100000 + 1000 / 60);
  assert.equal(steps.length, 1);
  near(steps[0], 1000 / 60);
});

test('statistics update per render while animations advance per fixed simulation step', () => {
  const h = createHarness({ boot: true });
  const game = h.get('Game');
  const waypoint = game.waypoints[0];
  const zone = game.weatherZones[0];
  const initial = { pulse: waypoint.pulse, weatherPulse: zone.pulse, rotation: zone.rotation };
  game.update(16);
  assert.deepEqual([waypoint.pulse - initial.pulse, zone.pulse - initial.weatherPulse,
    zone.rotation - initial.rotation], [0.05, 0.03, 0.005]);
  h.get('UI').updateStats(game.airplanes, [], 60);
  assert.equal(h.elements.get('count').textContent, 6);
  assert.equal(h.elements.get('fps').textContent, 60);
});

function seededRandom(seed = 12345) {
  return () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
}

function drive(h, timestamps) {
  for (const timestamp of timestamps) {
    assert.equal(h.queuedFrames.length, 1, 'one pending RAF');
    h.queuedFrames.shift()(timestamp);
  }
}

for (const mode of ['wander', 'waypoints', 'formation', 'patrol']) {
  test(`seeded ${mode}: all states match exactly at 30, 60 and 144 FPS over five seconds`, () => {
    const results = [];
    for (const fps of [30, 60, 144]) {
      const h = createHarness({ boot: true, randomValues: seededRandom() });
      const game = h.get('Game');
      game.setMode(mode);
      game.draw = () => {};
      h.get('ParticleSystem').spawn(300, 250, '#fff', 3);
      h.get('ParticleSystem').particles.forEach(p => { p.decay = 0.001; });
      let updates = 0;
      const update = game.update.bind(game);
      game.update = () => { updates++; update(); };
      drive(h, Array.from({ length: 5 * fps + 1 }, (_, i) => 1000 + i * 1000 / fps));
      assert.equal(updates, 300);
      const state = asPlain(h.get(`({ airplanes: Game.airplanes, waypoints: Game.waypoints,
        weather: Game.weatherZones, particles: ParticleSystem.particles, alerts: Game.atc.alerts, time: Game.time })`));
      const finite = value => {
        if (typeof value === 'number') assert.ok(Number.isFinite(value));
        else if (value && typeof value === 'object') Object.values(value).forEach(finite);
      };
      finite(state);
      results.push(state);
    }
    assert.deepEqual(results[1], results[0]);
    assert.deepEqual(results[2], results[0]);
  });
}

test('invalid timestamps recover and decreasing timestamps retain the high-water mark', () => {
  for (const invalid of [NaN, Infinity, -Infinity]) {
    const h = createHarness({ boot: true }); const game = h.get('Game');
    game.draw = () => {};
    drive(h, [1000, 1020, invalid, 5000, 5020]);
    near(game.time, 2 * 1000 / 60);
    assert.ok(Number.isFinite(game.accumulator));
  }
  const h = createHarness({ boot: true }); const game = h.get('Game'); game.draw = () => {};
  drive(h, [1000, 1020, 900, 1010, 1020]);
  near(game.time, 1000 / 60);
  drive(h, [1040]);
  near(game.time, 2 * 1000 / 60);
});

test('visibility, pause, rendering, statistics, alerts and effects use their intended clocks', () => {
  const h = createHarness({ boot: true }); const game = h.get('Game');
  const doc = h.get('document');
  let draws = 0, stats = 0, updates = 0, alerts = 0, effects = 0;
  game.draw = () => draws++;
  h.get('UI').updateStats = () => stats++;
  const update = game.update.bind(game); game.update = () => { updates++; update(); };
  const atc = game.atc.update.bind(game.atc); game.atc.update = a => { alerts++; return atc(a); };
  const particles = h.get('ParticleSystem'); const effectUpdate = particles.update.bind(particles);
  particles.update = () => { effects++; effectUpdate(); };
  drive(h, [1000, 1005, 1040]);
  assert.equal(updates, 2);
  doc.hidden = true; doc.listeners.get('visibilitychange')();
  drive(h, [100000, 110000]); assert.equal(updates, 2);
  doc.hidden = false; doc.listeners.get('visibilitychange')();
  drive(h, [200000, 200020]); assert.equal(updates, 3);
  game.togglePause(); drive(h, [300000]);
  game.togglePause(); drive(h, [400000, 400020]);
  assert.deepEqual([updates, alerts, effects, draws, stats], [4, 4, 4, 10, 10]);
  assert.equal(h.queuedFrames.length, 1);
});

test('update ignores arbitrary durations and always advances one fixed physical step', () => {
  const h = createHarness({ boot: true }); const game = h.get('Game');
  for (const duration of [0, 1, 100000, NaN, Infinity, -1]) game.update(duration);
  near(game.time, 6 * 1000 / 60);
  assert.ok(game.airplanes.every(a => a.trail.length === 6));
});

test('non-uniform resizing preserves vectors, radii, normalized positions and radar mapping', () => {
  const h = createHarness({ boot: true, observeResize: true }); const game = h.get('Game');
  assert.equal(h.window.observed.length, 2);
  const plane = game.airplanes[0]; plane.pos.set(400, 250); plane.vel.set(2, 3); plane.acc.set(.1, .2);
  const radius = game.weatherZones[0].radius;
  h.canvas.rect.width = 500; h.canvas.rect.height = 1250;
  h.window.resizeCallback();
  assert.deepEqual(asPlain(plane.pos), { x: 200, y: 500 });
  assert.deepEqual(asPlain(plane.vel), { x: 2, y: 3 });
  assert.deepEqual(asPlain(plane.acc), { x: .1, y: .2 });
  assert.equal(game.weatherZones[0].radius, radius);
  near(plane.pos.x / game.width, .4); near(plane.pos.y / game.height, .4);
  plane.pos.x = -10;
  h.window.resizeCallback(); assert.equal(plane.pos.x, -10, 'unchanged size must not clip');
  h.canvas.rect.width = 1000; h.canvas.rect.height = 625;
  h.window.resizeCallback(); assert.equal(plane.pos.x, 0, 'out-of-bounds history is intentionally clipped');
  near(plane.pos.y, 250);
});

test('tiny or invalid dimensions and DPR keep canvas and new entity positions finite', () => {
  const h = createHarness({ boot: true, randomValues: seededRandom() }); const game = h.get('Game');
  for (const dpr of [NaN, Infinity, -Infinity, -1, 0, .01, 3]) {
    for (const size of [0, 1, 50, NaN, Infinity, -10]) {
      h.window.devicePixelRatio = dpr;
      h.canvas.rect.width = size; h.canvas.rect.height = size;
      h.radar.rect.width = size; h.radar.rect.height = size;
      game.resize(); game.clearAll();
      game.addAirplane(); game.addWaypoint(); game.addWeather();
      game.addAirplane(NaN, Infinity);
      for (const entity of [...game.airplanes, ...game.waypoints, ...game.weatherZones]) {
        assert.ok(Number.isFinite(entity.pos.x) && Number.isFinite(entity.pos.y));
        assert.ok(entity.pos.x >= 0 && entity.pos.x <= game.width);
        assert.ok(entity.pos.y >= 0 && entity.pos.y <= game.height);
      }
      for (const dimension of [h.canvas.width, h.canvas.height, h.radar.width, h.radar.height]) {
        assert.ok(Number.isFinite(dimension) && dimension >= 1);
      }
    }
  }
});

function debugContext() {
  const calls = [];
  const ctx = { calls };
  for (const name of ['save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'ellipse', 'arc', 'fill', 'fillText']) {
    ctx[name] = (...args) => calls.push([name, ...args]);
  }
  return ctx;
}

test('Wander visualization toggle and mode/pause explanations reflect the active simulation', () => {
  const h = createHarness({ boot: true }); const game = h.get('Game'); const ui = h.get('UI');
  assert.equal(game.settings.showWanderDebug, false);
  h.elements.get('showWanderDebug').dispatch('change', { target: { checked: true } });
  assert.equal(game.settings.showWanderDebug, true);
  game.update(); ui.updateStats(game.airplanes, [], 60);
  assert.match(h.elements.get('debugStatus').textContent, /Avion observé/);
  game.togglePause(); ui.updateStats(game.airplanes, [], 60);
  assert.equal(h.elements.get('simulationStatus').textContent, 'En pause');
  for (const mode of ['wander', 'waypoints', 'formation', 'patrol']) {
    game.setMode(mode); game.update(); ui.updateStats(game.airplanes, [], 60);
    assert.ok(h.elements.get('modeDescription').textContent.length > 50);
    assert.equal(Boolean(game.airplanes[0].wanderDebug), mode === 'wander' || mode === 'formation');
  }
  h.elements.get('showWanderDebug').dispatch('change', { target: { checked: false } });
  assert.equal(game.settings.showWanderDebug, false);
});

test('drawing Wander snapshots changes neither trajectories nor random consumption in all four modes', () => {
  for (const mode of ['wander', 'waypoints', 'formation', 'patrol']) {
    const results = [];
    for (const visible of [false, true]) {
      let randomCalls = 0; const random = seededRandom();
      const h = createHarness({ boot: true, randomValues: () => { randomCalls++; return random(); } });
      const game = h.get('Game'); game.setMode(mode); game.settings.showWanderDebug = visible;
      const ctx = debugContext();
      for (let i = 0; i < 120; i++) {
        game.update();
        const before = randomCalls;
        if (visible) for (let render = 0; render < 3; render++) game.airplanes[0].showWanderDebug(ctx);
        assert.equal(randomCalls, before, 'render must never draw randomness');
      }
      results.push({ randomCalls, state: asPlain(game.airplanes) });
    }
    assert.deepEqual(results[1], results[0]);
  }
});

test('snapshot records exact inherited target, pre-integration velocity, individual and applied forces', () => {
  const h = createHarness({ boot: true, randomValues: seededRandom() }); const game = h.get('Game');
  const a = game.airplanes[0]; a.pos.set(300, 200); a.vel.set(3, 0);
  let applied; const apply = a.applyForce.bind(a); a.applyForce = f => { applied = f.copy(); apply(f); };
  game.update(); const d = a.wanderDebug;
  assert.deepEqual(asPlain(d.origin), { x: 300, y: 200 });
  assert.deepEqual(asPlain(d.velocity), { x: 3, y: 0 });
  assert.deepEqual(asPlain(d.center), { x: 380, y: 200 });
  near(d.target.x, d.center.x + Math.cos(a.wanderAngle) * a.circleRadius);
  near(d.target.y, d.center.y + Math.sin(a.wanderAngle) * a.circleRadius);
  const expected = h.get('p5.Vector').sub(d.target, d.origin).setMag(a.maxSpeed).sub(d.velocity).limit(a.maxForce);
  assert.deepEqual(asPlain(d.wanderForce), asPlain(expected));
  assert.deepEqual(asPlain(d.totalForce), asPlain(applied));
  assert.ok(d.totalForce.mag() <= a.maxForce + 1e-12);
  const ctx = debugContext(); const before = asPlain(d); a.showWanderDebug(ctx);
  assert.deepEqual(asPlain(d), before);
  assert.ok(ctx.calls.some(c => c[0] === 'ellipse' && c[1] === d.center.x && c[3] === a.circleRadius));
  assert.ok(ctx.calls.some(c => c[0] === 'arc' && c[1] === d.target.x && c[2] === d.target.y));
});

test('paused Wander diagram resizes affinely without scaling physical vectors or changing randomness', () => {
  const h = createHarness({ boot: true }); const game = h.get('Game');
  game.settings.showWanderDebug = true; game.update(); game.togglePause();
  const a = game.airplanes[0]; const before = asPlain(a.wanderDebug);
  h.canvas.rect.width = 500; h.canvas.rect.height = 1250; game.resize();
  const d = a.wanderDebug;
  for (const key of ['origin', 'center', 'target']) {
    near(d[key].x, before[key].x * .5); near(d[key].y, before[key].y * 2);
  }
  near(d.radiusX, before.radiusX * .5); near(d.radiusY, before.radiusY * 2);
  for (const key of ['velocity', 'wanderForce', 'totalForce']) assert.deepEqual(asPlain(d[key]), before[key]);
  a.showWanderDebug(debugContext());
  game.togglePause(); game.update();
  assert.equal(a.wanderDebug.radiusX, a.circleRadius);
  assert.equal(a.wanderDebug.radiusY, a.circleRadius);
});

test('formation follower slots are paired, distinct and nonzero without changing Arrive', () => {
  const h = createHarness({ boot: true }); const game = h.get('Game');
  const leader = game.airplanes[0]; leader.pos.set(400, 300); leader.vel.set(4, 0);
  const targets = [];
  for (const follower of game.airplanes.slice(1)) {
    follower.arrive = (target, radius) => { assert.equal(radius, 60); targets.push(asPlain(target)); return new P5Vector(); };
    follower.formationFlight(game.airplanes);
  }
  assert.deepEqual(targets, [
    { x: 350, y: 260 }, { x: 350, y: 340 }, { x: 300, y: 220 },
    { x: 300, y: 380 }, { x: 250, y: 180 }
  ]);
  assert.equal(new Set(targets.map(p => JSON.stringify(p))).size, targets.length);
});

test('pedagogical HTML supplies associated labels, toggle and explanations without remote assets', () => {
  const html = readFileSync(path.join(tdRoot, 'index.html'), 'utf8');
  for (const id of ['speed', 'force', 'sep', 'dist', 'radius', 'angle']) assert.ok(html.includes(`for="${id}"`));
  assert.match(html, /id="showWanderDebug"/);
  assert.match(html, /id="simulationStatus"/);
  assert.match(html, /rad\/pas/);
  assert.match(html, /repère du monde/);
});

test('Game draws the observation for exactly the first plane only when enabled', () => {
  const h = createHarness({ boot: true }); const game = h.get('Game');
  const ctx = debugContext();
  ctx.createLinearGradient = () => ({ addColorStop() {} }); ctx.fillRect = () => {};
  game.ctx = ctx; game.settings.showWeather = false; game.settings.showWaypoints = false;
  game.drawRadar = () => {}; game.atc.draw = () => {}; h.get('ParticleSystem').draw = () => {};
  let observations = 0;
  game.airplanes.forEach((a, i) => {
    a.show = () => {};
    a.showWanderDebug = () => { assert.equal(i, 0); observations++; };
  });
  game.draw(); assert.equal(observations, 0);
  game.settings.showWanderDebug = true; game.draw(); assert.equal(observations, 1);
  game.settings.showWanderDebug = false; game.draw(); assert.equal(observations, 1);
  game.clearAll(); game.settings.showWanderDebug = true; game.draw();
});
