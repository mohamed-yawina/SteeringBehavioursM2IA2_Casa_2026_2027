import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TestP5Vector } from './support/p5-vector.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = file => readFile(path.join(root, file), 'utf8');

async function loadGame(overrides = {}) {
  const settings = {
    slowRadius: 100, stopDistance: 0, maxSpeed: 10, maxForce: 20,
    simulationSpeed: 1, agentCount: 3, formationSpacing: 30, textDensity: 8,
    ...overrides.settings
  };
  const ui = {
    getSettings: () => settings,
    applyPalette() {},
    updateStats() {}
  };
  const document = {
    body: { dataset: { mode: 'arrive', seed: '1337' } },
    getElementById: () => null,
    createElement: () => ({
      width: 0, height: 0,
      getContext: () => ({
        fillText() {},
        getImageData(_x, _y, width, height) {
          const data = new Uint8ClampedArray(width * height * 4);
          if (width > 8 && height > 8) data[(8 * width + 8) * 4 + 3] = 255;
          return { data };
        }
      })
    })
  };
  const context = vm.createContext({ document, UI: ui, Math, p5: { Vector: TestP5Vector }, width: 640, height: 400, requestAnimationFrame() {}, ...overrides.globals });
  for (const file of ['js/vehicle.js', 'js/target.js', 'js/trailer.js', 'js/textVehicle.js', 'js/particle.js']) {
    vm.runInContext(await read(file), context, { filename: file });
  }
  vm.runInContext('globalThis.Vehicle = Vehicle; globalThis.Target = Target; globalThis.Trailer = Trailer; globalThis.TextVehicle = TextVehicle; globalThis.TrailParticle = TrailParticle;', context);
  vm.runInContext(`${await read('js/game.js')}\nglobalThis.TestGame = Game; globalThis.TestUI = UI;`, context, { filename: 'js/game.js' });
  const Game = context.TestGame;
  Game.width = 640;
  Game.height = 400;
  Game.canvas = {};
  Game.target = new context.Target(320, 200);
  Game.mouseX = 320;
  Game.mouseY = 200;
  Game.randomState = 1337;
  Game.simulationSeed = 1337;
  return { context, Game, UI: context.TestUI, settings };
}

test('Seek maintains full desired speed while Arrive slows inside its radius', async () => {
  const { context } = await loadGame();
  const vehicle = new context.Vehicle(0, 0, { maxSpeed: 10, maxForce: 20 });
  const seek = vehicle.seek({ x: 50, y: 0 });
  const arrive = vehicle.arrive({ x: 50, y: 0 }, 100, 0);
  assert.deepEqual({ x: seek.x, y: seek.y }, { x: 10, y: 0 });
  assert.deepEqual({ x: arrive.x, y: arrive.y }, { x: 5, y: 0 });
  assert.ok(seek instanceof TestP5Vector);
  assert.ok(arrive instanceof TestP5Vector);
});

test('Arrive respects the stop zone and maxForce', async () => {
  const { context } = await loadGame();
  const stopped = new context.Vehicle(0, 0, { maxSpeed: 10, maxForce: 20 });
  const stopForce = stopped.arrive({ x: 10, y: 0 }, 100, 20);
  assert.deepEqual({ x: stopForce.x, y: stopForce.y }, { x: 0, y: 0 });
  const limited = new context.Vehicle(0, 0, { maxSpeed: 10, maxForce: 0.25 });
  const force = limited.arrive({ x: 500, y: 0 }, 100, 0);
  assert.ok(Math.hypot(force.x, force.y) <= 0.25 + 1e-9);
});

test('the mouse target preserves the valid coordinate x = 0', async () => {
  const { Game } = await loadGame();
  Game.vehicles = [];
  const position = Game.target.pos;
  Game.handleMouseMove(0, 73);
  Game.update();
  assert.equal(Game.target.pos.x, 0);
  assert.equal(Game.target.pos.y, 73);
  assert.equal(Game.target.pos, position);
});

test('speed and force sliders are read as live agent settings', async () => {
  const { Game, settings, context } = await loadGame();
  Game.vehicles = [new context.Vehicle(0, 0)];
  settings.maxSpeed = 3.5;
  settings.maxForce = 0.12;
  Game.applySettings();
  assert.equal(Game.vehicles[0].maxSpeed, 3.5);
  assert.equal(Game.vehicles[0].maxForce, 0.12);
});

test('all visible agent subclasses retain Vehicle inheritance and vector state', async () => {
  const { context } = await loadGame();
  const target = new context.Target(1, 2);
  const trailer = new context.Trailer(3, 4);
  const textAgent = new context.TextVehicle(5, 6, { x: 7, y: 8 });
  const particle = new context.TrailParticle(9, 10);
  for (const entity of [target, trailer, textAgent, particle]) {
    assert.ok(entity instanceof context.Vehicle);
    assert.ok(entity.pos instanceof TestP5Vector);
    assert.ok(entity.vel instanceof TestP5Vector);
    assert.ok(entity.acc instanceof TestP5Vector);
  }
  assert.ok(textAgent.targetPoint instanceof TestP5Vector);
});

test('formation modes calculate spaced follower slots from the leader heading', async () => {
  const { context, Game, settings } = await loadGame();
  Game.settings.mode = 'snake';
  Game.settings.formation = 'vee';
  Game.vehicles = [new context.Vehicle(100, 100), new context.Vehicle(0, 0), new context.Vehicle(0, 0)];
  Game.vehicles[0].vel.x = 1;
  settings.formationSpacing = 30;
  assert.deepEqual(JSON.parse(JSON.stringify(Game.formationPoint(1))), { x: 70, y: 70 });
  assert.deepEqual(JSON.parse(JSON.stringify(Game.formationPoint(2))), { x: 70, y: 130 });
});

test('text target changes reuse agents so they can steer between formations', async () => {
  const { context, Game, settings } = await loadGame({ settings: { agentCount: 10 } });
  Game.settings.mode = 'text';
  Game.vehicles = [];
  Game.rebuildTextVehicles('IA');
  const original = Game.vehicles[0];
  const originalTargetVector = original.targetPoint;
  const originalX = original.pos.x;
  Game.rebuildTextVehicles('M2');
  assert.equal(Game.vehicles[0], original);
  assert.equal(Game.vehicles[0].pos.x, originalX);
  assert.ok(Game.vehicles[0].targetPoint);
  assert.equal(Game.vehicles[0].targetPoint, originalTargetVector);
  assert.equal(settings.textDensity, 8);
  Game.vehicles[0].arrive(Game.vehicles[0].targetPoint, 100, 0);
  Game.rebuildTextVehicles('AI');
  assert.equal(Game.vehicles[0].copySteeringDiagnosticsTo({}).valid, false);
});

test('changing simulation mode creates agents with cleared steering diagnostics', async () => {
  const { Game, context } = await loadGame();
  Game.vehicles = [new context.Vehicle(10, 20)];
  Game.vehicles[0].arrive({ x: 40, y: 20 }, 100, 0);
  assert.equal(Game.vehicles[0].copySteeringDiagnosticsTo({}).valid, true);
  Game.setMode('arrive');
  assert.equal(Game.selectedAgentIndex, 0);
  assert.equal(Game.vehicles[0].copySteeringDiagnosticsTo({}).valid, false);
  Game.vehicles[0].arrive({ x: 40, y: 20 }, 100, 0);
  Game.reset(4455);
  assert.equal(Game.vehicles[0].copySteeringDiagnosticsTo({}).valid, false);
});

test('same scenario seed reproduces initial agent positions', async () => {
  const { Game } = await loadGame();
  Game.reset(99173);
  const first = Game.vehicles.map(vehicle => [vehicle.pos.x, vehicle.pos.y]);
  Game.reset(99173);
  const second = Game.vehicles.map(vehicle => [vehicle.pos.x, vehicle.pos.y]);
  assert.deepEqual(second, first);
});

test('pause, resume and one-step controls have explicit state semantics', async () => {
  const { Game } = await loadGame();
  let updates = 0;
  Game.update = () => updates++;
  Game.draw = () => {};
  Game.updateMeasurements = () => {};
  Game.togglePause(true);
  Game.stepOnce();
  assert.equal(updates, 1);
  Game.togglePause(false);
  Game.stepOnce();
  assert.equal(updates, 1);
  Game.togglePause();
  assert.equal(Game.paused, true);
});

test('fixed-step simulation speed scales simulation ticks independently of display frames', async () => {
  const { Game, settings } = await loadGame();
  settings.simulationSpeed = 2;
  let updates = 0;
  Game.update = () => updates++;
  Game.draw = () => {};
  Game.updateMeasurements = () => {};
  Game.lastTime = 100;
  Game.lastFpsUpdate = 100;
  Game.loop(150);
  assert.equal(updates, 6);
  Game.paused = true;
  Game.loop(200);
  assert.equal(updates, 6);
});

test('real UI slider listeners apply live values and constrain stopDistance below slowRadius', async () => {
  class Element {
    constructor(value = '') { this.value = value; this.handlers = {}; this.textContent = ''; }
    addEventListener(type, handler) { this.handlers[type] = handler; }
    fire(type) { this.handlers[type]?.({ target: this, currentTarget: this }); }
    setAttribute() {}
    classList = { add() {}, remove() {} };
  }
  const values = { slow: '100', stop: '0', speed: '6', force: '0.4', simSpeed: '1', agentCount: '12', spacing: '24', density: '8', difficulty: 'normal' };
  const elements = Object.fromEntries(Object.entries(values).map(([id, value]) => [id, new Element(value)]));
  const applied = { count: 0, synced: 0 };
  const game = { settings: { mode: 'arrive', formation: 'chain', palette: 'aurora' }, applySettings() { applied.count++; }, syncAgentCount() { applied.synced++; } };
  const document = { getElementById: id => elements[id] || null, querySelectorAll: () => [] };
  const context = vm.createContext({ document, Game: game, Number, Math });
  vm.runInContext(`${await read('js/ui.js')}\nglobalThis.TestUI = UI;`, context);
  context.TestUI.init();
  const before = applied.count;
  elements.speed.value = '9.5';
  elements.speed.fire('input');
  assert.equal(context.TestUI.getSettings().maxSpeed, 9.5);
  assert.ok(applied.count > before);
  elements.slow.value = '20';
  elements.slow.fire('input');
  assert.equal(Number(elements.stop.max), 19);
  elements.stop.value = '100';
  assert.equal(context.TestUI.getSettings().stopDistance, 19);
  elements.force.value = 'invalid';
  assert.equal(context.TestUI.getSettings().maxForce, 0.4);
  elements.difficulty.value = 'hard';
  elements.difficulty.fire('change');
  assert.equal(elements.agentCount.value, '22');
  assert.equal(elements.speed.value, '8');
  assert.equal(elements.spacing.value, '18');
  assert.ok(applied.synced > 0);
});

test('Seek / Arrive comparison initializes cohorts at identical seeded positions', async () => {
  const { Game } = await loadGame();
  Game.toggleComparison(true);
  const [seek, arrive] = Game.comparisonGroups;
  assert.equal(seek.behavior, 'seek');
  assert.equal(arrive.behavior, 'arrive');
  assert.deepEqual(
    seek.vehicles.map(vehicle => [vehicle.pos.x, vehicle.pos.y]),
    arrive.vehicles.map(vehicle => [vehicle.pos.x, vehicle.pos.y])
  );
});

test('comparison cohorts apply their distinct steering rules under the same target', async () => {
  const { Game, settings } = await loadGame();
  Game.toggleComparison(true);
  const [seek, arrive] = Game.comparisonGroups;
  for (const group of [seek, arrive]) {
    group.vehicles[0].pos.x = 30;
    group.vehicles[0].pos.y = 0;
  }
  Game.mouseX = 0;
  Game.mouseY = 0;
  settings.maxSpeed = 10;
  settings.maxForce = 20;
  settings.slowRadius = 100;
  Game.updateComparison(settings);
  assert.equal(seek.vehicles[0].vel.x, -10);
  assert.equal(arrive.vehicles[0].vel.x, -3);
  assert.notEqual(seek.distance, arrive.distance);
});
