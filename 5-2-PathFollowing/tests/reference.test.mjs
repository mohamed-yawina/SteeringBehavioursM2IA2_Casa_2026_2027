import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Vector, loadReference } from './reference-harness.mjs';
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) <= 1e-12, `${actual} != ${expected}`);

test('orthogonal projection supports translation and an oblique direction without mutating inputs', () => {
  const { findProjection } = loadReference();
  const O = new Vector(10, 20), P = new Vector(15, 20), B = new Vector(13, 24);
  const before = JSON.stringify([O, P, B]); const H = findProjection(O, P, B);
  near(H.x, 11.8); near(H.y, 22.4);
  near((P.x - H.x) * (B.x - O.x) + (P.y - H.y) * (B.y - O.y), 0);
  assert.equal(JSON.stringify([O, P, B]), before);
});

test('projection uses an infinite line before the start and beyond the end', () => {
  const { findProjection } = loadReference();
  for (const x of [-50, 300]) {
    const H = findProjection(new Vector(0, 0), new Vector(x, 50), new Vector(200, 0));
    near(H.x, x); near(H.y, 0);
  }
});

test('follow predicts exactly twenty steps ahead and returns the inherited Seek force', () => {
  const h = loadReference(); const v = new h.Vehicle(100, 100);
  v.vel.set(2, 1); const path = new h.Path(0, 400, 1200, 400);
  const original = h.context.findProjection; let future, goal, seeks = 0;
  h.context.findProjection = (origin, point, end) => { future = point.copy(); return original(origin, point, end); };
  const seek = v.seek.bind(v);
  v.seek = target => { seeks++; goal = target.copy(); return seek(target); };
  const force = v.follow(path);
  assert.deepEqual([future.x, future.y], [140, 120]);
  assert.deepEqual([goal.x, goal.y], [140, 400]); assert.equal(seeks, 1);
  const expected = seek(goal); near(force.x, expected.x); near(force.y, expected.y);
  assert.deepEqual([v.pos.x, v.pos.y, v.vel.x, v.vel.y], [100, 100, 2, 1]);
});

test('corridor radius is forty and correction is strictly outside its boundary', () => {
  const { Vehicle, Path } = loadReference(); const path = new Path(0, 400, 1200, 400);
  assert.equal(path.radius, 40);
  for (const distance of [0, 39.999, 40, 40.001, 300]) {
    const v = new Vehicle(100, 400 - distance); v.vel.x = 2;
    let seeks = 0; const seek = v.seek.bind(v); v.seek = target => { seeks++; return seek(target); };
    const force = v.follow(path);
    assert.equal(seeks, distance > 40 ? 1 : 0);
    if (distance <= 40) assert.equal(force.mag(), 0);
    assert.ok(force.mag() <= v.maxForce + 1e-12);
  }
});

test('stationary vehicle inside corridor gets no propulsion; outside it can steer', () => {
  const { Vehicle, Path } = loadReference(); const path = new Path(0, 400, 1200, 400);
  const inside = new Vehicle(100, 400); assert.equal(inside.follow(path).mag(), 0);
  const outside = new Vehicle(100, 100); assert.ok(outside.follow(path).y > 0);
});

test('authorized degenerate-path contract: undefined projection and zero correction', () => {
  const { Vehicle, Path, findProjection } = loadReference();
  const path = new Path(20, 30, 20, 30), v = new Vehicle(100, 100);
  const H = findProjection(path.start, new Vector(100, 100), path.end);
  assert.equal(H, null);
  const force = v.follow(path); assert.ok(Number.isFinite(force.x) && Number.isFinite(force.y));
  assert.equal(force.mag(), 0);
  assert.equal(v.copyFollowDiagnostics().status, 'undefined');
});

test('Vehicle integrates once, limits speed and clears acceleration', () => {
  const { Vehicle } = loadReference(); const v = new Vehicle(10, 20);
  v.vel.set(100, 0); v.applyForce(new Vector(1, 0)); v.update();
  assert.equal(v.maxSpeed, 6); assert.equal(v.maxForce, .1);
  assert.deepEqual([v.pos.x, v.pos.y, v.vel.mag(), v.acc.mag()], [16, 20, 6, 0]);
});

test('supplied draw applies and integrates exactly once, preserving follow/apply/edges/update order', () => {
  const h = loadReference(); h.context.setup(); const v = h.get('vehicle');
  const calls = [];
  for (const name of ['follow', 'applyForce', 'edges', 'update']) {
    const original = v[name].bind(v); v[name] = (...args) => { calls.push(name); return original(...args); };
  }
  h.context.draw(); assert.deepEqual(calls, ['follow', 'applyForce', 'edges', 'update']);
});

test('five-step reference trajectory is preserved as a numerical fixture', () => {
  const h = loadReference(); h.context.setup();
  for (let i = 0; i < 5; i++) h.context.draw();
  const v = h.get('vehicle');
  near(v.pos.x, 109.69932819010883); near(v.pos.y, 101.46955488527777);
  near(v.vel.x, 1.8993907760856703); near(v.vel.y, .4897724857991111);
  near(v.acc.mag(), 0);
});

test('edges uses strict thresholds on all four sides and preserves velocity', () => {
  const { Vehicle } = loadReference(); const v = new Vehicle(0, 0); v.vel.set(2, -1);
  for (const [x, y, expectedX, expectedY] of [
    [1216, 100, 1216, 100], [1217, 100, -16, 100], [-16, 100, -16, 100], [-17, 100, 1216, 100],
    [100, 816, 100, 816], [100, 817, 100, -16], [100, -16, 100, -16], [100, -17, 100, 816],
    [1217, -17, -16, 816]
  ]) {
    v.pos.set(x, y); v.edges(); assert.deepEqual([v.pos.x, v.pos.y], [expectedX, expectedY]);
    assert.deepEqual([v.vel.x, v.vel.y], [2, -1]);
  }
});

test('local HTML scripts and stylesheet exist and reference classes precede the sketch', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const html = readFileSync(path.join(root, 'index.html'), 'utf8');
  for (const match of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    if (/^https?:/.test(match[1])) continue;
    assert.ok(existsSync(path.join(root, match[1])));
  }
  assert.ok(html.indexOf('src="vehicle.js"') < html.indexOf('src="sketch.js"'));
  assert.ok(html.indexOf('src="path.js"') < html.indexOf('src="sketch.js"'));
});
