import test from 'node:test';
import assert from 'node:assert/strict';
import math from '../projection.js';
import controller from '../projection-controller.js';
const O = { x: 0, y: 0 };
const near = (a, b, eps = 1e-12) => assert.ok(Math.abs(a - b) <= eps, `${a} != ${b}`);
const xy = (a, b, eps) => { near(a.x, b.x, eps); near(a.y, b.y, eps); };

for (const [name, P, B, scalar, H, t, Q] of [
  ['parallel', { x: 3, y: 0 }, { x: 5, y: 0 }, 3, { x: 3, y: 0 }, .6, { x: 3, y: 0 }],
  ['perpendicular', { x: 0, y: 4 }, { x: 5, y: 0 }, 0, O, 0, O],
  ['negative', { x: -3, y: 4 }, { x: 5, y: 0 }, -3, { x: -3, y: 0 }, -.6, O],
  ['beyond', { x: 8, y: 4 }, { x: 5, y: 0 }, 8, { x: 8, y: 0 }, 1.6, { x: 5, y: 0 }],
  ['oblique', { x: 5, y: 0 }, { x: 3, y: 4 }, 3, { x: 1.8, y: 2.4 }, .6, { x: 1.8, y: 2.4 }]
]) test(`exact ${name} projection and closest segment point`, () => {
  const d = math.project(O, P, B);
  assert.equal(d.valid, true); near(d.scalar, scalar); xy(d.H, H); near(d.t, t); xy(d.segmentPoint, Q);
  near(d.segmentDistance, Math.hypot(P.x - Q.x, P.y - Q.y));
  assert.ok(d.segmentDistance + 1e-12 >= d.distance);
});

test('translated origin, zero source and segment endpoint boundaries', () => {
  const d = math.project({ x: 10, y: 20 }, { x: 13, y: 24 }, { x: 15, y: 20 });
  xy(d.vector, { x: 3, y: 0 }); xy(d.H, { x: 13, y: 20 }); near(d.distance, 4);
  for (const t of [0, 1]) {
    const q = math.project(O, { x: 5 * t, y: 0 }, { x: 5, y: 0 });
    near(q.clampedT, t); near(q.distance, 0); near(q.segmentDistance, 0);
  }
});

test('orthogonal residual, decomposition and dot formula hold on deterministic varied inputs', () => {
  let seed = 1234;
  const rand = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32 * 100 - 50; };
  for (let i = 0; i < 300; i++) {
    const d = math.project({ x: rand(), y: rand() }, { x: rand(), y: rand() }, { x: rand(), y: rand() });
    assert.ok(d.valid);
    near(d.residual.x * d.u.x + d.residual.y * d.u.y, 0, 1e-12);
    xy({ x: d.vector.x + d.residual.x, y: d.vector.y + d.residual.y }, d.a);
    near(d.t, (d.a.x * d.b.x + d.a.y * d.b.y) / (d.b.x ** 2 + d.b.y ** 2));
    near(Math.hypot(d.u.x, d.u.y), 1);
  }
});

test('positive scaling preserves line projection; reversing direction flips scalar only', () => {
  const d = math.project(O, { x: 8, y: 3 }, { x: 3, y: 4 });
  for (const scale of [.001, 2, 1000, -1]) {
    const other = math.project(O, { x: 8, y: 3 }, { x: 3 * scale, y: 4 * scale });
    xy(other.H, d.H); xy(other.vector, d.vector); near(other.distance, d.distance);
    near(other.scalar, d.scalar * Math.sign(scale)); near(other.t, d.t / scale);
  }
});

test('zero direction distinguishes undefined line from a valid collapsed segment', () => {
  const d = math.project({ x: 10, y: 20 }, { x: 13, y: 24 }, { x: 10, y: 20 });
  assert.equal(d.status, 'degenerate'); assert.equal(d.valid, false);
  for (const key of ['scalar', 'H', 't', 'vector', 'u', 'distance', 'clampedT']) assert.equal(d[key], null);
  xy(d.segmentPoint, { x: 10, y: 20 }); assert.equal(d.segmentDistance, 5);
});

test('invalid and unrepresentable coordinates never expose NaN or Infinity', () => {
  const finite = value => {
    if (typeof value === 'number') assert.ok(Number.isFinite(value));
    else if (value && typeof value === 'object') Object.values(value).forEach(finite);
  };
  for (const value of [null, undefined, {}, { x: NaN, y: 1 }, { x: 1, y: Infinity }, { x: '1', y: 2 }]) {
    const d = math.project(O, value, { x: 1, y: 0 }); assert.equal(d.status, 'invalid'); finite(d);
  }
  const d = math.project({ x: -1e308, y: 0 }, { x: 1e308, y: 0 }, O);
  assert.equal(d.status, 'range'); finite(d);
});

test('very small nonzero directions are not arbitrarily classified as zero', () => {
  const d = math.project(O, { x: 1e-150, y: 1e-150 }, { x: 1e-150, y: 0 });
  assert.equal(d.valid, true); assert.equal(d.scalar, 1e-150); assert.equal(d.t, 1);
});

test('inputs are not mutated and snapshots own deeply frozen copies', () => {
  const O = Object.freeze({ x: 1, y: 2 }), P = { x: 4, y: 7 }, B = { x: 8, y: 3 };
  const before = JSON.stringify([O, P, B]); const d = math.project(O, P, B);
  assert.equal(JSON.stringify([O, P, B]), before);
  P.x = 100; assert.equal(d.P.x, 4);
  assert.throws(() => { d.H.x = 100; }, TypeError);
});

test('controller scenarios, manual construction, controls and reset are deterministic', () => {
  const c = controller.create(); const initial = c.snapshot;
  for (const name of controller.scenarios) {
    c.load(name); assert.equal(c.snapshot.result.valid, name !== 'zero');
    const before = c.snapshot.result;
    c.guide(true); for (let i = 1; i <= 6; i++) { c.advance(i); assert.equal(c.snapshot.step, i); assert.deepEqual(c.snapshot.result, before); }
  }
  c.load('parallel'); c.direction(90, 200);
  near(c.snapshot.result.b.x, 0); near(c.snapshot.result.b.y, 200);
  c.move('B', 480, 350); near(c.snapshot.angle, 0); near(c.snapshot.result.length, 300);
  c.option('vectors', false); c.select('B'); c.reset(); assert.deepEqual(c.snapshot, initial);
});

test('controller handles zero length, bounds and invalid controls without corrupting geometry', () => {
  const c = controller.create(); c.direction(45, 0); assert.equal(c.snapshot.result.status, 'degenerate');
  c.direction(c.snapshot.angle, 100); near(c.snapshot.angle, 45);
  c.move('P', -100, 9999); xy(c.snapshot.result.P, { x: 40, y: 600 });
  const before = c.snapshot;
  c.move('P', NaN, 3); c.direction(Infinity, 5); c.advance(NaN); assert.equal(c.snapshot, before);
  c.direction(0, 1200); assert.ok(c.snapshot.result.B.x <= 960);
});
