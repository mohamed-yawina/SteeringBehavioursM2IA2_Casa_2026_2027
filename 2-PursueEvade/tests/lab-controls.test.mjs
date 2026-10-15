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
  heading() { return Math.atan2(this.y, this.x); }
  rotate(a) { const x = this.x, y = this.y; this.x = x * Math.cos(a) - y * Math.sin(a); this.y = x * Math.sin(a) + y * Math.cos(a); return this; }
  static add(a, b) { return new Vector(a.x + b.x, a.y + b.y); }
  static sub(a, b) { return new Vector(a.x - b.x, a.y - b.y); }
  static mult(v, n) { return new Vector(v.x * n, v.y * n); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
  static random2D() { return new Vector(1, 0); }
  static angleBetween(a, b) { const d = a.mag() * b.mag(); return d ? Math.acos(Math.max(-1, Math.min(1, (a.x * b.x + a.y * b.y) / d))) : 0; }
}

class Element {
  constructor(id, value = '', checked = false) {
    this.id = id; this.value = value; this.checked = checked; this.textContent = '';
    this.listeners = {}; this.dataset = {}; this.classList = { toggle() {} };
  }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatch(type) { for (const callback of this.listeners[type] || []) callback({ target: this }); }
  getBoundingClientRect() { return { width: 800, height: 460 }; }
  click() { this.dispatch('click'); }
}

function setup() {
  const defaults = {
    'scenario-select': 'single', 'behavior-select': 'pursuit',
    'prediction-slider': '10', 'speed-slider': '7', 'force-slider': '0.6',
    'prey-speed-slider': '3', 'prey-force-slider': '0.35', 'vision-slider': '200', 'sim-speed-slider': '1',
  };
  const ids = [
    ...Object.keys(defaults), 'prediction-output', 'speed-output', 'force-output',
    'prey-speed-output', 'prey-force-output', 'vision-output', 'sim-speed-output', 'vectors-toggle',
    'prediction-toggle', 'trails-toggle', 'vision-toggle', 'pause-button',
    'resume-button', 'step-button', 'reset-button', 'export-button', 'fps-value',
    'frame-value', 'capture-value', 'distance-value', 'prediction-value',
    'mean-distance', 'capture-time', 'selected-agent', 'simulation-canvas',
  ];
  const elements = new Map(ids.map(id => [id, new Element(id, defaults[id] || '', id.endsWith('toggle'))]));
  const document = { getElementById: id => elements.get(id), createElement: () => new Element('link') };
  const noOp = () => {};
  const context = vm.createContext({
    document, console, Blob: class {}, URL: { createObjectURL: () => '', revokeObjectURL: noOp },
    createVector: (x, y) => new Vector(x, y), p5: { Vector },
    color: (...levels) => ({ levels }), red: c => c.levels[0], green: c => c.levels[1], blue: c => c.levels[2],
    random: (min = 1, max) => max === undefined ? min / 2 : (min + max) / 2,
    randomSeed: noOp, TWO_PI: Math.PI * 2, PI: Math.PI,
    map: (n, a, b, c, d) => c + (n - a) * (d - c) / (b - a),
    constrain: (n, a, b) => Math.max(a, Math.min(b, n)), sin: Math.sin,
    width: 800, height: 460, frameCount: 0, frameRate: () => 60,
    drawingContext: { setLineDash: noOp },
    background: noOp, stroke: noOp, strokeWeight: noOp, line: noOp, noStroke: noOp,
    fill: noOp, circle: noOp, noFill: noOp, push: noOp, pop: noOp, translate: noOp,
    rotate: noOp, triangle: noOp, text: noOp, textAlign: noOp, textSize: noOp,
    CENTER: 0,
  });
  for (const file of ['vehicle.js', 'target-selection.js', 'target.js', 'bouncingBall.js', 'pursuit-agent.js', 'lab-renderer.js', 'pursuit-lab.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  }
  return { lab: vm.runInContext('PursuitLab', context), elements };
}

test('lab pause, resume, single-step, speed control and reset work through controls', () => {
  const { lab, elements } = setup();
  lab.init();
  lab.drawFrame(60);
  assert.equal(lab.state.frame, 1);
  elements.get('pause-button').click();
  lab.drawFrame(60);
  assert.equal(lab.state.frame, 1);
  elements.get('step-button').click();
  lab.drawFrame(60);
  assert.equal(lab.state.frame, 2);
  elements.get('sim-speed-slider').value = '3';
  elements.get('sim-speed-slider').dispatch('input');
  elements.get('resume-button').click();
  lab.drawFrame(60);
  assert.equal(lab.state.frame, 5);
  elements.get('reset-button').click();
  assert.equal(lab.state.frame, 0);
  assert.equal(lab.state.systems.length, 1);
});

test('comparison scenarios reset matched initial states and expose distinct behaviors', () => {
  const { lab, elements } = setup();
  lab.init();
  elements.get('scenario-select').value = 'compare-pursuit';
  elements.get('scenario-select').dispatch('change');
  assert.equal(lab.state.systems.length, 2);
  const [seek, pursuit] = lab.state.systems;
  assert.equal(seek.behavior, 'seek');
  assert.equal(pursuit.behavior, 'pursuit');
  assert.equal(seek.agent.pos.x, 80);
  assert.equal(pursuit.agent.pos.x, 480);
  assert.equal(seek.target.pos.x, pursuit.target.pos.x - 400);
  assert.equal(seek.target.vel.x, pursuit.target.vel.x);
  lab.drawFrame(60);
  assert.ok(pursuit.agent.lastSteering.predictedPosition);

  elements.get('scenario-select').value = 'compare-evade';
  elements.get('scenario-select').dispatch('change');
  assert.deepEqual(Array.from(lab.state.systems, system => system.behavior), ['flee', 'evade']);
});

test('prediction and perception sliders update live and target the selected scenario', () => {
  const { lab, elements } = setup();
  lab.init();
  elements.get('prediction-slider').value = '30';
  elements.get('prediction-slider').dispatch('input');
  elements.get('vision-slider').value = '80';
  elements.get('vision-slider').dispatch('input');
  elements.get('prey-force-slider').value = '0.8';
  elements.get('prey-force-slider').dispatch('input');
  assert.equal(lab.state.predictionFrames, 30);
  assert.equal(lab.state.systems[0].target.visionRadius, 80);
  assert.equal(lab.state.systems[0].target.maxForce, 0.8);
  assert.equal(elements.get('prediction-output').textContent, '30 frames');
});

test('bouncing-ball scenario builds different speeds and pursues the nearest ball', () => {
  const { lab, elements } = setup();
  lab.init();
  elements.get('scenario-select').value = 'bouncing';
  elements.get('scenario-select').dispatch('change');
  const system = lab.state.systems[0];
  assert.equal(system.targets.length, 4);
  assert.equal(system.behavior, 'pursuit');
  assert.ok(new Set(system.targets.map(target => target.maxSpeed)).size > 1);
  lab.drawFrame(60);
  assert.ok(system.agent.lastSteering.predictedPosition);
});
