import './helpers/runtime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { seededRandom, finiteCreature } from './helpers/runtime.js';
import { DNA } from '../src/core/DNA.js';
import { Creature } from '../src/entities/Creature.js';
import { Food } from '../src/entities/Food.js';
import { Poison } from '../src/entities/Poison.js';
import { flee, resourceForce, boundaryForce, combinedForce } from '../src/behaviors/steering.js';
import { nearestResource, consumeResources } from '../src/behaviors/perception.js';
import { Simulation } from '../src/simulation/Simulation.js';

const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} ≠ ${expected}`);
const creature = (genes = [1, -1, 100, 80]) => new Creature(500, 300, new DNA(genes), () => 0);
const emptyWorld = (settings = {}) => new Simulation({ rng: seededRandom(), creatureCount: 0, foodCount: 0, poisonCount: 0, foodPerSecond: 0, poisonPerSecond: 0, ...settings });

test('ADN : ordre exact des quatre gènes, copie défensive et immutabilité', () => {
  const input = [1.2, -0.8, 95, 42];
  const dna = new DNA(input);
  input[0] = 0;
  assert.deepEqual([dna.foodWeight, dna.poisonWeight, dna.foodPerception, dna.poisonPerception], [1.2, -0.8, 95, 42]);
  assert.throws(() => { dna.genes[0] = 0; }, TypeError);
});

test('ADN : intervalles originaux et tirages reproductibles', () => {
  assert.deepEqual(DNA.random(() => 0).genes, [-2, -2, 0, 0]);
  const a = seededRandom(), b = seededRandom();
  for (let i = 0; i < 100; i++) assert.deepEqual(DNA.random(a).genes, DNA.random(b).genes);
});

test('ADN : refuse taille incorrecte, NaN, poids excessifs et rayons négatifs', () => {
  for (const genes of [[1], [1, 1, NaN, 10], [3, 1, 20, 20], [1, 1, -1, 20], [1, 1, 101, 20]]) {
    assert.throws(() => new DNA(genes));
  }
});

test('toutes les entités visibles héritent du Vehicle fourni', () => {
  for (const entity of [creature(), new Food(0, 0), new Poison(0, 0)]) assert.ok(entity instanceof Vehicle);
  assert.equal(new Food(0, 0).vel.mag(), 0);
});

test('Seek du cours : desiredVelocity - currentVelocity, limité et sans déplacement direct', () => {
  const c = creature(); c.vel.set(0, -1);
  const before = c.pos.copy();
  const force = c.seek(createVector(600, 300));
  const scale = c.maxForce / Math.hypot(c.maxSpeed, 1);
  near(force.x, c.maxSpeed * scale); near(force.y, scale);
  near(force.mag(), c.maxForce);
  assert.deepEqual(c.pos, before);
});

test('Flee inverse la vitesse désirée avant de soustraire la vitesse courante', () => {
  const c = creature(); c.vel.set(0, 1);
  const force = flee(c, createVector(600, 300));
  assert.ok(force.x < 0 && force.y < 0);
  const invertedSeek = c.seek(createVector(600, 300)).mult(-1);
  assert.ok(invertedSeek.y > 0); // détecte la mauvaise formule du TP
  near(force.mag(), c.maxForce);
});

test('Seek/Flee sur position identique et vitesse nulle : aucun NaN', () => {
  const c = creature(); c.vel.set(0, 0);
  for (const force of [c.seek(c.pos), flee(c, c.pos)]) {
    near(force.mag(), 0);
    assert.ok(Number.isFinite(force.x) && Number.isFinite(force.y));
  }
});

test('poids positif = Seek ; négatif = Flee ; nul ou cible absente = force nulle', () => {
  const c = creature(); c.vel.set(0, 0);
  const target = new Food(550, 300);
  assert.ok(resourceForce(c, target, 1).x > 0);
  assert.ok(resourceForce(c, target, -1).x < 0);
  near(resourceForce(c, target, 0).mag(), 0);
  near(resourceForce(c, null, 1).mag(), 0);
});

test('amplitude génétique effective et limite après pondération', () => {
  const c = creature(); c.vel.set(0, 0); const target = new Food(550, 300);
  near(resourceForce(c, target, 0.2).mag(), c.maxForce * 0.2);
  near(resourceForce(c, target, 2).mag(), c.maxForce);
});

test('somme nourriture/poison : composantes effectives et norme finale limitée', () => {
  const c = creature([2, -2, 100, 100]); c.vel.set(0, 0);
  const force = combinedForce(c, new Food(550, 300), new Poison(500, 350), 1100, 650);
  assert.ok(force.x > 0 && force.y < 0);
  near(force.mag(), c.maxForce);
});

test('perception : plus proche, rayon strict et aucune cible hors perception', () => {
  const a = new Food(520, 300), b = new Food(510, 300);
  const pos = createVector(500, 300);
  assert.equal(nearestResource(pos, [a, b], 30), b);
  assert.equal(nearestResource(pos, [b], 10), null);
  assert.equal(nearestResource(pos, [a], 10), null);
  assert.equal(nearestResource(pos, [b], 0), null);
  assert.equal(nearestResource(pos, [], 100), null);
});

test('les deux rayons génétiques changent indépendamment les forces produites', () => {
  const world = emptyWorld();
  world.food = [new Food(530, 300)]; world.poison = [new Poison(500, 330)];
  const a = creature([1, -1, 0, 0]); a.vel.set(0, 0); a.steer(world); near(a.acc.mag(), 0);
  const b = creature([1, -1, 40, 0]); b.vel.set(0, 0); b.steer(world); assert.ok(b.acc.x > 0); near(b.acc.y, 0);
  const c = creature([1, -1, 0, 40]); c.vel.set(0, 0); c.steer(world); assert.ok(c.acc.y < 0); near(c.acc.x, 0);
});

test('confinement aux coins : corrige les deux axes et reste prioritaire', () => {
  const c = creature(); c.pos.set(10, 10); c.vel.set(-1, -1);
  const force = boundaryForce(c, 1100, 650);
  assert.ok(force.x > 0 && force.y > 0); near(force.mag(), c.maxForce);
  const combined = combinedForce(c, new Food(-100, -100), null, 1100, 650);
  near(combined.x, force.x); near(combined.y, force.y);
});

test('consommation de nourriture : retrait, gain plafonné, indépendance de la perception', () => {
  const c = creature([0, 0, 0, 0]); c.energy = 1.4;
  const resources = [new Food(500, 300), new Food(507, 300), new Food(508, 300)];
  consumeResources(c, resources, 0.25);
  near(c.energy, 1.5); assert.equal(resources.length, 1);
  near(resources[0].pos.x, 508); // distance exactement 8 : non consommé
});

test('poison : énergie réduite, retrait unique et arrêt au décès', () => {
  const c = creature(); c.energy = 0.5;
  const resources = [new Poison(500, 300), new Poison(500, 300)];
  consumeResources(c, resources, -0.65);
  near(c.energy, 0); assert.equal(resources.length, 1); assert.ok(c.dead());
});

test('locomotion déléguée à Vehicle, remise à zéro de acc et perte d’énergie par seconde', () => {
  const c = creature(); const start = c.pos.x;
  c.vel.set(1, 0); c.applyForce(createVector(0.1, 0)); c.tick(1 / 60, 0.06);
  near(c.vel.x, 1.1); near(c.pos.x, start + 1.1); near(c.acc.mag(), 0); near(c.energy, 0.999);
  for (let i = 0; i < 59; i++) c.tick(1 / 60, 0.06);
  near(c.energy, 0.94); assert.ok(c.vel.mag() <= c.maxSpeed);
});

test('initialisation : effectifs, ressources bornées, vecteurs finis', () => {
  const world = new Simulation({ rng: seededRandom() });
  assert.deepEqual([world.creatures.length, world.food.length, world.poison.length], [36, 90, 28]);
  assert.ok(world.creatures.every(finiteCreature));
  assert.ok([...world.creatures, ...world.food, ...world.poison].every(e => e.pos.x >= 0 && e.pos.x <= world.width && e.pos.y >= 0 && e.pos.y <= world.height));
});

test('recherche de nourriture : une créature converge et consomme une cible proche', () => {
  const world = emptyWorld({ energyDrain: 0 });
  const c = creature([1, 0, 100, 0]); c.vel.set(0, 0); c.energy = 0.5;
  world.creatures = [c]; world.food = [new Food(560, 300)];
  for (let i = 0; i < 100; i++) world.step();
  assert.equal(world.food.length, 0); near(c.energy, 0.75); assert.ok(c.pos.x > 500);
});

test('réaction au poison : un poids négatif augmente la distance à la cible', () => {
  const world = emptyWorld({ energyDrain: 0 });
  const c = creature([0, -1, 0, 100]); c.vel.set(0, 0);
  world.creatures = [c]; const poison = new Poison(540, 300); world.poison = [poison];
  const before = c.pos.dist(poison.pos);
  for (let i = 0; i < 20; i++) world.step();
  assert.ok(c.pos.dist(poison.pos) > before); near(c.energy, 1);
});

test('morts propres : retrait sans sauter les voisins, aucune naissance', () => {
  const world = emptyWorld({ energyDrain: 1 });
  const a = creature(), b = creature(); a.energy = 0.001; b.energy = 0;
  world.creatures = [a, b]; world.step();
  assert.equal(world.creatures.length, 0); assert.equal(world.deaths, 2);
  for (let i = 0; i < 100; i++) world.step();
  assert.equal(world.creatures.length, 0); assert.equal(world.food.length, 0);
});

test('un mort ne consomme pas les ressources placées à sa position', () => {
  const world = emptyWorld(); const c = creature(); c.energy = 0;
  world.creatures = [c]; world.food = [new Food(500, 300)]; world.step();
  assert.equal(world.food.length, 1); assert.equal(world.creatures.length, 0);
});

test('la perte passive mène à la mort sans ressources', () => {
  const world = emptyWorld({ energyDrain: 1 }); world.creatures = [creature([0, 0, 0, 0])];
  for (let i = 0; i < 61; i++) world.step();
  assert.equal(world.creatures.length, 0); assert.equal(world.deaths, 1);
});

test('ressources : réapparition au cours du temps et plafonds mémoire', () => {
  const world = emptyWorld({ foodPerSecond: 3, poisonPerSecond: 1, maxFood: 4, maxPoison: 2 });
  for (let i = 0; i < 60; i++) world.step();
  assert.equal(world.food.length, 3); assert.equal(world.poison.length, 1);
  for (let i = 0; i < 600; i++) world.step();
  assert.equal(world.food.length, 4); assert.equal(world.poison.length, 2);
  world.food.pop(); for (let i = 0; i < 20; i++) world.step();
  assert.equal(world.food.length, 4);
});

test('pause : fige temps, positions, énergie et ressources ; reprise sans rattrapage', () => {
  const world = new Simulation({ rng: seededRandom() }); world.advance(1 / 60);
  world.togglePause(); const snapshot = JSON.stringify(world);
  world.advance(120); world.step(); assert.equal(JSON.stringify(world), snapshot);
  world.togglePause(); const time = world.time; world.advance(1 / 60);
  near(world.time, time + 1 / 60);
});

test('réinitialisation complète, y compris pause, temps et budget de ressources', () => {
  const world = new Simulation({ rng: seededRandom() }); const oldCreature = world.creatures[0];
  world.advance(0.2); world.deaths = 9; world.togglePause(); world.reset();
  assert.equal(world.paused, false); near(world.time, 0); near(world.accumulator, 0);
  assert.equal(world.deaths, 0); near(world.foodBudget, 0);
  assert.equal(world.creatures.length, 36); assert.equal(world.food.length, 90); assert.equal(world.poison.length, 28);
  assert.notEqual(world.creatures[0], oldCreature);
});

test('pas fixe : résultats identiques à 30 et 60 rendus/s', () => {
  const a = new Simulation({ rng: seededRandom() }), b = new Simulation({ rng: seededRandom() });
  for (let i = 0; i < 300; i++) a.advance(1 / 30);
  for (let i = 0; i < 600; i++) b.advance(1 / 60);
  assert.deepEqual(a.stats, b.stats);
  assert.deepEqual(a.creatures.map(c => [c.pos.x, c.pos.y, c.energy]), b.creatures.map(c => [c.pos.x, c.pos.y, c.energy]));
});

test('temps invalides ignorés, rattrapage limité après suspension de l’onglet', () => {
  const world = emptyWorld();
  for (const dt of [NaN, Infinity, -1, 0]) world.advance(dt);
  near(world.time, 0); world.advance(300); near(world.time, 0.25);
});

test('ajout interactif : type et coordonnées validés, plafond respecté', () => {
  const world = emptyWorld({ maxFood: 1 });
  assert.equal(world.addResource('food', NaN, 0), false);
  assert.equal(world.addResource('food', -1, 0), false);
  assert.equal(world.addResource('food', 50, 50), true);
  assert.equal(world.addResource('food', 50, 50), false);
  assert.throws(() => world.addResource('enemy', 0, 0));
});

test('configuration incohérente refusée', () => {
  for (const config of [{ width: NaN }, { energyDrain: -1 }, { creatureCount: 0.5 }, { maxFood: 2 }, { poisonEnergy: 1 }]) {
    assert.throws(() => new Simulation(config));
  }
});

test('endurance déterministe : 12 000 pas, aucune valeur NaN ou infinie, limites respectées', () => {
  // Référence de l'étape 2, explicitement sans reproduction ; l'évolution a ses tests dédiés.
  const world = new Simulation({ rng: seededRandom(2026), energyDrain: 0.005, evolution: { mode: 'off' } });
  for (let i = 0; i < 12000; i++) {
    world.step();
    assert.ok(world.creatures.every(c => finiteCreature(c) && c.vel.mag() <= c.maxSpeed + 1e-9 && c.acc.mag() === 0));
    assert.ok(world.creatures.length <= 36 && world.food.length <= 140 && world.poison.length <= 45);
  }
  assert.ok(Number.isFinite(world.stats.meanEnergy));
});
