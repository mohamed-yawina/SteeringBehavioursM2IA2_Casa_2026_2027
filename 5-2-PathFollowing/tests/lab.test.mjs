import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector, loadReference } from './reference-harness.mjs';
const near = (a, b) => assert.ok(Math.abs(a - b) <= 1e-12, `${a} != ${b}`);
const xy = (v, x, y) => { near(v.x, x); near(v.y, y); };

test('Path inherits Vehicle, has zero limits, and never integrates even if update is called', () => {
  const h = loadReference(), path = new h.Path(10, 20, 600, 400);
  assert.ok(path instanceof h.Vehicle); assert.equal(path.start, path.pos);
  assert.deepEqual([path.maxSpeed, path.maxForce, path.radius], [0, 0, 40]);
  path.vel.set(10, 20); path.acc.set(30, 40);
  const original = h.Vehicle.prototype.update; h.Vehicle.prototype.update = () => assert.fail('static support integrated');
  path.update(); xy(path.start, 10, 20); xy(path.end, 600, 400);
  h.Vehicle.prototype.update = original;
});

test('follow diagnostics are exact, independent of inputs, return value and caller copies', () => {
  const h = loadReference(), v = new h.Vehicle(100, 100), path = new h.Path(0, 400, 1200, 400);
  assert.equal(v.copyFollowDiagnostics(), null); v.vel.set(2, 0);
  const force = v.follow(path), d = v.copyFollowDiagnostics();
  xy(d.origin, 100, 100); xy(d.velocity, 2, 0); xy(d.future, 140, 100); xy(d.target, 140, 400);
  assert.equal(d.distance, 300); assert.equal(d.radius, 40); assert.equal(d.active, true);
  xy(d.force, force.x, force.y);
  force.set(99, 99); v.pos.set(500, 600); path.end.set(100, 200); d.future.set(0, 0);
  const fresh = v.copyFollowDiagnostics(); xy(fresh.origin, 100, 100); xy(fresh.future, 140, 100); xy(fresh.end, 1200, 400);
  assert.ok(fresh.force.mag() <= .1 + 1e-12);
});

test('zero anticipation is accepted and the follow calculation performs no drawing', () => {
  const h = loadReference(), v = new h.Vehicle(100, 100), path = new h.Path(0, 400, 1200, 400);
  v.vel.set(2, 1); v.predictionSteps = 0;
  for (const name of ['circle', 'fill', 'stroke', 'noStroke']) h.context[name] = () => assert.fail('drawing inside follow');
  v.follow(path); const d = v.copyFollowDiagnostics(); xy(d.future, 100, 100); xy(d.target, 100, 400);
  assert.equal(d.predictionSteps, 0);
});

test('invalid coordinates and parameters produce zero force and never misleading defined diagnostics', () => {
  for (const mutate of [v => { v.predictionSteps = NaN; }, v => { v.predictionSteps = -1; },
    v => { v.vel.x = Infinity; }, v => { v.maxForce = Infinity; }, (_v, p) => { p.radius = -1; },
    (_v, p) => { p.end.x = NaN; }, v => { v.vel.set(1e308, 1e308); }]) {
    const h = loadReference(), v = new h.Vehicle(100, 100), p = new h.Path(0, 400, 1200, 400);
    mutate(v, p); const f = v.follow(p); assert.equal(f.mag(), 0); assert.equal(v.copyFollowDiagnostics().status, 'invalid');
  }
});

test('single-step, reset, scenarios and comparison preserve deterministic initial conditions', () => {
  const h = loadReference(), lab = h.get('PathLab').create();
  lab.state.paused = true; lab.frame(); assert.equal(lab.state.tick, 0);
  lab.singleStep(); assert.equal(lab.state.tick, 1);
  lab.state.paused = false; lab.singleStep(); assert.equal(lab.state.tick, 1);
  lab.frame(); assert.equal(lab.state.tick, 2);
  lab.reset(); xy(lab.state.vehicles[0].pos, 100, 100); xy(lab.state.vehicles[0].vel, 2, 0);
  lab.compare(true); const [a, b] = lab.state.vehicles;
  xy(a.pos, b.pos.x, b.pos.y); xy(a.vel, b.vel.x, b.vel.y); assert.deepEqual([a.predictionSteps, b.predictionSteps], [0, 20]);
  lab.step(); assert.notEqual(a.vel.x, b.vel.x);
  for (const name of ['inside', 'threshold', 'outside', 'oblique', 'stopped', 'zero']) {
    lab.setScenario(name); assert.equal(lab.state.tick, 0); assert.ok(lab.state.vehicles.every(v => !v.copyFollowDiagnostics()));
    lab.step(); assert.ok(lab.state.vehicles.every(v => v.copyFollowDiagnostics().status === (name === 'zero' ? 'undefined' : 'defined')));
  }
});

test('controller calls follow/apply/edges/update exactly once per agent including comparisons', () => {
  const h = loadReference(), lab = h.get('PathLab').create(); lab.compare(true);
  for (const v of lab.state.vehicles) {
    const calls = []; for (const name of ['follow', 'applyForce', 'edges', 'update']) {
      const original = v[name].bind(v); v[name] = (...args) => { calls.push(name); return original(...args); };
    }
    v.calls = calls;
  }
  lab.step(); for (const v of lab.state.vehicles) assert.deepEqual(v.calls, ['follow', 'applyForce', 'edges', 'update']);
});

test('parameter and endpoint changes invalidate stale diagnostics without advancing physics', () => {
  const h = loadReference(), lab = h.get('PathLab').create(); lab.step();
  const before = lab.state.vehicles[0].pos.copy();
  lab.setParameter('prediction', 0); assert.equal(lab.state.vehicles[0].predictionSteps, 0);
  assert.equal(lab.state.vehicles[0].copyFollowDiagnostics(), null);
  lab.editEndpoint('end', 600, 300); assert.equal(lab.state.tick, 1); xy(lab.state.vehicles[0].pos, before.x, before.y);
  xy(lab.state.path.end, 600, 300); assert.equal(lab.state.path.start.x, 0);
  lab.setParameter('radius', -100); assert.equal(lab.state.radius, 0);
  lab.setParameter('maxSpeed', NaN); assert.equal(lab.state.maxSpeed, 6);
  lab.setParameter('maxForce', 0); lab.step(); assert.equal(lab.state.vehicles[0].copyFollowDiagnostics().force.mag(), 0);
});
