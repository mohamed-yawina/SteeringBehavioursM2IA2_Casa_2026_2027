import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = fileURLToPath(new URL('../', import.meta.url));
const read = name => readFileSync(path.join(root, name), 'utf8');

class Element {
  constructor(id = '') { this.id = id; this.handlers = {}; this.children = []; this.dataset = {}; this.attributes = {}; this.value = ''; this.checked = false; this.textContent = ''; }
  addEventListener(type, callback) { (this.handlers[type] ||= []).push(callback); }
  fire(type, event = {}) { for (const fn of this.handlers[type] || []) fn({ target: this, preventDefault() {}, ...event }); }
  setAttribute(name, value) { this.attributes[name] = value; }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.id === 'canvas' ? this.width : 800, height: this.height || 512 }; }
  setPointerCapture(id) { this.capture = id; }
  focus() { this.focused = true; }
}
function harness() {
  const ids = [...read('index.html').matchAll(/id="([^"]+)"/g)].map(m => m[1]);
  const elements = Object.fromEntries(ids.map(id => [id, new Element(id)]));
  const points = ['O', 'P', 'B'].map(name => { const e = new Element(); e.dataset.point = name; return e; });
  const canvas = new Element('canvas');
  const calls = []; let noLoops = 0, redraws = 0;
  const document = { getElementById: id => elements[id], createElement: () => new Element(),
    querySelectorAll: () => points, querySelector: () => canvas };
  const context = vm.createContext({ document, window: { devicePixelRatio: 1 }, console, Math,
    BOLD: 'bold', NORMAL: 'normal', drawingContext: { setLineDash() {} },
    createCanvas(w, h) { context.width = canvas.width = w; context.height = canvas.height = h; return { elt: canvas, parent() {} }; },
    resizeCanvas(w, h) { context.width = canvas.width = w; context.height = canvas.height = h; context.draw(); },
    noLoop() { noLoops++; }, redraw() { redraws++; context.draw(); }, pixelDensity() {}
  });
  for (const name of ['background', 'stroke', 'strokeWeight', 'line', 'push', 'pop', 'translate', 'rotate', 'scale', 'noStroke', 'fill', 'triangle', 'circle', 'textSize', 'textStyle', 'text', 'noFill']) {
    context[name] = (...args) => calls.push([name, ...args]);
  }
  for (const name of ['projection.js', 'projection-controller.js', 'projection-ui.js', 'sketch.js']) vm.runInContext(read(name), context, { filename: name });
  context.setup(); context.draw();
  return { context, elements, points, canvas, calls, lab: vm.runInContext('projectionLab', context),
    counts: () => ({ noLoops, redraws }) };
}

test('HTML resources exist, dependencies precede the sketch, and no Vehicle or sound is loaded', () => {
  const html = read('index.html');
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (!/^https?:/.test(m[1])) assert.ok(existsSync(path.join(root, m[1])), m[1]);
  }
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  assert.deepEqual(scripts, ['libraries/p5.min.js', 'projection.js', 'projection-controller.js', 'projection-ui.js', 'sketch.js']);
  assert.ok(!html.includes('vehicle.js')); assert.ok(!html.includes('p5.sound.min.js'));
  assert.ok(existsSync(path.join(root, 'libraries/p5.sound.min.js')));
});

test('real UI scenarios, toggles, guide and sliders remain synchronized', () => {
  const h = harness();
  h.elements.scenario.value = 'zero'; h.elements.scenario.fire('change');
  assert.equal(h.lab.snapshot.result.status, 'degenerate'); assert.match(h.elements.status.textContent, /indéfinie/);
  const values = h.elements.readout.children.map(row => row.children[1].textContent);
  assert.ok(values.includes('—')); assert.ok(!values.some(v => /NaN|Infinity/.test(v)));
  h.elements.length.value = '120'; h.elements.length.fire('input'); assert.ok(h.lab.snapshot.result.valid);
  h.elements.angle.value = '90'; h.elements.angle.fire('input'); assert.ok(Math.abs(h.lab.snapshot.angle - 90) < 1e-10);
  h.elements.vectors.checked = false; h.elements.vectors.fire('change'); assert.equal(h.lab.snapshot.options.vectors, false);
  h.elements.guided.checked = true; h.elements.guided.fire('change'); assert.equal(h.lab.snapshot.step, 1);
  assert.equal(h.elements.previous.disabled, true);
  h.elements.next.fire('click'); assert.equal(h.lab.snapshot.step, 2);
  h.elements.reset.fire('click'); assert.equal(h.lab.snapshot.scenario, 'oblique'); assert.equal(h.elements.vectors.checked, true);
});

test('actual pointer drag and keyboard selection move the intended point, including overlap', () => {
  const h = harness(); const p = h.lab.snapshot.result.P;
  h.canvas.fire('pointerdown', { pointerId: 1, clientX: p.x * .8, clientY: p.y * .8, button: 0 });
  h.canvas.fire('pointermove', { pointerId: 1, clientX: 500 * .8, clientY: 220 * .8 });
  assert.equal(h.lab.snapshot.result.P.x, 500); assert.equal(h.lab.snapshot.result.P.y, 220);
  h.canvas.fire('pointerup', { pointerId: 1 });
  h.canvas.fire('pointermove', { pointerId: 1, clientX: 0, clientY: 0 }); assert.equal(h.lab.snapshot.result.P.x, 500);
  h.lab.load('zero'); h.points[2].fire('click'); assert.equal(h.lab.snapshot.selected, 'B');
  h.canvas.fire('keydown', { key: 'ArrowRight', shiftKey: true });
  assert.equal(h.lab.snapshot.result.B.x, 460); assert.equal(h.lab.snapshot.result.O.x, 450);
  assert.ok(h.lab.snapshot.result.valid); assert.equal(h.canvas.focused, true);
});

test('all scenarios and stages render from immutable snapshots without projection recalculation', () => {
  const h = harness();
  for (const name of ['oblique', 'parallel', 'perpendicular', 'negative', 'beyond', 'zero']) {
    h.lab.load(name); h.lab.guide(true);
    for (let step = 1; step <= 6; step++) {
      h.lab.advance(step);
      const state = h.lab.snapshot, before = JSON.stringify(state);
      h.context.ProjectionMath = { project() { throw Error('render must not calculate'); } };
      h.context.draw(); assert.equal(h.lab.snapshot, state); assert.equal(JSON.stringify(state), before);
    }
  }
  assert.equal(h.counts().noLoops, 1);
  assert.ok(!/requestAnimationFrame|setInterval|setTimeout/.test(read('sketch.js')));
});

test('resize changes only the view, never coordinates, results or construction progress', () => {
  const h = harness(); h.lab.guide(true); h.lab.advance(4);
  const state = h.lab.snapshot;
  h.elements['canvas-host'].getBoundingClientRect = () => ({ width: 320 });
  h.context.windowResized(); assert.equal(h.lab.snapshot, state);
  assert.equal(h.canvas.width, 320); assert.equal(h.canvas.height, 320);
  h.elements['canvas-host'].getBoundingClientRect = () => ({ width: 1100 });
  h.context.windowResized(); assert.equal(h.lab.snapshot, state);
});
