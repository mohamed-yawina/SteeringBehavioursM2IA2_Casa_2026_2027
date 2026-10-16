import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadTD7} from './reference-harness.mjs';

const point = (actual, expected) => {
  assert.ok(Math.abs(actual.x - expected[0]) < 1e-12);
  assert.ok(Math.abs(actual.y - expected[1]) < 1e-12);
};

test('Boid et Obstacle héritent de Vehicle et conservent leurs constructeurs publics', () => {
  const {Vehicle, Boid, Obstacle} = loadTD7();
  const boid = new Boid(12, 34);
  const obstacle = new Obstacle(56, 78, 19, 'green');
  assert.ok(boid instanceof Vehicle);
  assert.ok(obstacle instanceof Vehicle);
  point(boid.pos, [12, 34]);
  assert.equal(boid.maxSpeed, 5);
  assert.equal(boid.maxForce, 0.2);
  assert.equal(boid.r, 6);
  point(obstacle.pos, [56, 78]);
  assert.equal(obstacle.r, 19);
  assert.equal(obstacle.color, 'green');
  assert.equal(obstacle.isStatic, true);
});

test('Vehicle initialise les états physiques avec de vrais p5.Vector sans aléatoire', () => {
  const {Vehicle, Vector, randomEvents} = loadTD7();
  const vehicle = new Vehicle(5, 8, {maxSpeed: 4, maxForce: 0.2, r: 6});
  for (const state of [vehicle.pos, vehicle.vel, vehicle.acc]) assert.ok(state instanceof Vector);
  point(vehicle.pos, [5, 8]);
  point(vehicle.vel, [0, 0]);
  point(vehicle.acc, [0, 0]);
  assert.deepEqual(randomEvents, []);
});

test('Boid conserve les tirages aléatoires et les valeurs initiales historiques', () => {
  const {Boid, randomEvents} = loadTD7();
  const boid = new Boid(12, 34);
  assert.deepEqual(randomEvents, [[Math.PI * 2, undefined], [2, 4]]);
  assert.equal(boid.pos.x, 12);
  assert.equal(boid.pos.y, 34);
  assert.ok(boid.vel.mag() >= 2 && boid.vel.mag() <= 4);
  assert.equal(boid.acc.mag(), 0);
  assert.equal(boid.maxSpeed, 5);
  assert.equal(boid.maxForce, 0.2);
  assert.equal(boid.r, 6);
});

test('Boid image constructor remains compatible', () => {
  const {Boid} = loadTD7();
  const image = {width: 120, height: 60};
  const boid = new Boid(1, 2, image);
  assert.equal(boid.image, image);
  assert.equal(boid.imageL, 6);
  assert.equal(boid.imageH, 3);
});

test('applyForce accumulates finite forces without mutating inputs', () => {
  const {Vehicle, Vector} = loadTD7();
  const vehicle = new Vehicle(0, 0);
  const force = new Vector(1.25, -2);
  const before = force.copy();
  vehicle.applyForce(force);
  vehicle.applyForce(force);
  point(force, [before.x, before.y]);
  point(vehicle.acc, [2.5, -4]);
});

test('applyForce rejects non-finite forces and overflow without corrupting acceleration', () => {
  const {Vehicle} = loadTD7();
  const vehicle = new Vehicle(0, 0);
  vehicle.acc.set(2, 3);
  vehicle.applyForce({x: NaN, y: 1, z: 0});
  vehicle.applyForce({x: Infinity, y: 1, z: 0});
  point(vehicle.acc, [2, 3]);
  vehicle.acc.x = Number.MAX_VALUE;
  vehicle.applyForce({x: Number.MAX_VALUE, y: 0, z: 0});
  assert.equal(vehicle.acc.x, Number.MAX_VALUE);
});

test('update conserve l’ordre d’intégration historique, limite la vitesse et vide acc', () => {
  const {Vehicle} = loadTD7();
  const vehicle = new Vehicle(10, 20, {maxSpeed: 2});
  vehicle.vel.set(3, 4);
  vehicle.acc.set(1, -2);
  vehicle.update();
  point(vehicle.pos, [13, 24]); // position utilise la vitesse d’avant ce pas
  point(vehicle.vel, [4 / Math.sqrt(20) * 2, 2 / Math.sqrt(20) * 2]);
  point(vehicle.acc, [0, 0]);
});

test('Vehicle ignore les limites physiques invalides et négatives', () => {
  const {Vehicle} = loadTD7();
  const vehicle = new Vehicle(NaN, Infinity, {maxSpeed: -1, maxForce: NaN, r: Infinity});
  point(vehicle.pos, [0, 0]);
  assert.equal(vehicle.maxSpeed, 0);
  assert.equal(vehicle.maxForce, 0);
  assert.equal(vehicle.r, 0);
});

test('Obstacle ignore forces et intégration et reste immobile', () => {
  const {Obstacle, Vector} = loadTD7();
  const obstacle = new Obstacle(42, 73, 12, 'green');
  obstacle.vel.set(5, -3);
  obstacle.applyForce(new Vector(100, 100));
  obstacle.update();
  point(obstacle.pos, [42, 73]);
  point(obstacle.vel, [5, -3]);
  point(obstacle.acc, [0, 0]);
});

test('Vehicle ne porte aucun rendu; les appels locomoteurs de sketch restent disponibles', () => {
  const {Vehicle, Boid} = loadTD7();
  assert.equal(typeof Vehicle.prototype.show, 'undefined');
  assert.equal(typeof Vehicle.prototype.draw, 'undefined');
  for (const method of ['applyForce', 'update']) assert.equal(typeof Boid.prototype[method], 'function');
  for (const method of ['flock', 'seek', 'wander', 'edges', 'show', 'getVehiculeLePlusProche']) {
    assert.equal(typeof Boid.prototype[method], 'function', `Boid.${method}`);
  }
  const sketch = readFileSync(new URL('../sketch.js', import.meta.url), 'utf8');
  for (const method of ['flock', 'update', 'show', 'edges', 'applyForce', 'seek', 'wander']) {
    assert.match(sketch, new RegExp(`\\.${method}\\s*\\(`), `sketch appelle ${method}`);
  }
});

test('ordre de chargement HTML : p5, p5.sound, Vehicle, Boid, Obstacle, sketch', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
  assert.deepEqual(scripts, [
    'libraries/p5.min.js', 'libraries/p5.sound.min.js',
    'vehicle.js', 'boids.js', 'obstacle.js', 'sketch.js'
  ]);
});

test('Vehicle et les entités sont syntaxiquement valides et scripts référencés présents', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const scripts = [...html.matchAll(/<script\s+src="([^"]+)"/g)].map(match => match[1]);
  for (const script of scripts) {
    const source = readFileSync(new URL(`../${script}`, import.meta.url), 'utf8');
    assert.doesNotThrow(() => new vm.Script(source, {filename: script}));
  }
});
