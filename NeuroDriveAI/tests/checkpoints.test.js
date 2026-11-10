import test from 'node:test';
import assert from 'node:assert/strict';
import { vec } from '../src/math/vector.js';
import { checkpointCrossing } from '../src/math/geometry.js';
import { CheckpointManager } from '../src/track/CheckpointManager.js';
import { createOvalTrack, Track } from '../src/track/Track.js';
import { Simulation } from '../src/simulation/Simulation.js';
const gate = x => ({ a: vec(x, -5), b: vec(x, 5), normal: vec(1, 0) });
const manager = () => new CheckpointManager([gate(30), gate(10), gate(20)]);

test('proximity and wrong-way motion never validate a checkpoint', () => {
  const m = manager();
  assert.deepEqual(m.process(vec(9, 0), vec(9.9, 0)), []);
  assert.deepEqual(m.process(vec(11, 0), vec(9, 0)), []);
  assert.equal(m.nextIndex, 1); assert.equal(m.validated, 0);
});
test('finite checkpoint excludes extended line and collinear motion', () => {
  assert.equal(checkpointCrossing(vec(9, 8), vec(11, 8), gate(10)), null);
  assert.equal(checkpointCrossing(vec(10, -2), vec(10, 2), gate(10)), null);
  assert.equal(checkpointCrossing(vec(9, 5), vec(11, 5), gate(10)), .5);
});
test('arrival on line counts once; departure and oscillating same checkpoint do not duplicate', () => {
  const m = manager();
  assert.deepEqual(m.process(vec(9, 0), vec(10, 0)), [1]);
  assert.deepEqual(m.process(vec(10, 0), vec(11, 0)), []);
  m.process(vec(11, 0), vec(9, 0)); m.process(vec(9, 0), vec(11, 0));
  assert.equal(m.validated, 1); assert.equal(m.nextIndex, 2);
});
test('out-of-order checkpoint is ignored and cannot complete a lap', () => {
  const m = manager();
  assert.deepEqual(m.process(vec(19, 0), vec(21, 0)), []);
  assert.deepEqual(m.process(vec(29, 0), vec(31, 0)), []);
  assert.equal(m.laps, 0); assert.equal(m.nextIndex, 1);
});
test('multiple real crossings in one step are processed chronologically without skipping', () => {
  const m = manager(); assert.deepEqual(m.process(vec(0, 0), vec(31, 0)), [1, 2, 0]);
  assert.equal(m.laps, 1); assert.equal(m.nextIndex, 1);
  const disorder = new CheckpointManager([gate(40), gate(20), gate(10)]);
  assert.deepEqual(disorder.process(vec(0, 0), vec(50, 0)), []); assert.equal(disorder.laps, 0);
});
test('finish cannot validate early; reset clears all progress', () => {
  const m = manager(); m.process(vec(29, 0), vec(31, 0)); assert.equal(m.laps, 0);
  m.process(vec(9, 0), vec(11, 0)); m.process(vec(19, 0), vec(21, 0));
  assert.equal(m.laps, 0); m.process(vec(29, 0), vec(31, 0)); assert.equal(m.laps, 1);
  m.reset(); assert.equal(m.laps, 0); assert.equal(m.nextIndex, 1); assert.equal(m.validated, 0);
});
test('two full oval laps require return to actual start/finish after all gates', () => {
  const track = createOvalTrack(), m = new CheckpointManager(track.checkpoints);
  const p = theta => vec(500 + 360 * Math.cos(theta), 350 + 230 * Math.sin(theta));
  let previous = p(.1);
  for (let i = 1; i <= 2000; i++) {
    const theta = .1 + i * (Math.PI * 4) / 2000, next = p(theta);
    m.process(previous, next); previous = next;
    if (theta < 2 * Math.PI - 1e-8) assert.equal(m.laps, 0);
  }
  assert.equal(m.laps, 2); assert.equal(m.validated, track.checkpoints.length * 2); assert.equal(m.nextIndex, 1);
});
test('track geometry is closed, start is after finish and invalid definitions fail', () => {
  const t = createOvalTrack(); assert.equal(t.walls.length, 192);
  assert.equal(t.walls[95].b, t.inner[0]); assert.equal(t.walls.at(-1).b, t.outer[0]);
  assert.ok(t.start.position.y > t.finish.a.y);
  assert.throws(() => createOvalTrack({ count: 13 }));
  assert.throws(() => new Track({ id: 'bad', inner: [vec(), vec(), vec(1, 0)], outer: t.outer, checkpoints: t.checkpoints, start: t.start }));
});
test('collision prevents crediting a gate beyond impact in the integrated simulation', () => {
  const sim = new Simulation(); sim.car.position = vec(0, 0); sim.car.velocity.set(10000, 0); sim.car.maxSpeed = 20000;
  sim.track.walls = [{ a: vec(50, -20), b: vec(50, 20) }];
  sim.checkpoints = new CheckpointManager([gate(100), gate(60)]);
  sim.step(.01, { throttle: 1 });
  assert.equal(sim.car.crashed, true); assert.equal(sim.checkpoints.validated, 0); assert.ok(sim.car.position.x < 50);
});
test('checkpoint before impact is credited, while later gates are not', () => {
  const sim = new Simulation(); sim.car.position = vec(0, 0); sim.car.velocity.set(10000, 0); sim.car.maxSpeed = 20000;
  sim.track.walls = [{ a: vec(80, -20), b: vec(80, 20) }];
  sim.checkpoints = new CheckpointManager([gate(100), gate(20), gate(90)]);
  sim.step(.01, {});
  assert.equal(sim.car.crashed, true); assert.equal(sim.checkpoints.validated, 1); assert.equal(sim.checkpoints.nextIndex, 2);
});
test('pause freezes simulation and reset restores independent complete state', () => {
  const sim = new Simulation(), start = sim.car.position.copy(); sim.paused = true;
  sim.step(.01, { throttle: 1 }); assert.equal(sim.elapsed, 0); assert.equal(sim.car.position.dist(start), 0);
  sim.paused = false; sim.step(.01, { throttle: 1 }); assert.ok(sim.car.speed > 0);
  const old = sim.car; sim.car.crash(); sim.checkpoints.laps = 2; sim.reset();
  assert.notEqual(sim.car, old); assert.equal(sim.car.active, true); assert.equal(sim.checkpoints.laps, 0);
  assert.equal(sim.elapsed, 0); assert.equal(sim.car.distanceTravelled, 0); assert.equal(sim.car.position.dist(start), 0);
});
test('20,000 integrated steps including real collisions, sensors and resets remain finite', () => {
  const sim = new Simulation(); let collisions = 0, activeSteps = 0;
  for (let i = 0; i < 20_000; i++) {
    sim.step(1 / 120, { throttle: .7, steer: .13 }); activeSteps++;
    assert.ok(Number.isFinite(sim.car.position.x) && Number.isFinite(sim.car.orientation));
    for (const r of sim.car.sensors.readings) assert.ok(Number.isFinite(r.distance) && r.distance >= 0 && r.distance <= sim.car.sensors.range);
    if (sim.car.crashed) { collisions++; sim.reset(); }
  }
  assert.equal(activeSteps, 20_000); assert.ok(collisions > 0);
});
