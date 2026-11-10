import './helpers/runtime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fakeDocument, finiteCreature } from './helpers/runtime.js';
import { DNA } from '../src/core/DNA.js';
import { Creature } from '../src/entities/Creature.js';
import { Predator } from '../src/entities/Predator.js';
import { Simulation } from '../src/simulation/Simulation.js';
import { predationSettings } from '../src/predation/settings.js';
import { selectPrey, nearestThreat } from '../src/predation/targeting.js';
import { predictPosition, pursue, evade } from '../src/behaviors/prediction.js';
import { wander } from '../src/behaviors/wander.js';
import { combinedForce } from '../src/behaviors/steering.js';
import { Food } from '../src/entities/Food.js';
import { Poison } from '../src/entities/Poison.js';
import { Interface } from '../src/ui/Interface.js';
import { ArenaRenderer } from '../src/ui/ArenaRenderer.js';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);
const prey = (x = 500, y = 300) => new Creature(x, y, new DNA([1, -1, 100, 100]), () => 0);
const predator = (x = 450, y = 300, changes = {}) => new Predator(x, y,
  predationSettings({ enabled: true, ...changes }), () => 0.5, 'test-predator');
const worldWith = (predation = {}, changes = {}) => new Simulation({
  seed: 2026, creatureCount: 3, foodCount: 0, poisonCount: 0, foodPerSecond: 0, poisonPerSecond: 0,
  energyDrain: 0, evolution: { mode: 'off' }, ...changes,
  predation: { enabled: true, count: 1, spawnGrace: 0, minimumPrey: 0, ...predation },
});
const arrangeCapture = world => {
  const hunter = world.predators[0];
  const victim = world.creatures[0]; victim.pos.set(500, 300); victim.vel.set(0, 0);
  hunter.pos.set(500, 300); hunter.vel.set(0, 0); hunter.age = 5; hunter.state = 'pursue'; hunter.targetId = victim.id;
  return { hunter, victim };
};

test('Predator hérite du Vehicle fourni et porte énergie, rayons, état et vecteurs finis', () => {
  const hunter = predator(0, 0, { speed: 0.2 });
  assert.ok(hunter instanceof Vehicle); assert.ok(finiteCreature(hunter));
  assert.equal(hunter.state, 'wander'); assert.equal(hunter.energy, 1);
  assert.equal(hunter.perceptionRadius, 160); assert.equal(hunter.captureRadius, 9);
  assert.ok(hunter.vel.mag() <= hunter.maxSpeed);
});

test('détection : proie vivante la plus proche, rayon strict et proies hors portée ignorées', () => {
  const hunter = predator(500, 300); const close = prey(520, 300), far = prey(550, 300);
  const dead = prey(501, 300); dead.energy = 0;
  assert.equal(selectPrey(hunter, [far, dead, close], predationSettings()), close);
  assert.equal(selectPrey(hunter, [prey(660, 300)], predationSettings()), null);
  assert.equal(selectPrey(hunter, [prey(700, 300)], predationSettings()), null);
});

test('hystérésis : conserve la cible pertinente, abandonne la cible morte ou trop éloignée', () => {
  const hunter = predator(500, 300); const current = prey(670, 300), closer = prey(520, 300);
  hunter.targetId = current.id;
  assert.equal(selectPrey(hunter, [current, closer], predationSettings()), current);
  current.pos.set(690, 300); assert.equal(selectPrey(hunter, [current, closer], predationSettings()), closer);
  current.pos.set(550, 300); current.energy = 0;
  assert.equal(selectPrey(hunter, [current, closer], predationSettings()), closer);
});

test('protection des nouveau-nés : exclusion temporaire des descendants, fondateurs admissibles', () => {
  const hunter = predator(); const child = prey(); child.parentId = 'parent'; child.age = 0;
  assert.equal(selectPrey(hunter, [child], predationSettings()), null);
  child.age = 1.5; assert.equal(selectPrey(hunter, [child], predationSettings()), child);
  const founder = prey(); assert.equal(selectPrey(hunter, [founder], predationSettings()), founder);
});

test('prédiction : conversion pixels/pas vers secondes, horizon plafonné et cible inchangée', () => {
  const hunter = predator(0, 0, { speed: 2 }); const target = prey(120, 0); target.vel.set(1, 2);
  const original = target.pos.copy(); const future = predictPosition(hunter, target, 0.75);
  near(future.seconds, 0.75); near(future.position.x, 165); near(future.position.y, 90);
  assert.deepEqual(target.pos, original);
  target.pos.set(12, 0); const nearTarget = predictPosition(hunter, target, 0.75);
  near(nearTarget.seconds, 0.1); near(nearTarget.position.x, 18); near(nearTarget.position.y, 12);
});

test('Pursue : Seek vers la position future, force limitée et aucun déplacement direct', () => {
  const hunter = predator(500, 300); hunter.vel.set(0, 1);
  const target = prey(550, 300); target.vel.set(0, -1);
  const start = hunter.pos.copy(); const result = pursue(hunter, target);
  const expected = hunter.seek(result.prediction.position);
  near(result.force.x, expected.x); near(result.force.y, expected.y);
  near(result.force.mag(), hunter.maxForce); assert.deepEqual(hunter.pos, start);
  assert.ok(result.prediction.position.y < target.pos.y);
});

test('Evade : direction désirée opposée avant soustraction ; différent de -Pursue', () => {
  const c = prey(); c.vel.set(0, 1); const hunter = predator(550, 300); hunter.vel.set(0, 0);
  const result = evade(c, hunter); const invertedPursue = pursue(c, hunter).force.mult(-1);
  assert.ok(result.force.x < 0 && result.force.y < 0); assert.ok(invertedPursue.y > 0);
  near(result.force.mag(), c.maxForce);
});

test('positions confondues, vitesse nulle et acteur immobile : pas de NaN dans les prédictions', () => {
  const hunter = predator(), c = prey(hunter.pos.x, hunter.pos.y);
  hunter.vel.set(0, 0); c.vel.set(0, 0); hunter.maxSpeed = 0;
  for (const result of [pursue(hunter, c), evade(c, hunter)]) {
    assert.ok([result.force.x, result.force.y, result.prediction.position.x, result.prediction.seconds].every(Number.isFinite));
    near(result.force.mag(), 0);
  }
});

test('menace : sélection du prédateur vivant le plus proche dans le rayon utile', () => {
  const c = prey(), nearHunter = predator(520, 300), far = predator(560, 300), dead = predator(501, 300);
  dead.energy = 0;
  assert.equal(nearestThreat(c, [far, dead, nearHunter], 100), nearHunter);
  assert.equal(nearestThreat(c, [nearHunter], 20), null);
});

test('composition : nourriture, poison et Evade contribuent ; norme finale et priorité aux bords', () => {
  const c = prey(); c.vel.set(0, 0); const food = new Food(550, 300), poison = new Poison(500, 350);
  const force = combinedForce(c, food, poison, 1100, 650, {
    foodWeight: 0.2, poisonWeight: 0.3, evadeForce: createVector(-0.16, 0), evadeWeight: 2,
  });
  assert.ok(force.x < 0 && force.y < 0); assert.ok(force.mag() <= c.maxForce + 1e-9);
  c.pos.set(10, 10);
  const edge = combinedForce(c, food, poison, 1100, 650, { evadeForce: createVector(-100, -100) });
  assert.ok(edge.x > 0 && edge.y > 0); near(edge.mag(), c.maxForce);
});

test('lissage : force Evade progressive, poids zéro et absence de modification de l’ADN', () => {
  const world = worldWith({ evadeWeight: 2 }); const c = world.creatures[0]; c.pos.set(500, 300); c.vel.set(0, 0);
  world.predators[0].pos.set(520, 300); world.predators[0].vel.set(0, 0);
  const genes = [...c.dna.genes]; c.steer(world); const first = c.acc.copy();
  assert.ok(first.x < 0 && first.mag() < c.maxForce);
  c.acc.set(0, 0); c.steer(world); assert.ok(c.acc.mag() > first.mag());
  assert.ok(c.acc.mag() <= c.maxForce); assert.deepEqual(c.dna.genes, genes); assert.equal(c.dna.genes.length, 4);
  world.configurePredation({ enabled: false }); world.configurePredation({ enabled: true, evadeWeight: 0 });
  c.acc.set(0, 0); c.steer(world); near(c.acc.mag(), 0);
});

test('hors menace et poids nourriture/poison identiques : force inchangée avec ou sans prédation', () => {
  const world = worldWith(); const c = prey(); c.vel.set(0, 0); world.food = [new Food(550, 300)];
  world.predators[0].pos.set(50, 50); c.steer(world); const active = c.acc.copy();
  c.acc.set(0, 0); world.configurePredation({ enabled: false }); c.steer(world);
  near(active.x, c.acc.x); near(active.y, c.acc.y);
  world.configurePredation({ foodWeight: 0 }); c.acc.set(0, 0); c.steer(world); near(c.acc.mag(), 0);
});

test('Wander : angle continu reproductible, force bornée, aucune modification de position', () => {
  const hunter = predator(); hunter.wanderAngle = 0; hunter.vel.set(0, 0); const position = hunter.pos.copy();
  const force = wander(hunter, () => 1); near(hunter.wanderAngle, 0.08);
  assert.ok(force.mag() <= hunter.maxForce + 1e-9); assert.deepEqual(hunter.pos, position);
  wander(hunter, () => 0); near(hunter.wanderAngle, 0);
});

test('états : Wander sans cible, Pursue avec cible ; attaques comptées par épisode, pas par image', () => {
  const world = worldWith(); const hunter = world.predators[0];
  hunter.pos.set(500, 300); for (const c of world.creatures) c.pos.set(1000, 600);
  hunter.plan(world); assert.equal(hunter.state, 'wander'); near(world.attacks, 0); hunter.acc.set(0, 0);
  world.creatures[0].pos.set(540, 300); hunter.plan(world);
  assert.equal(hunter.state, 'pursue'); assert.equal(world.attacks, 1); hunter.acc.set(0, 0);
  hunter.plan(world); assert.equal(world.attacks, 1);
});

test('capture : suppression unique, mort totale, métriques et effet discret, récupération plafonnée', () => {
  const world = worldWith(); const { hunter, victim } = arrangeCapture(world); hunter.energy = 1.4; victim.age = 12;
  assert.equal(world.tryCapture(hunter), victim); assert.equal(victim.energy, 0); assert.equal(victim.deathCause, 'predator');
  assert.equal(world.creatures.length, 2); assert.equal(world.deaths, 1); assert.equal(world.captures, 1);
  assert.equal(world.predationDeaths, 1); near(world.stats.meanLifespan, 12);
  near(hunter.energy, 1.5); near(hunter.cooldown, 4); assert.equal(hunter.state, 'rest');
  assert.ok(hunter.captureFlash > 0); assert.notEqual(hunter.capturePosition, victim.pos);
});

test('deux prédateurs, même proie : une seule capture et un seul enregistrement de mort', () => {
  const world = worldWith({ count: 2 }); const { hunter, victim } = arrangeCapture(world);
  const other = world.predators[1]; other.pos.set(500, 300); other.age = 5; other.state = 'pursue'; other.targetId = victim.id;
  assert.ok(world.tryCapture(hunter)); assert.equal(world.tryCapture(other), null); assert.equal(world.tryCapture(hunter), null);
  assert.equal(world.captures, 1); assert.equal(world.metrics.completedLives, 1); near(other.energy, 1);
});

test('capture : distance stricte, grâce initiale, protection, cooldown et petit effectif respectés', () => {
  const world = worldWith({ spawnGrace: 3 }); const { hunter, victim } = arrangeCapture(world);
  hunter.pos.set(victim.pos.x + hunter.captureRadius, victim.pos.y); assert.equal(world.tryCapture(hunter), null);
  hunter.pos.set(500, 300); hunter.age = 2; assert.equal(world.tryCapture(hunter), null);
  hunter.age = 5; hunter.cooldown = 0.1; assert.equal(world.tryCapture(hunter), null);
  hunter.cooldown = 0; victim.parentId = 'parent'; victim.age = 0; assert.equal(world.tryCapture(hunter), null);
  victim.age = 2; world.configurePredation({ minimumPrey: 3 }); assert.equal(world.tryCapture(hunter), null);
  world.configurePredation({ minimumPrey: 2 }); assert.ok(world.tryCapture(hunter));
});

test('garde-fou collectif : plusieurs prédateurs ne font pas tomber les proies sous le minimum', () => {
  const world = worldWith({ count: 8, minimumPrey: 6, evadeWeight: 0 }, { creatureCount: 8 });
  for (let i = 0; i < 8; i++) {
    const hunter = world.predators[i], c = world.creatures[i];
    c.pos.set(500 + i, 300); c.vel.set(0, 0);
    hunter.pos.set(c.pos.x, c.pos.y); hunter.vel.set(0, 0); hunter.age = 5; hunter.targetId = c.id;
  }
  world.step(); assert.equal(world.captures, 2); assert.equal(world.creatures.length, 6);
  for (let i = 0; i < 300; i++) world.step();
  assert.equal(world.captures, 2); assert.equal(world.creatures.length, 6);
});

test('ordre : victime capturée retirée avant reproduction, aucune naissance post-mortem', () => {
  const world = worldWith({ evadeWeight: 0 }, { creatureCount: 1, evolution: { mode: 'tp', birthProbability: 1 } });
  const { victim } = arrangeCapture(world); world.step();
  assert.equal(world.captures, 1); assert.equal(world.births, 0); assert.equal(world.creatures.length, 0);
  assert.equal(victim.energy, 0);
});

test('capture : proie morte naturellement, prédateur mort, étranger ou pause refusés', () => {
  const world = worldWith(); const { hunter, victim } = arrangeCapture(world);
  world.togglePause(); assert.equal(world.tryCapture(hunter), null); world.togglePause();
  hunter.energy = 0; assert.equal(world.tryCapture(hunter), null); hunter.energy = 1;
  victim.energy = 0; assert.equal(world.tryCapture(hunter), null);
  assert.equal(world.tryCapture(predator(500, 300)), null); assert.equal(world.captures, 0);
});

test('énergie : drain par seconde via locomotion fournie, faim et absence de remplacement automatique', () => {
  const world = worldWith({ energyDrain: 1, minimumPrey: 100 }); const hunter = world.predators[0];
  const before = hunter.pos.copy(); hunter.applyForce(createVector(0.01, 0)); hunter.tick(1 / 60, 0.06);
  near(hunter.energy, 0.999); near(hunter.acc.mag(), 0); assert.notDeepEqual(hunter.pos, before);
  hunter.energy = 0.001; world.step(); assert.equal(world.predators.length, 0); assert.equal(world.predatorsStarved, 1);
  world.step(); assert.equal(world.predators.length, 0); assert.equal(world.deaths, 0);
  world.configurePredation({ speed: 3 }); assert.equal(world.predators.length, 0);
});

test('activation : prédateurs figés et inoffensifs hors mode actif ; reprise sans énergie offerte', () => {
  const world = worldWith(); const hunter = world.predators[0]; hunter.energy = 0.7;
  world.configurePredation({ enabled: false }); const position = hunter.pos.copy(); const age = hunter.age;
  for (let i = 0; i < 120; i++) world.step();
  assert.equal(world.stats.activePredators, 0); assert.equal(hunter.state, 'inactive');
  assert.deepEqual(hunter.pos, position); near(hunter.age, age); near(hunter.energy, 0.7); assert.equal(world.attacks, 0);
  world.configurePredation({ enabled: true }); world.step(); assert.equal(world.stats.activePredators, 1);
  assert.ok(hunter.energy < 0.7);
});

test('pause : proies, prédateurs, cooldowns, effets et compteurs restent figés', () => {
  const world = worldWith(); const { hunter } = arrangeCapture(world); world.tryCapture(hunter);
  world.togglePause(); const snapshot = JSON.stringify(world); world.advance(12); world.step();
  assert.equal(JSON.stringify(world), snapshot);
});

test('effectif : ajout, retrait, limite 8, paramètres atomiques et états sans cible périmée', () => {
  const world = worldWith({ count: 0 }); assert.equal(world.removePredator(), false);
  for (let i = 0; i < 8; i++) assert.equal(world.addPredator(), true);
  assert.equal(world.addPredator(), false); assert.equal(world.predators.length, 8);
  assert.equal(new Set(world.predators.map(p => p.id)).size, 8);
  assert.equal(world.removePredator(), true); assert.equal(world.predators.length, 7);
  const previous = world.predation;
  for (const change of [{ count: 9 }, { count: 1.5 }, { enabled: 1 }, { speed: NaN }, { captureRadius: 0 }, { evadeWeight: -1 }, { unknown: 1 }]) {
    assert.throws(() => world.configurePredation(change)); assert.equal(world.predation, previous);
  }
});

test('graine et reset : mêmes prédateurs et mêmes événements, fondateurs identiques avec/sans prédateurs', () => {
  const active = worldWith(), witness = worldWith({ enabled: false });
  assert.deepEqual(active.creatures.map(c => [c.pos, c.vel, c.dna.genes]), witness.creatures.map(c => [c.pos, c.vel, c.dna.genes]));
  const initial = active.predators.map(p => [p.pos.copy(), p.vel.copy(), p.wanderAngle]); const id = active.predators[0].id;
  const duplicate = worldWith(); for (let i = 0; i < 600; i++) { active.step(); duplicate.step(); }
  assert.deepEqual(active.stats, duplicate.stats); assert.deepEqual(active.creatures.map(c => c.pos), duplicate.creatures.map(c => c.pos));
  active.reset(); assert.deepEqual(active.predators.map(p => [p.pos, p.vel, p.wanderAngle]), initial);
  assert.notEqual(active.predators[0].id, id); assert.equal(active.captures, 0); assert.equal(active.attacks, 0);
  assert.equal(active.predationDeaths, 0); assert.equal(active.metrics.history[0].predation.enabled, true);
});

test('contrôles UI : activation, cinq paramètres, poids, boutons, diagnostics et compteurs', () => {
  const world = worldWith({ enabled: false }); const root = fakeDocument(); const ui = new Interface(world, root);
  const get = id => root.getElementById(id); get('predators-enabled').checked = true;
  get('predators-enabled').dispatchEvent(new Event('change')); assert.equal(world.predation.enabled, true);
  for (const [id, value, key] of [['predator-count', '3', 'count'], ['predator-speed', '2.1', 'speed'],
    ['predator-perception', '200', 'perceptionRadius'], ['predator-capture', '12', 'captureRadius'],
    ['evade-weight', '3', 'evadeWeight'], ['food-weight', '0.5', 'foodWeight'], ['poison-weight', '2', 'poisonWeight']]) {
    get(id).value = value; get(id).dispatchEvent(new Event('input')); assert.equal(world.predation[key], Number(value));
  }
  get('add-predator').click(); assert.equal(world.predators.length, 4);
  get('remove-predator').click(); assert.equal(world.predators.length, 3);
  get('predator-debug').checked = true; assert.equal(ui.showPredatorDebug, true);
  const { hunter } = arrangeCapture(world); assert.ok(world.tryCapture(hunter)); ui.update();
  assert.equal(get('captures').textContent, '1'); assert.equal(get('predation-deaths').textContent, '1');
  assert.equal(get('active-predators').textContent, '3'); assert.match(get('predation-survival').textContent, /s$/);
  ui.dispose(); get('remove-predator').click(); assert.equal(world.predators.length, 3);
});

test('diagnostic de rendu : prédateurs distincts, prévisions, forces et halo sans argument NaN', () => {
  const world = worldWith(); const { hunter, victim } = arrangeCapture(world);
  victim.pos.set(530, 300); hunter.plan(world); victim.steer(world);
  const fills = [], circles = []; const p = { width: 1100, height: 650, HALF_PI: Math.PI / 2 };
  for (const method of ['background', 'push', 'pop', 'scale', 'stroke', 'strokeWeight', 'line', 'noFill', 'rect', 'noStroke', 'fill', 'circle', 'translate', 'rotate', 'triangle']) {
    p[method] = (...args) => {
      assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value)));
      if (method === 'fill') fills.push(args[0]); if (method === 'circle') circles.push(args[2]);
    };
  }
  const renderer = new ArenaRenderer(world, p); renderer.draw(true, true); assert.ok(fills.includes('#ff765e'));
  hunter.pos.set(victim.pos.x, victim.pos.y); assert.ok(world.tryCapture(hunter)); renderer.draw(true, true);
  assert.ok(circles.includes(12));
});

for (const mode of ['arena', 'tp']) {
  test(`stabilité prédation ${mode} : 20 000 pas, captures actives, quatre gènes et absence de NaN`, () => {
    const world = new Simulation({ seed: 2026, creatureCount: 40, foodCount: 100, poisonCount: 0,
      foodPerSecond: 5, poisonPerSecond: 0, energyDrain: 0.002,
      evolution: { mode, maxPopulation: 100, energyThreshold: 0.4, energyCost: 0.2, minAge: 0.2, cooldown: 1, birthProbability: 0.03 },
      predation: { enabled: true, count: 3, speed: 3, perceptionRadius: 220, captureRadius: 12, energyDrain: 0.002 },
    });
    let maxActive = 0;
    for (let i = 0; i < 20000; i++) {
      world.step(); maxActive = Math.max(maxActive, world.stats.activePredators);
      for (const entity of [...world.creatures, ...world.predators]) {
        assert.ok(finiteCreature(entity) && Number.isFinite(entity.age));
        assert.ok(entity.vel.mag() <= entity.maxSpeed + 1e-9 && entity.acc.mag() === 0);
      }
      assert.ok(world.creatures.every(c => c.dna.genes.length === 4 && c.dna.genes.every(Number.isFinite)));
      assert.ok(world.predators.length <= 8 && world.creatures.length <= 100);
      assert.equal(world.captures, world.predationDeaths);
      assert.equal(world.settings.creatureCount + world.births - world.deaths, world.creatures.length);
      assert.ok(world.metrics.history.length <= 600);
    }
    assert.ok(world.captures > 5); assert.ok(world.attacks >= world.captures); assert.equal(maxActive, 3);
    assert.ok(world.creatures.length > 0); assert.ok(world.births > 0);
  });
}
