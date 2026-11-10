import test from 'node:test';
import assert from 'node:assert/strict';
import { Car } from '../src/entities/Car.js';
import { Simulation } from '../src/simulation/Simulation.js';
import { encodeInputs, SENSOR_ANGLES } from '../src/ai/InputEncoder.js';
import { decodeOutputs } from '../src/ai/OutputDecoder.js';
import { NeuralNetwork } from '../src/ai/NeuralNetwork.js';
import { NeuralController } from '../src/ai/NeuralController.js';
import { exportNetwork, importNetwork } from '../src/ai/NetworkSerialization.js';
const constantNetwork = (steer = 0, pedal = .5) => new NeuralNetwork({ sizes: [8, 2],
  parameters: [{ weights: Array.from({ length: 2 }, () => Array(8).fill(0)), biases: [Math.atanh(steer), Math.atanh(pedal)] }] });
const carInput = () => ({ active: true, crashed: false, speed: 110, maxSpeed: 220,
  sensors: { angles: [...SENSOR_ANGLES], range: 100, readings: [0,25,50,75,100,150,-10].map(distance => ({ distance, hit: true })) } });

test('encoder order is seven normalized distances then normalized speed, not proximity', () => {
  assert.deepEqual(encodeInputs(carInput()), [0,.25,.5,.75,1,1,0,.5]);
});
test('no-hit is max distance; missing/nonfinite measurements and invalid ranges are conservative', () => {
  const c = carInput(); c.sensors.readings = [{ hit: false, distance: Infinity }, { hit: true, distance: NaN },
    { hit: true, distance: Infinity }, undefined, { hit: true, distance: -Infinity }, { hit: true, distance: 50 }, { hit: false }];
  c.speed = Infinity;
  assert.deepEqual(encodeInputs(c), [1,0,0,0,0,.5,1,0]);
  c.sensors.range = 0; c.speed = 1; c.maxSpeed = NaN;
  assert.deepEqual(encodeInputs(c), Array(8).fill(0));
});
test('encoder clamps speed and rejects incompatible sensor configurations', () => {
  const c = carInput(); c.speed = 500; assert.equal(encodeInputs(c)[7], 1);
  c.speed = -1; assert.equal(encodeInputs(c)[7], 0);
  c.sensors.angles.reverse(); assert.throws(() => encodeInputs(c));
  c.sensors.angles = Array(7); assert.throws(() => encodeInputs(c));
});
test('crashed/inactive car has zero inputs and neutral actual commands', () => {
  const car = new Car(); car.crash();
  assert.deepEqual(encodeInputs(car), Array(8).fill(0));
  assert.deepEqual(new NeuralController(constantNetwork(.5,.5)).decide(car), { steer: 0, throttle: 0, brake: 0 });
});
test('signed outputs map to left/right and mutually exclusive throttle/brake', () => {
  assert.deepEqual(decodeOutputs([-1, .7]), { steer: -1, throttle: .7, brake: 0 });
  assert.deepEqual(decodeOutputs([1, -.8]), { steer: 1, throttle: 0, brake: .8 });
  assert.deepEqual(decodeOutputs([0, 0]), { steer: 0, throttle: 0, brake: 0 });
  assert.deepEqual(decodeOutputs([10, -10]), { steer: 1, throttle: 0, brake: 1 });
});
test('invalid outputs yield finite straight emergency braking commands', () => {
  for (const value of [null, [], [0], [NaN,1], [1,Infinity], Array(2)]) assert.deepEqual(decodeOutputs(value), { steer: 0, throttle: 0, brake: 1 });
});
test('neural controller uses only sensor/speed inputs and never writes physical state', () => {
  const sim = new Simulation(); const car = sim.car;
  const before = [car.position.copy(),car.velocity.copy(),car.acceleration.copy(),car.orientation];
  const controller = new NeuralController(constantNetwork(.2,.6));
  const command = controller.decide(car);
  assert.ok(Math.abs(command.steer - .2) < 1e-12 && Math.abs(command.throttle - .6) < 1e-12);
  assert.deepEqual([car.position,car.velocity,car.acceleration,car.orientation], before);
  assert.equal(controller.diagnostics.inputs.length, 8); assert.equal(controller.diagnostics.outputs.length, 2);
});
test('manual/autonomous switching changes command source without resetting physical state', () => {
  const sim = new Simulation(); sim.setNetwork(constantNetwork(0,.5));
  assert.equal(sim.mode, 'manual'); sim.step(.01, {}); assert.equal(sim.car.speed, 0);
  sim.setMode('autonomous'); sim.step(.01, { brake: 1 }); assert.ok(sim.car.speed > 0);
  const speed = sim.car.speed, distance = sim.car.distanceTravelled;
  sim.setMode('manual'); assert.equal(sim.car.speed, speed); assert.equal(sim.car.distanceTravelled, distance);
  sim.step(.01, { brake: 1 }); assert.ok(sim.car.speed < speed);
  assert.equal(sim.neuralController.diagnostics, null); assert.throws(() => sim.setMode('other'));
});
test('incompatible network replacement is atomic, preserving selected network and mode', () => {
  const sim = new Simulation(), original = sim.neuralController.network;
  for (const network of [new NeuralNetwork({ sizes: [7,12,2] }), new NeuralNetwork({ outputActivation: 'sigmoid' }), {}]) assert.throws(() => sim.setNetwork(network));
  assert.equal(sim.neuralController.network, original); assert.equal(sim.mode, 'manual');
});
test('pause does not infer or move; reset preserves chosen network and driving mode', () => {
  const sim = new Simulation(), network = constantNetwork(); sim.setNetwork(network); sim.setMode('autonomous');
  sim.paused = true; sim.step(.01); assert.equal(sim.neuralController.diagnostics, null);
  sim.paused = false; sim.step(.01); assert.ok(sim.neuralController.diagnostics);
  sim.reset(); assert.equal(sim.mode, 'autonomous'); assert.equal(sim.neuralController.network, network);
  assert.equal(sim.neuralController.diagnostics, null); assert.equal(sim.car.speed, 0);
});
test('autonomous steps follow current sensor feedback and existing physics limits', () => {
  const sim = new Simulation(); sim.setMode('autonomous'); sim.setNetwork(constantNetwork(.95,.95));
  for (let i = 0; i < 100; i++) {
    if (!sim.car.active) break;
    const expected = encodeInputs(sim.car); sim.step(1/120);
    assert.deepEqual(sim.neuralController.diagnostics.inputs, expected);
    assert.ok(Math.abs(sim.car.steeringAngle) <= sim.car.maxSteeringAngle);
    assert.ok(sim.car.speed <= sim.car.maxSpeed);
  }
});
test('export/import reproduces autonomous trajectories from the same starting state', () => {
  const a = new Simulation(), b = new Simulation(); const network = new NeuralNetwork({ seed: 1 });
  a.setNetwork(network); b.setNetwork(importNetwork(exportNetwork(network)));
  a.setMode('autonomous'); b.setMode('autonomous');
  for (let i = 0; i < 500; i++) { a.step(1/120); b.step(1/120); }
  assert.deepEqual(a.car.position, b.car.position); assert.deepEqual(a.car.velocity, b.car.velocity);
  assert.ok(a.car.distanceTravelled > 0);
  assert.equal(a.car.crashed, b.car.crashed); assert.equal(a.checkpoints.validated, b.checkpoints.validated);
});
test('20,000 active autonomous steps with inference, sensors, collisions and resets stay finite', () => {
  const sim = new Simulation();
  sim.setNetwork(new NeuralNetwork({ parameters: [
    { weights: Array.from({ length: 12 }, () => Array(8).fill(0)), biases: Array(12).fill(0) },
    { weights: Array.from({ length: 2 }, () => Array(12).fill(0)), biases: [0, Math.atanh(.6)] }
  ] }));
  sim.setMode('autonomous');
  let collisions = 0, travelled = 0;
  for (let i = 0; i < 20_000; i++) {
    sim.step(1/120);
    const d = sim.neuralController.diagnostics;
    assert.ok(d); assert.ok(d.inputs.every(n => Number.isFinite(n) && n >= 0 && n <= 1));
    assert.ok(d.outputs.every(n => Number.isFinite(n) && n >= -1 && n <= 1));
    assert.ok(Number.isFinite(sim.car.position.x) && Number.isFinite(sim.car.position.y) && Number.isFinite(sim.car.speed));
    assert.ok(sim.car.speed <= sim.car.maxSpeed + 1e-8);
    if (sim.car.crashed) { travelled += sim.car.distanceTravelled; collisions++; sim.reset(); }
  }
  assert.ok(collisions > 10); assert.ok(travelled > 1000); assert.equal(sim.mode, 'autonomous');
});
