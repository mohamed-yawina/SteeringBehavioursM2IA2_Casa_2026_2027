import test from 'node:test';
import assert from 'node:assert/strict';
import { vec } from '../src/math/vector.js';
import { raySegment, pointSegmentDistance, sweepDiskSegment, firstCollision } from '../src/math/geometry.js';
import { SensorSystem } from '../src/sensors/SensorSystem.js';
import { Vehicle } from '../src/core/Vehicle.js';
const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);
const wall = (x, y1 = -10, y2 = 10) => ({ a: vec(x, y1), b: vec(x, y2) });

test('ray hits nearest finite wall, including endpoints and exact range', () => {
  near(raySegment(vec(), vec(5, 0), vec(10, 0), vec(10, 5), 10), 10);
  const sensor = new SensorSystem({ angles: [0], range: 100 });
  const [r] = sensor.scan(vec(), 0, [wall(60), wall(20), wall(-10)]);
  near(r.distance, 20); near(r.proximity, .8); near(r.end.x, 20); assert.equal(r.hit, true);
});
test('parallel, behind and out-of-range walls do not hit', () => {
  assert.equal(raySegment(vec(), vec(1, 0), vec(0, 2), vec(10, 2), 30), null);
  assert.equal(raySegment(vec(), vec(1, 0), vec(-1, -2), vec(-1, 2), 30), null);
  assert.equal(raySegment(vec(), vec(1, 0), vec(31, -2), vec(31, 2), 30), null);
});
test('collinear overlap, point-wall and origin contact are finite', () => {
  near(raySegment(vec(), vec(1, 0), vec(5, 0), vec(10, 0), 20), 5);
  near(raySegment(vec(), vec(1, 0), vec(-5, 0), vec(10, 0), 20), 0);
  near(raySegment(vec(), vec(1, 0), vec(7, 0), vec(7, 0), 20), 7);
  near(raySegment(vec(), vec(1, 0), vec(0, -1), vec(0, 1), 20), 0);
  assert.equal(raySegment(vec(), vec(1, 0), vec(7, 1), vec(7, 1), 20), null);
});
test('empty scene, one ray and rotated sensors respect their range', () => {
  const sensors = new SensorSystem({ angles: [0], range: 50 });
  const [empty] = sensors.scan(vec(2, 3), Math.PI / 2, []);
  near(empty.distance, 50); near(empty.end.y, 53); near(empty.proximity, 0);
  const [hit] = sensors.scan(vec(), Math.PI / 2, [{ a: vec(-10, 20), b: vec(10, 20) }]); near(hit.distance, 20);
});
test('ray/sensor invalid inputs throw instead of emitting NaN', () => {
  assert.throws(() => raySegment(vec(), vec(), vec(), vec(1, 0), 10));
  assert.throws(() => raySegment(vec(NaN, 0), vec(1, 0), vec(), vec(1, 0), 10));
  assert.throws(() => new SensorSystem({ range: Infinity }));
  assert.throws(() => new SensorSystem({ angles: [] }));
});
test('point-segment distance clamps projection and handles zero-length wall', () => {
  near(pointSegmentDistance(vec(4, 3), vec(), vec(2, 0)), Math.sqrt(13));
  near(pointSegmentDistance(vec(4, 3), vec(), vec()), 5);
});
test('continuous collision catches crossing an entire wall at high speed', () => {
  near(sweepDiskSegment(vec(), vec(100, 0), 2, vec(50, -20), vec(50, 20)), .48);
  const v = new Vehicle({ maxSpeed: 20000 }); v.velocity.set(10000, 0);
  v.update(.01, (a, b) => firstCollision(a, b, 2, [wall(50)]));
  assert.equal(v.crashed, true); assert.ok(v.position.x < 48); assert.ok(v.position.x > 47.99); near(v.speed, 0);
  near(v.distanceTravelled, v.position.x);
});
test('sweep handles endpoint tangency, initial overlap, degenerate wall and no movement', () => {
  near(sweepDiskSegment(vec(-5, 1), vec(5, 1), 1, vec(), vec()), .5);
  near(sweepDiskSegment(vec(), vec(5, 0), 1, vec(), vec()), 0);
  assert.equal(sweepDiskSegment(vec(0, 3), vec(10, 3), 1, vec(), vec(10, 0)), null);
  assert.equal(sweepDiskSegment(vec(0, 3), vec(0, 3), 1, vec(), vec(10, 0)), null);
});
test('sweep chooses earliest wall and detects disk edge when center misses', () => {
  near(firstCollision(vec(), vec(100, 0), 2, [wall(80), wall(20)]), .18);
  assert.ok(sweepDiskSegment(vec(-10, 1), vec(10, 1), 2, vec(), vec(0, -5)) !== null);
});
test('near-parallel and randomized finite rays never return NaN', () => {
  let seed = 17;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 2 ** 32; };
  for (let i = 0; i < 2000; i++) {
    const a = vec(random() * 200 - 100, random() * 200 - 100);
    const b = vec(random() * 200 - 100, random() * 200 - 100);
    const d = raySegment(vec(), vec(1, i % 2 ? 1e-12 : random()), a, b, 150);
    assert.ok(d === null || Number.isFinite(d) && d >= 0 && d <= 150);
  }
});
