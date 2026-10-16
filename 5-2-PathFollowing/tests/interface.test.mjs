import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { loadReference } from './reference-harness.mjs';
import vm from 'node:vm';
const read = name => readFileSync(new URL(`../${name}`, import.meta.url), 'utf8');
class Element {
  constructor() { this.value = ''; this.checked = false; this.children = []; this.handlers = {}; this.textContent = ''; }
  addEventListener(type, fn) { (this.handlers[type] ||= []).push(fn); }
  fire(type, event = {}) { for (const fn of this.handlers[type] || []) fn({ target: this, preventDefault() {}, ...event }); }
  setAttribute() {} append(...nodes) { this.children.push(...nodes); } replaceChildren(...nodes) { this.children = nodes; }
  getBoundingClientRect() { return { left: 0, top: 0, width: 600, height: 400 }; }
  setPointerCapture() {} focus() {}
}
function uiHarness() {
  const h = loadReference(), nodes = Object.fromEntries([...read('index.html').matchAll(/id="([^"]+)"/g)].map(m => [m[1], new Element()]));
  h.context.document = { getElementById: id => nodes[id], createElement: () => new Element() };
  const canvas = new Element();
  h.context.createCanvas = (w, height) => { h.context.width = w; h.context.height = height; return { elt: canvas, parent() {} }; };
  for (const name of ['noFill', 'text', 'textSize']) h.context[name] = () => {};
  h.context.drawingContext = { setLineDash() {} };
  for (const file of ['path-renderer.js', 'path-ui.js']) vm.runInContext(read(file), h.context, { filename: file });
  h.context.setup(); h.context.draw();
  return { ...h, nodes, canvas, lab: h.get('pathLab') };
}

test('real DOM bindings preserve pause/step/reset, scenario, sliders and comparison', () => {
  const h = uiHarness(), { lab, nodes } = h;
  nodes.pause.fire('click'); const tick = lab.state.tick;
  h.context.draw(); assert.equal(lab.state.tick, tick);
  nodes.step.fire('click'); h.context.draw(); assert.equal(lab.state.tick, tick + 1);
  nodes.prediction.value = '0'; nodes.prediction.fire('input'); h.context.draw();
  assert.equal(lab.state.vehicles[0].predictionSteps, 0); assert.equal(lab.state.vehicles[0].copyFollowDiagnostics(), null);
  nodes.compare.checked = true; nodes.compare.fire('change'); h.context.draw();
  assert.equal(nodes.prediction.disabled, true); assert.equal(nodes.diagnostics.children.length, 2);
  nodes.scenario.value = 'zero'; nodes.scenario.fire('change'); nodes.step.fire('click'); h.context.draw();
  assert.equal(lab.state.vehicles[0].copyFollowDiagnostics().status, 'undefined');
  assert.match(nodes.diagnostics.children[0].children[1].textContent, /indéfinie/);
  nodes.reset.fire('click'); assert.equal(lab.state.tick, 0); assert.equal(lab.state.scenario, 'zero');
  nodes.resume.fire('click'); h.context.draw(); assert.equal(lab.state.tick, 1);
});

test('real pointer and keyboard interactions edit only the selected endpoint and do not integrate while paused', () => {
  const h = uiHarness(); h.nodes.pause.fire('click');
  const tick = h.lab.state.tick;
  h.canvas.fire('pointerdown', { pointerId: 1, button: 0, clientX: 600, clientY: 200 });
  h.canvas.fire('pointermove', { pointerId: 1, clientX: 500, clientY: 150 });
  h.canvas.fire('pointerup', { pointerId: 1 }); h.context.draw();
  assert.deepEqual([h.lab.state.path.end.x, h.lab.state.path.end.y], [1000, 300]);
  assert.equal(h.lab.state.tick, tick); assert.equal(h.lab.state.vehicles[0].copyFollowDiagnostics(), null);
  h.canvas.fire('keydown', { key: 'ArrowDown', shiftKey: true });
  assert.equal(h.lab.state.path.end.y, 310);
  h.nodes.mousePath.checked = true; h.nodes.mousePath.fire('change');
  h.canvas.fire('pointermove', { pointerId: 2, clientX: 200, clientY: 250 });
  assert.equal(h.lab.state.path.end.y, 500); assert.equal(h.lab.state.tick, tick);
});

test('rendering and readouts never recalculate steering or mutate saved diagnostics', () => {
  const h = uiHarness(); h.lab.state.paused = true;
  const v = h.lab.state.vehicles[0], before = JSON.stringify(v.copyFollowDiagnostics());
  v.follow = v.seek = () => assert.fail('renderer recomputed steering');
  for (let i = 0; i < 3; i++) h.context.draw();
  assert.equal(JSON.stringify(v.copyFollowDiagnostics()), before);
  assert.match(h.nodes.diagnostics.children[0].children[1].textContent, /Correction active/);
});

test('all local resources exist and Vehicle precedes its Path subclass and controllers', () => {
  const html = read('index.html');
  for (const m of html.matchAll(/(?:src|href)="([^"]+)"/g)) if (!/^https?:/.test(m[1])) {
    assert.ok(existsSync(new URL(`../${m[1]}`, import.meta.url)), m[1]);
  }
  const scripts = [...html.matchAll(/<script[^>]*src="([^"]+)"/g)].map(m => m[1]);
  assert.ok(scripts.indexOf('vehicle.js') < scripts.indexOf('path.js'));
  assert.ok(scripts.indexOf('path.js') < scripts.indexOf('path-controller.js'));
  assert.ok(scripts.indexOf('path-ui.js') < scripts.indexOf('sketch.js'));
  assert.equal(html.includes('p5.sound.min.js'), false);
});
