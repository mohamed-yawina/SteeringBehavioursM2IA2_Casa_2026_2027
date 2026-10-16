import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// Only the vector operations used by the supplied example. Not a physics engine.
export class Vector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; }
  copy() { return new Vector(this.x, this.y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  add(v) { this.x += v.x; this.y += v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  mag() { return Math.hypot(this.x, this.y); }
  normalize() { const length = this.mag(); if (length !== 0) this.mult(1 / length); return this; }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { if (this.mag() > n) this.setMag(n); return this; }
  dot(v) { return this.x * v.x + this.y * v.y; }
  heading() { return Math.atan2(this.y, this.x); }
  static sub(a, b) { return a.copy().sub(b); }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }
}
export function loadReference() {
  const noOp = () => {};
  const context = vm.createContext({
    p5: { Vector }, createVector: (x, y) => new Vector(x, y),
    width: 1200, height: 800, mouseY: 400,
    map: (value, a, b, c, d) => c + (value - a) * (d - c) / (b - a),
    fill: noOp, stroke: noOp, strokeWeight: noOp, noStroke: noOp,
    circle: noOp, line: noOp, push: noOp, pop: noOp,
    translate: noOp, rotate: noOp, triangle: noOp, background: noOp
  });
  context.PathUI = { init: noOp, update: noOp };
  context.PathRenderer = { render: noOp };
  context.createCanvas = (w, h) => {
    context.width = w; context.height = h;
    return { parent: noOp, elt: { addEventListener: noOp, setAttribute: noOp } };
  };
  for (const name of ['vehicle.js', 'path.js', 'path-controller.js', 'sketch.js']) {
    vm.runInContext(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'), context, { filename: name });
  }
  const get = code => vm.runInContext(code, context);
  return { context, get, ...get('({ Vehicle, Path, findProjection })') };
}
