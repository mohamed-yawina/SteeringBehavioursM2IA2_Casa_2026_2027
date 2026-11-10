import test from 'node:test';
import assert from 'node:assert/strict';
import { vec } from '../src/math/vector.js';
import { Vehicle } from '../src/core/Vehicle.js';
import { Car } from '../src/entities/Car.js';
import { manualSteering } from '../src/controls/manualSteering.js';
import { FixedStepClock } from '../src/simulation/FixedStepClock.js';
const near = (a, b, eps = 1e-8) => assert.ok(Math.abs(a - b) < eps, `${a} != ${b}`);

test('semi-implicit seconds-based movement and consumed acceleration', () => {
  const v = new Vehicle();
  v.applyForce(vec(100, 0)); v.update(.1);
  near(v.velocity.x, 10); near(v.position.x, 1); near(v.distanceTravelled, 1);
  near(v.acceleration.mag(), 0); v.update(.1); near(v.position.x, 2);
});
test('force composition is bounded and speed never exceeds maxSpeed', () => {
  const v = new Vehicle({ maxSpeed: 10, maxAcceleration: 30 });
  v.applyForce(vec(20, 0)); v.applyForce(vec(0, 20));
  near(v.acceleration.mag(), Math.sqrt(800));
  v.applyForce(vec(1000, 1000)); assert.ok(v.acceleration.mag() <= 30 + 1e-9);
  for (let i = 0; i < 500; i++) { v.applyForce(vec(300, 0)); v.update(.01); assert.ok(v.speed <= 10 + 1e-9); }
});
test('Car inherits Vehicle; straight throttle moves in initial direction', () => {
  const car = new Car({ orientation: Math.PI / 2 });
  assert.ok(car instanceof Vehicle);
  for (let i = 0; i < 120; i++) { car.control({ throttle: 1 }, 1 / 120); car.update(1 / 120); }
  near(car.position.x, 0); assert.ok(car.position.y > 50); near(car.orientation, Math.PI / 2);
});
test('left and right steering turn oppositely and cannot rotate a stopped car', () => {
  for (const sign of [-1, 1]) {
    const c = new Car(); c.control({ steer: sign }, .01); c.update(.01); near(c.orientation, 0);
    c.velocity.set(70, 0);
    for (let i = 0; i < 40; i++) { c.control({ throttle: .2, steer: sign }, .01); c.update(.01); }
    assert.ok(c.orientation * sign > .1); near(c.steeringAngle, sign * c.maxSteeringAngle);
  }
});
test('braking stops without reverse; force stays bounded for combined turn/throttle', () => {
  const car = new Car(); car.velocity.set(100, 0);
  const steering = manualSteering(car, { throttle: 1, steer: 1 }, 1 / 120);
  assert.ok(steering.force.mag() <= car.maxAcceleration + 1e-8);
  near(car.acceleration.mag(), 0); // pure controller
  for (let i = 0; i < 300; i++) { car.control({ brake: 1 }, .01); car.update(.01); assert.ok(car.velocity.x >= -1e-9); }
  near(car.speed, 0);
});
test('crashed car is inactive and cannot move or accumulate forces', () => {
  const car = new Car(); car.velocity.set(100, 0); car.crash();
  car.control({ throttle: 1 }, .01); car.applyForce(vec(100, 0)); car.update(.01);
  assert.equal(car.crashed, true); assert.equal(car.active, false); near(car.speed, 0); near(car.position.mag(), 0);
});
test('invalid numbers and dt are rejected before integration; zero update is inert', () => {
  assert.throws(() => new Car({ position: { x: NaN, y: 0 } }), /finite/);
  assert.throws(() => new Car({ maxSpeed: 0 }), /positive/);
  const car = new Car();
  for (const dt of [NaN, Infinity, -.1, 1]) assert.throws(() => car.update(dt));
  assert.throws(() => car.applyForce(vec(NaN, 0)), /finite/);
  assert.throws(() => car.control({ throttle: NaN }, .01), /finite/);
  assert.throws(() => car.control({}, 0));
  car.update(0); near(car.position.mag(), 0);
});
test('fixed-step clock produces same physics at 30/60/144 display FPS', () => {
  const run = fps => {
    const car = new Car(), clock = new FixedStepClock();
    for (let i = 0; i < fps * 2; i++) clock.advance(1 / fps, dt => { car.control({ throttle: 1, steer: .1 }, dt); car.update(dt); });
    return car;
  };
  const reference = run(30);
  for (const fps of [60, 144]) { const c = run(fps); near(c.position.x, reference.position.x); near(c.position.y, reference.position.y); near(c.speed, reference.speed); }
});
test('clock caps catchup after a long pause, resets, rejects invalid elapsed time', () => {
  const clock = new FixedStepClock(); let calls = 0;
  assert.equal(clock.advance(200, () => calls++), 12); assert.equal(calls, 12);
  clock.advance(.001, () => {}); clock.reset(); near(clock.accumulator, 0);
  assert.throws(() => clock.advance(NaN, () => {})); assert.throws(() => clock.advance(-1, () => {}));
});
test('20,000 active free-driving steps stay finite with bounded speed, forces and angles', () => {
  const car = new Car(); let previousDistance = 0;
  for (let i = 0; i < 20_000; i++) {
    car.control({ throttle: .7, steer: Math.sin(i * .003) * .6, brake: i % 1000 > 950 ? 1 : 0 }, 1 / 120);
    assert.ok(car.acceleration.mag() <= car.maxAcceleration + 1e-8);
    car.update(1 / 120);
    for (const n of [car.position.x, car.position.y, car.velocity.x, car.velocity.y, car.orientation, car.distanceTravelled]) assert.ok(Number.isFinite(n));
    assert.ok(car.speed <= car.maxSpeed + 1e-8);
    assert.ok(Math.abs(car.orientation) <= Math.PI);
    assert.ok(car.distanceTravelled >= previousDistance); previousDistance = car.distanceTravelled;
  }
  assert.ok(car.active); assert.ok(car.distanceTravelled > 1000);
});
