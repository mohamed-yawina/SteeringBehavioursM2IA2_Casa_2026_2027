import './helpers/runtime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { finiteCreature, fakeDocument } from './helpers/runtime.js';
import { DNA, GENE_LIMITS } from '../src/core/DNA.js';
import { seededRandom } from '../src/core/random.js';
import { Creature } from '../src/entities/Creature.js';
import { Simulation } from '../src/simulation/Simulation.js';
import { canReproduce, evolutionSettings } from '../src/evolution/reproduction.js';
import { EvolutionMetrics } from '../src/evolution/EvolutionMetrics.js';
import { Interface } from '../src/ui/Interface.js';
import { ArenaRenderer } from '../src/ui/ArenaRenderer.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);
const eligible = () => {
  const c = new Creature(500, 300, new DNA([1, -1, 90, 70]), () => 0);
  c.age = 10; c.energy = 1.4;
  return c;
};
const worldWith = (evolution = {}, settings = {}) => new Simulation({
  creatureCount: 1, foodCount: 0, poisonCount: 0, foodPerSecond: 0, poisonPerSecond: 0,
  energyDrain: 0, seed: 42, ...settings,
  evolution: { birthProbability: 1, mutationRate: 0, ...evolution },
});

test('copie et héritage sans mutation : quatre valeurs identiques, aucun objet partagé', () => {
  const world = worldWith(); const parent = world.creatures[0]; parent.age = 10; parent.energy = 1.4;
  const genes = [...parent.dna.genes]; const child = world.tryReproduce(parent);
  assert.deepEqual(child.dna.genes, genes);
  assert.notEqual(child.dna, parent.dna); assert.notEqual(child.dna.genes, parent.dna.genes);
  const other = new Creature(0, 0, parent.dna);
  assert.notEqual(other.dna, parent.dna); assert.deepEqual(other.dna.genes, genes);
  assert.throws(() => { child.dna.genes[0] = 0; }, TypeError);
});

test('mutation uniforme : amplitudes propres aux poids et perceptions', () => {
  const dna = new DNA([0, 0, 50, 50]);
  const rng = () => 0.75;
  const child = dna.mutated({ probability: 1, amplitude: 1 }, rng);
  assert.deepEqual(child.genes, [0.05, 0.05, 55, 55]);
  assert.deepEqual(dna.genes, [0, 0, 50, 50]);
  assert.deepEqual(dna.mutated({ probability: 1, amplitude: 2 }, rng).genes, [0.1, 0.1, 60, 60]);
});

test('mutations aux limites : saturation par gène, vers les deux bornes', () => {
  const high = new DNA([2, 2, 100, 100]).mutated({ probability: 1, amplitude: 5 }, () => 0.99);
  assert.deepEqual(high.genes, [2, 2, 100, 100]);
  const low = new DNA([-2, -2, 0, 0]).mutated({ probability: 1, amplitude: 5 }, () => 0);
  assert.deepEqual(low.genes, [-2, -2, 0, 0]);
  assert.notEqual(low, high);
});

test('mutation nulle ou amplitude nulle : valeurs conservées avec objet indépendant', () => {
  const dna = new DNA([1, -1, 90, 70]);
  for (const config of [{ probability: 0 }, { probability: 1, amplitude: 0 }]) {
    const copy = dna.mutated(config, seededRandom(3));
    assert.deepEqual(copy.genes, dna.genes); assert.notEqual(copy, dna);
  }
});

test('mutation indépendante par locus et probabilité stricte', () => {
  const values = [0.01, 0, 0.75, 0.5, 0, 0.25];
  const result = new DNA([0, 0, 50, 50]).mutated({ probability: 0.01 }, () => values.shift());
  assert.deepEqual(result.genes, [0, 0.05, 50, 45]);
});

test('référence 1 % : fréquence reproductible compatible sur 40 000 loci', () => {
  const rng = seededRandom(2026); let changed = 0;
  const parent = new DNA([0, 0, 50, 50]);
  for (let i = 0; i < 10000; i++) changed += parent.mutated({}, rng).genes.filter((g, j) => g !== parent.genes[j]).length;
  assert.ok(changed > 250 && changed < 550, `Mutations effectives : ${changed}`);
});

test('validation : ADN creux, paramètres non finis, probabilités et graines invalides refusés', () => {
  assert.throws(() => new DNA(new Array(4)));
  for (const config of [{ probability: NaN }, { probability: 1.1 }, { amplitude: -1 }, { amplitude: Infinity }]) {
    assert.throws(() => new DNA([0, 0, 50, 50]).mutated(config));
  }
  for (const seed of [NaN, -1, 1.5, 4294967296]) assert.throws(() => seededRandom(seed));
  for (const config of [{ maxPopulation: 1.5 }, { maxPopulation: 0 }, { energyCost: 0 }, { mode: 'unknown' }, { minAge: NaN }, { cooldown: -1 }, { alien: 1 }]) {
    assert.throws(() => evolutionSettings(config));
  }
});

test('conditions Arena : seuil exact, âge minimal, réserve supérieure au coût et vivant', () => {
  const config = evolutionSettings(); const c = eligible();
  assert.equal(canReproduce(c, config), true);
  c.energy = config.energyThreshold - 0.001; assert.equal(canReproduce(c, config), false);
  c.energy = config.energyThreshold; assert.equal(canReproduce(c, config), true);
  c.age = config.minAge - 0.001; assert.equal(canReproduce(c, config), false);
  c.age = config.minAge; assert.equal(canReproduce(c, config), true);
  c.energy = config.energyCost; assert.equal(canReproduce(c, config), false);
  c.energy = 0; assert.equal(canReproduce(c, config), false);
});

test('coût énergétique Arena : transfert exact et aucune énergie créée à la naissance', () => {
  const world = worldWith({ energyCost: 0.4 }); const parent = world.creatures[0];
  parent.age = 10; parent.energy = 1.4; const before = parent.energy;
  const child = world.tryReproduce(parent);
  near(parent.energy, 1); near(child.energy, 0.4); near(parent.energy + child.energy, before);
  assert.equal(world.births, 1); assert.equal(parent.offspringCount, 1);
});

test('délai : pas de seconde naissance avant le délai, seuil exact accepté', () => {
  const world = worldWith({ energyThreshold: 0.5, energyCost: 0.1, cooldown: 8 });
  const parent = world.creatures[0]; parent.age = 10; parent.energy = 1.4;
  assert.ok(world.tryReproduce(parent));
  parent.age = 17.999; assert.equal(world.tryReproduce(parent), null);
  parent.age = 18; assert.ok(world.tryReproduce(parent));
  assert.equal(parent.offspringCount, 2);
});

test('échec du tirage ou plafond : aucun coût, aucun délai ni compteur consommé', () => {
  const world = worldWith({ birthProbability: 0 }); const parent = world.creatures[0]; parent.age = 10; parent.energy = 1.4;
  assert.equal(world.tryReproduce(parent), null); near(parent.energy, 1.4);
  assert.equal(parent.lastReproductionAge, null); assert.equal(world.births, 0);
  world.configureEvolution({ birthProbability: 1, maxPopulation: 1 });
  assert.equal(world.tryReproduce(parent), null); near(parent.energy, 1.4); assert.equal(parent.offspringCount, 0);
});

test('filiation réelle : parent, enfant et petit-enfant, générations coexistantes', () => {
  const world = worldWith({ mode: 'tp' }); const parent = world.creatures[0];
  const child = world.tryReproduce(parent); const grandchild = world.tryReproduce(child);
  assert.equal(parent.parentId, null); assert.equal(parent.generation, 1);
  assert.equal(child.parentId, parent.id); assert.equal(child.generation, 2);
  assert.equal(grandchild.parentId, child.id); assert.equal(grandchild.generation, 3);
  assert.equal(world.maxGeneration, 3); assert.equal(world.births, 2);
  assert.equal(parent.offspringCount, 1); assert.equal(child.offspringCount, 1);
  assert.equal(new Set(world.creatures.map(c => c.id)).size, 3);
  assert.equal(new Set(world.creatures.map(c => c.dna)).size, 3);
});

test('mode TP : probabilité 0,002 par défaut, pas de seuil, coût ou délai ; enfant à énergie 1', () => {
  assert.equal(evolutionSettings({ mode: 'tp' }).birthProbability, 0.002);
  const world = worldWith({ mode: 'tp' }); const parent = world.creatures[0]; parent.energy = 0.01;
  const child = world.tryReproduce(parent); assert.ok(child); near(child.energy, 1); near(parent.energy, 0.01);
  assert.ok(world.tryReproduce(parent)); assert.equal(parent.age, 0);
  child.energy = 0; assert.equal(world.tryReproduce(child), null);
});

test('probabilité TP strictement inférieure à 0,002 et un essai par parent par pas', () => {
  const world = worldWith({ mode: 'tp', birthProbability: 0.002 });
  world.geneticRng = () => 0.002;
  assert.equal(world.tryReproduce(world.creatures[0]), null);
  world.geneticRng = () => 0.001;
  world.step(); assert.equal(world.births, 1); assert.equal(world.creatures.length, 2);
  assert.equal(world.creatures[1].age, 0); // nouveau-né non traité dans ce pas
});

test('capacité : naissances simultanées plafonnées, baisse du plafond sans abattage', () => {
  const world = worldWith({ mode: 'tp', maxPopulation: 3 }, { creatureCount: 2 });
  world.step(); assert.equal(world.creatures.length, 3); assert.equal(world.births, 1);
  world.configureEvolution({ maxPopulation: 1 }); world.step();
  assert.equal(world.creatures.length, 3); assert.equal(world.births, 1);
  world.reset(); assert.equal(world.creatures.length, 1);
});

test('pause et mode témoin : aucune naissance ni mutation, reprise normale', () => {
  const world = worldWith({ mode: 'tp' }); world.togglePause();
  assert.equal(world.tryReproduce(world.creatures[0]), null); world.step(); assert.equal(world.births, 0);
  world.togglePause(); world.configureEvolution({ mode: 'off' }); world.step(); assert.equal(world.births, 0);
  world.configureEvolution({ mode: 'tp' }); world.step(); assert.equal(world.births, 1);
});

test('mort avant reproduction : aucun descendant post-mortem, max de génération historique conservé', () => {
  const world = worldWith({ mode: 'tp' }); const parent = world.creatures[0];
  const child = world.tryReproduce(parent); const grandchild = world.tryReproduce(child);
  parent.energy = 0; child.energy = 0; grandchild.energy = 0;
  world.step(); assert.equal(world.births, 2); assert.equal(world.deaths, 3);
  assert.equal(world.maxGeneration, 3); assert.equal(world.creatures.length, 0);
  assert.equal(world.stats.meanAge, 0); assert.deepEqual(world.stats.meanGenes, [0, 0, 0, 0]);
});

test('graine : expérience complète et reset reproductibles, IDs uniques après reset', () => {
  const a = worldWith({ mode: 'tp', mutationRate: 1 }), b = worldWith({ mode: 'tp', mutationRate: 1 });
  const snapshot = world => world.creatures.map(c => [c.pos.x, c.pos.y, c.dna.genes, c.generation, c.age, c.energy]);
  const initial = snapshot(a); const oldId = a.creatures[0].id;
  for (let i = 0; i < 50; i++) { a.step(); b.step(); }
  assert.deepEqual(snapshot(a), snapshot(b)); assert.deepEqual(a.stats, b.stats);
  a.reset(); assert.deepEqual(snapshot(a), initial); assert.notEqual(a.creatures[0].id, oldId);
  assert.equal(a.births, 0); assert.equal(a.deaths, 0); assert.equal(a.maxGeneration, 1);
  assert.equal(a.metrics.history.length, 1); assert.equal(a.selectedId, null);
  a.setSeed(17); assert.equal(a.seed, 17); assert.notDeepEqual(snapshot(a), initial);
});

test('deux modes avec même graine : mêmes fondateurs et même environnement initial', () => {
  const a = new Simulation({ seed: 71, evolution: { mode: 'arena' } });
  const b = new Simulation({ seed: 71, evolution: { mode: 'tp' } });
  assert.deepEqual(a.creatures.map(c => [c.dna.genes, c.pos, c.vel]), b.creatures.map(c => [c.dna.genes, c.pos, c.vel]));
  assert.deepEqual(a.food.map(f => f.pos), b.food.map(f => f.pos));
});

test('statistiques génétiques : moyenne, variance, âge et vies terminées calculés exactement', () => {
  const metrics = new EvolutionMetrics(); const a = eligible(), b = eligible();
  a.dna = new DNA([0, -2, 20, 40]); b.dna = new DNA([2, 0, 40, 60]);
  a.age = 2; b.age = 6; a.energy = 0.5; b.energy = 1.5;
  let result = metrics.summarize([a, b]);
  assert.deepEqual(result.meanGenes, [1, -1, 30, 50]); assert.deepEqual(result.geneVariance, [1, 1, 100, 100]);
  near(result.meanAge, 4); near(result.meanEnergy, 1);
  a.offspringCount = 2; metrics.recordDeath(a); metrics.recordDeath(b);
  metrics.foodConsumed = 6; metrics.poisonConsumed = 1; metrics.creatureSeconds = 10;
  result = metrics.summarize([]); near(result.meanLifespan, 4); near(result.meanLifetimeOffspring, 1);
  near(result.foodPerCreatureSecond, 0.6); near(result.poisonPerCreatureSecond, 0.1);
});

test('historique borné : échantillons indépendants, paramètres et interventions conservés', () => {
  const world = worldWith({ mode: 'off' }); const stats = world.stats;
  for (let i = 0; i < 800; i++) world.metrics.sample(stats, world.evolution);
  assert.equal(world.metrics.history.length, 600);
  stats.meanGenes[0] = 999; assert.notEqual(world.metrics.history[0].meanGenes[0], 999);
  world.configureEvolution({ mutationRate: 0.1 }); assert.equal(world.interventions, 1);
  assert.equal(world.metrics.history.at(-1).settings.mutationRate, 0.1);
});

test('sélection : plus proche, possible en pause, disparition propre après décès', () => {
  const world = worldWith({ mode: 'off' }); const c = world.creatures[0];
  world.togglePause(); assert.equal(world.selectAt(c.pos.x, c.pos.y), c); assert.equal(world.selectedCreature, c);
  world.togglePause(); c.energy = 0; world.step(); assert.equal(world.selectedCreature, null);
  assert.equal(world.selectedId, c.id); assert.equal(world.selectAt(NaN, 0), null);
  world.reset(); assert.equal(world.selectedId, null);
});

test('naissance et génération : halo temporaire, couleur de filiation et sélection visibles', () => {
  const world = worldWith({ mode: 'tp' }); const child = world.tryReproduce(world.creatures[0]);
  const grandchild = world.tryReproduce(child); world.selectedId = grandchild.id;
  const colors = [], circles = [];
  const p = { HALF_PI: Math.PI / 2, fill: color => colors.push(color), circle: (...args) => circles.push(args) };
  for (const method of ['push', 'pop', 'translate', 'noFill', 'strokeWeight', 'stroke', 'noStroke', 'rect', 'rotate', 'triangle', 'line']) p[method] = () => {};
  const renderer = new ArenaRenderer(world, p); renderer.drawCreature(grandchild, false);
  assert.ok(colors.includes('#eec684')); // G3
  assert.ok(circles.some(args => args[2] === 12)); // halo à la naissance
  assert.ok(circles.some(args => args[2] === 24)); // sélection
  world.togglePause(); world.advance(1); near(grandchild.birthFlash, 0.8);
  world.togglePause(); for (let i = 0; i < 49; i++) grandchild.tick(1 / 60, 0);
  near(grandchild.birthFlash, 0);
});

test('contrôles : sliders, mode, nouvelle graine, inspecteur et métriques connectés au moteur', () => {
  const world = worldWith(); const root = fakeDocument(); const ui = new Interface(world, root);
  const get = id => root.getElementById(id);
  for (const [id, value, property] of [['mutation-rate', '0.2', 'mutationRate'], ['mutation-amplitude', '2', 'mutationAmplitude'],
    ['energy-threshold', '0.8', 'energyThreshold'], ['energy-cost', '0.2', 'energyCost'], ['min-age', '2', 'minAge'],
    ['max-population', '50', 'maxPopulation'], ['cooldown', '3', 'cooldown']]) {
    get(id).value = value; get(id).dispatchEvent(new Event('input')); assert.equal(world.evolution[property], Number(value));
  }
  get('reproduction-mode').value = 'tp'; get('reproduction-mode').dispatchEvent(new Event('change'));
  assert.equal(world.evolution.mode, 'tp'); assert.equal(get('energy-cost').disabled, true);
  get('seed').value = '99'; get('seed-reset').click(); assert.equal(world.seed, 99); assert.equal(world.time, 0);
  const c = world.creatures[0]; world.selectAt(c.pos.x, c.pos.y); ui.update();
  assert.match(get('inspector-title').textContent, /Génération 1/); assert.match(get('inspector-detail').textContent, /ADN/);
  const child = world.tryReproduce(c); ui.update(); assert.equal(get('births').textContent, '1');
  assert.equal(get('max-generation').textContent, '2'); assert.ok(child.birthFlash > 0);
  world.selectAt(child.pos.x, child.pos.y); ui.update(); assert.match(get('inspector-detail').textContent, new RegExp(c.id));
  get('seed').value = '-1'; get('seed-reset').click(); assert.equal(world.seed, 99); assert.match(get('control-message').textContent, /graine/);
  ui.dispose();
});

for (const mode of ['arena', 'tp']) {
  test(`stabilité ${mode} : 20 000 pas avec reproduction active, filiation et absence de NaN`, () => {
    const world = new Simulation({ seed: 2026, creatureCount: 12, foodCount: 40, poisonCount: 0,
      poisonPerSecond: 0, energyDrain: 0.002,
      evolution: { mode, minAge: 0.2, cooldown: 1, energyThreshold: 0.4, energyCost: 0.2,
        birthProbability: 0.05, maxPopulation: 64, mutationRate: 0.1, mutationAmplitude: 2 } });
    const knownIds = new Set(world.creatures.map(c => c.id));
    for (let i = 0; i < 20000; i++) {
      world.step();
      assert.ok(world.creatures.length <= 64);
      assert.equal(new Set(world.creatures.map(c => c.id)).size, world.creatures.length);
      assert.equal(new Set(world.creatures.map(c => c.dna)).size, world.creatures.length);
      for (const c of world.creatures) {
        assert.ok(finiteCreature(c) && Number.isFinite(c.age) && Number.isFinite(c.birthFlash));
        assert.ok(c.energy > 0 && c.energy <= c.maxEnergy && c.vel.mag() <= c.maxSpeed + 1e-9);
        assert.ok(c.dna.genes.every((g, j) => g >= GENE_LIMITS[j].min && g <= GENE_LIMITS[j].max));
        if (!knownIds.has(c.id)) { assert.ok(knownIds.has(c.parentId)); knownIds.add(c.id); }
      }
    }
    assert.ok(world.births > 20, `Naissances : ${world.births}`);
    assert.ok(world.maxGeneration >= 3); assert.ok(world.creatures.length > 0);
    assert.equal(world.settings.creatureCount + world.births - world.deaths, world.creatures.length);
    assert.ok(world.metrics.history.length <= 600);
    assert.ok(world.stats.meanGenes.every(Number.isFinite));
  });
}
