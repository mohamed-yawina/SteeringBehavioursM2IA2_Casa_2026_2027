import './helpers/runtime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeDocument, seededRandom } from './helpers/runtime.js';
import { Simulation } from '../src/simulation/Simulation.js';
import { Interface } from '../src/ui/Interface.js';
import { readFileSync } from 'node:fs';

test('HTML réel : tous les éléments utilisés par Interface existent, sans identifiant dupliqué', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  assert.equal(new Set(ids).size, ids.length);
  const ui = new Interface(new Simulation(), fakeDocument());
  for (const id of Object.keys(ui.elements)) assert.ok(ids.includes(id), `Élément absent : ${id}`);
  ui.dispose();
});

test('boutons réels de Interface : pause/reprise et réinitialisation synchronisent moteur et libellés', () => {
  const world = new Simulation({ rng: seededRandom() }); const root = fakeDocument(); const ui = new Interface(world, root);
  const get = id => root.getElementById(id);
  get('pause').click(); assert.equal(world.paused, true); assert.equal(get('pause').textContent, 'Reprendre');
  assert.equal(get('pause').attributes['aria-pressed'], 'true');
  const time = world.time; world.advance(1); assert.equal(world.time, time);
  get('pause').click(); world.advance(0.1); assert.ok(world.time > time);
  get('pause').click(); get('reset').click(); assert.equal(world.paused, false); assert.equal(world.time, 0);
  assert.equal(get('population').textContent, '36'); assert.equal(get('sim-time').textContent, '00:00');
  assert.equal(get('pause').textContent, 'Pause');
  ui.dispose(); get('pause').click(); assert.equal(world.paused, false);
});

test('interface : temps actif, extinction, énergie moyenne et option perception', () => {
  const world = new Simulation({ rng: seededRandom() }); const root = fakeDocument(); const ui = new Interface(world, root);
  world.time = 125; ui.update(); assert.equal(root.getElementById('sim-time').textContent, '02:05');
  root.getElementById('perception').checked = true; assert.equal(ui.showPerception, true);
  world.creatures = []; ui.update(); assert.equal(root.getElementById('extinction').hidden, false);
  assert.equal(root.getElementById('mean-energy').textContent, '0 %');
  assert.equal(root.getElementById('status').textContent, 'Population éteinte');
  ui.dispose();
});

test('lancement applicatif, pipeline de rendu, clics et redimensionnement sans exception (DOM/p5 simulés)', async () => {
  globalThis.window = {};
  const { mountApp } = await import('../src/main.js');
  assert.equal(typeof window.setup, 'function');
  const root = fakeDocument(); const canvas = { setAttribute() {} }; let draws = 0;
  const sketch = { width: 0, height: 0, deltaTime: 1000 / 60, mouseX: 100, mouseY: 100, HALF_PI: Math.PI / 2,
    createCanvas(width, height) { this.width = width; this.height = height; return { elt: canvas, parent() {} }; },
    resizeCanvas(width, height) { this.width = width; this.height = height; },
    pixelDensity() {}, frameRate() {}, background() { draws++; },
  };
  for (const method of ['push', 'pop', 'scale', 'stroke', 'strokeWeight', 'line', 'noFill', 'rect', 'noStroke', 'fill', 'circle', 'translate', 'rotate', 'triangle']) {
    sketch[method] = (...args) => {
      assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value)), `NaN dans ${method}`);
    };
  }
  const app = mountApp(sketch, root);
  for (let i = 0; i < 120; i++) sketch.draw();
  assert.equal(draws, 120); assert.ok(app.world.time > 1.9);
  root.getElementById('perception').checked = true; sketch.draw();
  const count = app.world.food.length; sketch.mousePressed({ target: canvas, shiftKey: false });
  assert.equal(app.world.food.length, count + 1);
  const poison = app.world.poison.length; sketch.mousePressed({ target: canvas, shiftKey: true });
  assert.equal(app.world.poison.length, poison + 1);
  sketch.mousePressed({ target: {} }); assert.equal(app.world.poison.length, poison + 1);
  root.getElementById('pause').click(); sketch.mousePressed({ target: canvas });
  assert.equal(app.world.food.length, count + 1);
  root.getElementById('arena').clientWidth = 440; sketch.windowResized(); assert.equal(sketch.width, 440);
  app.ui.dispose();
});
