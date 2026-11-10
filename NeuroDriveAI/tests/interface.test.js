import test from 'node:test';
import assert from 'node:assert/strict';

// DOM/Canvas contract test; exercises the real application entry and event wiring.
// This is NOT a browser layout or pixel test.
test('application entry renders, drives, pauses/resumes, resets and hides sensors', async () => {
  class Element {
    constructor() { this.handlers = new Map(); this.textContent = ''; this.checked = true; }
    addEventListener(type, fn) { this.handlers.set(type, fn); }
    removeEventListener(type) { this.handlers.delete(type); }
    setAttribute(name, value) { this[name] = value; }
    blur() {}
    emit(type, extra = {}) { this.handlers.get(type)?.({ currentTarget: this, ...extra }); }
  }
  let strokes = 0;
  const context = {};
  for (const key of ['setTransform', 'fillRect', 'translate', 'scale', 'moveTo', 'lineTo', 'closePath', 'beginPath', 'fill', 'arc', 'save', 'rotate', 'restore', 'fillText']) context[key] = () => {};
  context.stroke = () => strokes++;
  const canvas = { clientWidth: 1000, clientHeight: 700, width: 0, height: 0, getContext: () => context };
  const elements = new Map(['#hud', '#event', '#pause', '#reset', '#sensors'].map(key => [key, new Element()]));
  elements.set('canvas', canvas);
  const doc = new Element(); doc.querySelector = key => elements.get(key); doc.hidden = false;
  const win = new Element(); win.devicePixelRatio = 1;
  const oldDocument = globalThis.document, oldWindow = globalThis.window, oldRaf = globalThis.requestAnimationFrame;
  let queued, now = performance.now();
  globalThis.document = doc; globalThis.window = win;
  globalThis.requestAnimationFrame = fn => { queued = fn; };
  const frame = () => { now += 100; const cb = queued; queued = undefined; cb(now); };
  try {
    await import('../src/main.js');
    frame(); assert.match(elements.get('#hud').textContent, /Vitesse : 0.0.*Active/);
    assert.equal(canvas.width, 1000);
    win.emit('keydown', { code: 'ArrowUp', target: { tagName: 'BODY' }, preventDefault() {} });
    frame(); assert.doesNotMatch(elements.get('#hud').textContent, /Vitesse : 0.0/);
    elements.get('#pause').emit('click'); frame();
    assert.match(elements.get('#hud').textContent, /En pause/); assert.equal(elements.get('#pause').textContent, 'Reprendre');
    const pausedHud = elements.get('#hud').textContent.replace(/FPS : \d+/, 'FPS'); frame();
    assert.equal(elements.get('#hud').textContent.replace(/FPS : \d+/, 'FPS'), pausedHud);
    strokes = 0; frame(); const withRays = strokes;
    elements.get('#sensors').checked = false; strokes = 0; frame(); assert.ok(strokes < withRays);
    elements.get('#pause').emit('click'); frame(); assert.match(elements.get('#hud').textContent, /Active/);
    elements.get('#reset').emit('click'); frame(); assert.match(elements.get('#hud').textContent, /Vitesse : 0.0.*Tours : 0.*Distance : 0 px/);
    win.emit('blur'); frame(); assert.match(elements.get('#hud').textContent, /En pause/);
    elements.get('#reset').emit('click'); doc.hidden = true; doc.emit('visibilitychange'); frame();
    assert.match(elements.get('#hud').textContent, /En pause/);
  } finally {
    globalThis.document = oldDocument; globalThis.window = oldWindow; globalThis.requestAnimationFrame = oldRaf;
  }
});
