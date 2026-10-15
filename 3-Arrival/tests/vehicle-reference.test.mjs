import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { TestP5Vector } from './support/p5-vector.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const source = await readFile(path.join(here, '..', 'js', 'vehicle.js'), 'utf8');
const context = vm.createContext({ Math, p5: { Vector: TestP5Vector }, width: 640, height: 400 });
vm.runInContext(`${source}\nglobalThis.VehicleUnderTest = Vehicle;`, context);
const Vehicle = context.VehicleUnderTest;

const makeVehicle = (options = {}) => new Vehicle(0, 0, {
  maxSpeed: 10,
  maxForce: 20,
  ...options
});

test('Vehicle state and returned steering use the injected p5.Vector type', () => {
  const vehicle = makeVehicle();
  assert.ok(vehicle.pos instanceof TestP5Vector);
  assert.ok(vehicle.vel instanceof TestP5Vector);
  assert.ok(vehicle.acc instanceof TestP5Vector);
  assert.ok(vehicle.seek({ x: 20, y: 0 }) instanceof TestP5Vector);
  assert.ok(vehicle.arrive({ x: 20, y: 0 }) instanceof TestP5Vector);
  const target = { pos: new TestP5Vector(20, 0), vel: new TestP5Vector(1, 0) };
  for (const force of [
    vehicle.flee({ x: 20, y: 0 }), vehicle.pursue(target), vehicle.evade(target),
    vehicle.wander(), vehicle.boundaries({ x: 0, y: 0, w: 100, h: 100 }),
    vehicle.avoid([{ x: 100, y: 0, r: 1000 }])
  ]) assert.ok(force instanceof TestP5Vector);
});

const vector = (actual, expected, epsilon = 1e-9) => {
  assert.ok(Math.abs(actual.x - expected.x) <= epsilon, `x: ${actual.x} != ${expected.x}`);
  assert.ok(Math.abs(actual.y - expected.y) <= epsilon, `y: ${actual.y} != ${expected.y}`);
};

test('reference Seek requests maxSpeed toward the target and limits steering', () => {
  const vehicle = makeVehicle({ maxSpeed: 10, maxForce: 2 });
  vector(vehicle.seek({ x: 100, y: 0 }), { x: 2, y: 0 });
});

test('reference Arrive uses full desired speed outside slowRadius', () => {
  const vehicle = makeVehicle();
  vector(vehicle.arrive({ x: 150, y: 0 }, 100, 0), { x: 10, y: 0 });
});

test('reference Arrive linearly scales desired speed inside slowRadius', () => {
  const vehicle = makeVehicle();
  vector(vehicle.arrive({ x: 50, y: 0 }, 100, 0), { x: 5, y: 0 });
});

test('reference Arrive requests zero speed at and inside stopDistance', () => {
  const vehicle = makeVehicle();
  vector(vehicle.arrive({ x: 20, y: 0 }, 100, 30), { x: 0, y: 0 });
});

test('reference steering subtracts current velocity and remains force-limited', () => {
  const vehicle = makeVehicle({ maxSpeed: 10, maxForce: 3 });
  vehicle.vel.x = 0;
  vehicle.vel.y = 8;
  const force = vehicle.arrive({ x: 100, y: 0 }, 50, 0);
  assert.ok(Math.hypot(force.x, force.y) <= 3 + 1e-9);
  const scale = 3 / Math.hypot(10, 8);
  vector(force, { x: 10 * scale, y: -8 * scale });
});

test('reference Arrive returns a zero force when already at the target', () => {
  const vehicle = makeVehicle();
  vector(vehicle.arrive({ x: 0, y: 0 }, 100, 0), { x: 0, y: 0 });
});

test('reference Vehicle applies force, integrates once, and clears acceleration', () => {
  const vehicle = makeVehicle({ maxSpeed: 10, maxForce: 10 });
  vehicle.applyForce({ x: 2, y: -1 });
  vehicle.update();
  vector(vehicle.vel, { x: 2, y: -1 });
  vector(vehicle.pos, { x: 2, y: -1 });
  vector(vehicle.acc, { x: 0, y: 0 });
});

test('reference Seek trajectory is deterministic over five force-update steps', () => {
  const vehicle = makeVehicle({ maxSpeed: 10, maxForce: 2 });
  for (let step = 0; step < 5; step++) {
    vehicle.applyForce(vehicle.seek({ x: 100, y: 0 }));
    vehicle.update();
  }
  vector(vehicle.vel, { x: 10, y: 0 });
  vector(vehicle.pos, { x: 30, y: 0 });
});

test('reference Arrive trajectory preserves its proportional braking near target', () => {
  const vehicle = makeVehicle({ maxSpeed: 10, maxForce: 20 });
  for (let step = 0; step < 3; step++) {
    vehicle.applyForce(vehicle.arrive({ x: 50, y: 0 }, 100, 0));
    vehicle.update();
  }
  vector(vehicle.vel, { x: 4.05, y: 0 });
  vector(vehicle.pos, { x: 13.55, y: 0 });
});

test('reference locomotion caps integrated velocity at maxSpeed', () => {
  const vehicle = makeVehicle({ maxSpeed: 3, maxForce: 10 });
  vehicle.applyForce({ x: 8, y: 0 });
  vehicle.update();
  vector(vehicle.vel, { x: 3, y: 0 });
  vector(vehicle.pos, { x: 3, y: 0 });
});

test('reference Seek handles very large finite target distances', () => {
  const vehicle = makeVehicle({ maxSpeed: 4, maxForce: 20 });
  vector(vehicle.seek({ x: 1e300, y: 0 }), { x: 4, y: 0 });
});

test('diagnostics record the actual Seek velocities, distance, and returned steering', () => {
  const vehicle = makeVehicle({ maxSpeed: 10, maxForce: 3 });
  vehicle.pos.x = 2;
  vehicle.vel.y = 4;
  const force = vehicle.seek({ x: 102, y: 0 });
  const diagnostics = vehicle.copySteeringDiagnosticsTo({});
  assert.equal(diagnostics.behavior, 'seek');
  assert.equal(diagnostics.distance, 100);
  vector(diagnostics.position, { x: 2, y: 0 });
  vector(diagnostics.currentVelocity, { x: 0, y: 4 });
  vector(diagnostics.desiredVelocity, { x: 10, y: 0 });
  vector(diagnostics.steering, force);
  assert.equal(diagnostics.desiredSpeed, 10);
  assert.equal(diagnostics.effectiveSpeed, 4);
});

test('diagnostics record Arrive slowdown without changing its physical steering result', () => {
  const vehicle = makeVehicle({ maxSpeed: 10, maxForce: 20 });
  vehicle.vel.y = 1;
  const force = vehicle.arrive({ x: 50, y: 0 }, 100, 0);
  vector(force, { x: 5, y: -1 });
  const diagnostics = vehicle.copySteeringDiagnosticsTo({});
  assert.equal(diagnostics.behavior, 'arrive');
  assert.equal(diagnostics.distance, 50);
  vector(diagnostics.desiredVelocity, { x: 5, y: 0 });
  vector(diagnostics.steering, force);
  assert.equal(diagnostics.desiredSpeed, 5);
  assert.equal(diagnostics.effectiveSpeed, 1);
});

test('diagnostics follow changed targets and their returned snapshots are defensive copies', () => {
  const vehicle = makeVehicle();
  const snapshot = { position: {}, currentVelocity: {}, desiredVelocity: {}, steering: {} };
  const desiredVelocityOutput = snapshot.desiredVelocity;
  vehicle.seek({ x: 40, y: 0 });
  vehicle.copySteeringDiagnosticsTo(snapshot);
  snapshot.desiredVelocity.x = 999;
  vehicle.seek({ x: 0, y: 60 });
  vehicle.copySteeringDiagnosticsTo(snapshot);
  assert.equal(snapshot.distance, 60);
  assert.equal(snapshot.desiredVelocity, desiredVelocityOutput);
  vector(snapshot.desiredVelocity, { x: 0, y: 10 });
  vector(snapshot.steering, { x: 0, y: 10 });
});

test('zero-distance and reset diagnostics stay finite and cannot remain stale', () => {
  const vehicle = makeVehicle();
  const diagnostics = vehicle.copySteeringDiagnosticsTo({});
  assert.equal(diagnostics.valid, false);
  vector(vehicle.arrive({ x: 0, y: 0 }), { x: 0, y: 0 });
  vehicle.copySteeringDiagnosticsTo(diagnostics);
  assert.equal(diagnostics.valid, true);
  assert.equal(diagnostics.distance, 0);
  assert.ok(Object.values(diagnostics).every(value => typeof value !== 'number' || Number.isFinite(value)));
  vehicle.resetSteeringDiagnostics();
  vehicle.copySteeringDiagnosticsTo(diagnostics);
  assert.equal(diagnostics.valid, false);
  assert.equal(diagnostics.behavior, '');
  vector(diagnostics.desiredVelocity, { x: 0, y: 0 });
});

test('non-finite source values invalidate diagnostics and expose only finite vector components', () => {
  const vehicle = makeVehicle();
  vehicle.vel.x = Number.NaN;
  vehicle.seek({ x: 10, y: 0 });
  const diagnostics = vehicle.copySteeringDiagnosticsTo({});
  assert.equal(diagnostics.valid, false);
  assert.ok(Number.isFinite(diagnostics.currentVelocity.x));
  assert.ok(Number.isFinite(diagnostics.steering.x));
});
