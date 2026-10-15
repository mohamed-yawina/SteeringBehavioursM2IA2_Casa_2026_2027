import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector(this.x, this.y); }
  mult(n) { this.x *= n; this.y *= n; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  static random2D() { return new Vector(1, 0); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
}

class Element {
  constructor(value = '') { this.value = value; this.listeners = {}; this.textContent = ''; }
  addEventListener(type, callback) { (this.listeners[type] ||= []).push(callback); }
  dispatch(type) { for (const fn of this.listeners[type] || []) fn({ target: this }); }
  click() { this.dispatch('click'); }
}

function setup() {
  const elements = new Map([
    ['hunter-count', new Element('1')], ['hunter-count-value', new Element()],
    ['prey-count', new Element('5')], ['prey-count-value', new Element()],
    ['difficulty-select', new Element('normal')], ['challenge-reset', new Element()],
    ['challenge-fps', new Element()], ['challenge-captures', new Element()],
    ['challenge-time', new Element()], ['challenge-distance', new Element()],
    ['challenge-last-capture', new Element()],
  ]);
  const context = vm.createContext({
    document: { getElementById: id => elements.get(id) },
    createVector: (x, y) => new Vector(x, y), p5: { Vector },
    color: (...components) => components,
    random: (min, max) => max === undefined ? (min === undefined ? 0.5 : min / 2) : (min + max) / 2,
    randomSeed() {}, PI: Math.PI, TWO_PI: Math.PI * 2, width: 1200, height: 800, frameRate: () => 59.7,
  });
  for (const file of ['vehicle.js', 'target-selection.js', 'target.js', 'combo.js', 'audio.js', 'ui.js', 'sketch.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), context);
  }
  vm.runInContext('soundFX = null; musicPlayer = null;', context);
  return { context, elements };
}

test('challenge count and difficulty controls configure a fresh game without replacing game systems', () => {
  const { context, elements } = setup();
  vm.runInContext('bindChallengeControls()', context);
  elements.get('hunter-count').value = '4';
  elements.get('hunter-count').dispatch('input');
  elements.get('prey-count').value = '8';
  elements.get('prey-count').dispatch('input');
  elements.get('difficulty-select').value = 'hard';
  elements.get('difficulty-select').dispatch('change');
  elements.get('challenge-reset').click();

  const state = vm.runInContext('({ hunters, hunter, targets, gameState })', context);
  assert.equal(state.hunters.length, 4);
  assert.equal(state.hunter, state.hunters[0]);
  assert.equal(state.targets.length, 8);
  assert.equal(state.gameState, 'playing');
  assert.ok(state.hunters.every(agent => agent.maxSpeed === 8.4));
  assert.ok(state.targets.every(target => target.baseMaxSpeed === target.maxSpeed));
  assert.equal(elements.get('hunter-count-value').textContent, '4');
  assert.equal(elements.get('prey-count-value').textContent, '8');
  vm.runInContext('gameTime = 90; caught = 2; captureHistory = [{ frame: 60 }]; updateChallengeStats()', context);
  assert.equal(elements.get('challenge-fps').textContent, '60');
  assert.equal(elements.get('challenge-captures').textContent, '2');
  assert.equal(elements.get('challenge-time').textContent, '1.5 s');
  assert.equal(elements.get('challenge-last-capture').textContent, '1.0 s');
});

test('toroidal wrap clears trails so they do not draw a line across the canvas', () => {
  const { context } = setup();
  const agent = { pos: { x: 1201, y: 50 }, trail: [{}], edges() { this.pos.x = 0; } };
  context.wrapAgentWithoutTrailSeam(agent);
  assert.equal(agent.trail.length, 0);
});
