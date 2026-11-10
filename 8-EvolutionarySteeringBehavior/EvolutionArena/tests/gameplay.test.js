import './helpers/runtime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDocument, finiteCreature } from './helpers/runtime.js';
import { Simulation } from '../src/simulation/Simulation.js';
import { MISSIONS, getMission, validateMission } from '../src/game/MissionDefinitions.js';
import { MissionManager } from '../src/game/MissionManager.js';
import { MissionProgress } from '../src/game/MissionProgress.js';
import { EcosystemPoints } from '../src/game/EcosystemPoints.js';
import { PlayerActions, ACTIONS } from '../src/game/PlayerActions.js';
import { GameMode } from '../src/game/GameMode.js';
import { missionState, gameResult } from '../src/game/GameResults.js';
import { ProtectionZone } from '../src/entities/ProtectionZone.js';
import { GameInterface } from '../src/ui/GameInterface.js';
import { GameRenderer } from '../src/ui/GameRenderer.js';
import { runMissionTrial, BALANCE_SEEDS } from '../tools/mission-balance.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} ≠ ${b}`);
const start = (id = 1, seed = 2026) => {
  const manager = new MissionManager();
  for (let p = 1; p < id; p++) manager.progress.record({ missionId: p, status: 'won', stars: 1 });
  manager.start(id, seed); return manager;
};
const baseStats = { population: 20, maxGeneration: 1, time: 0, activePredators: 0, seed: 2026, captures: 0 };

test('définitions : cinq missions immuables, durées demandées et configurations sans nouveaux gènes', () => {
  assert.equal(MISSIONS.length, 5); assert.equal(getMission(1).duration, 60);
  assert.equal(getMission(2).duration, 120); assert.equal(getMission(4).duration, 180);
  assert.equal(getMission(4).requiredPredators, 3); assert.equal(getMission(5).generation, 5);
  assert.equal(getMission(5).minimumPopulation, 15);
  assert.throws(() => { MISSIONS[0].simulation.foodCount = 0; }, TypeError);
  assert.throws(() => getMission(99));
});

test('sélection : missions verrouillées, démarrage valide et graine invalide sans destruction', () => {
  const manager = new MissionManager(); assert.equal(manager.status, 'selection');
  assert.throws(() => manager.start(2)); manager.start(1, 42); const world = manager.world;
  assert.throws(() => manager.start(1, -1)); assert.equal(manager.world, world);
  assert.equal(manager.world.seed, 42); assert.notEqual(manager.world, new Simulation());
});

test('prévention des configurations impossibles : plafond, délais, reproduction et menaces', () => {
  const world = new Simulation();
  assert.throws(() => validateMission({ ...getMission(1), minimumPopulation: 500 }, world));
  assert.throws(() => validateMission({ ...getMission(1), deadline: 30 }, world));
  assert.throws(() => validateMission({ ...getMission(1), starPopulation: NaN }, world));
  assert.throws(() => validateMission(getMission(4), world));
  world.configureEvolution({ mode: 'off' }); assert.throws(() => validateMission(getMission(3), world));
});

test('mission 1 : dix créatures exigées à 60 secondes, pas avant, extinction prioritaire', () => {
  const m = getMission(1);
  assert.equal(missionState(m, { ...baseStats, time: 59.99 }).status, 'running');
  assert.equal(missionState(m, { ...baseStats, population: 10, time: 60 }).status, 'won');
  assert.equal(missionState(m, { ...baseStats, population: 9, time: 60 }).status, 'lost');
  assert.equal(missionState(m, { ...baseStats, population: 0, time: 60 }).status, 'lost');
  assert.equal(missionState(m, { ...baseStats, population: 10, time: 61 }).status, 'lost');
});

test('mission 2 : nourriture et poison présents, flux actifs et victoire à 120 secondes', () => {
  const manager = start(2);
  assert.ok(manager.world.food.length > 0 && manager.world.poison.length > 0);
  assert.ok(manager.world.settings.foodPerSecond > 0 && manager.world.settings.poisonPerSecond > 0);
  assert.equal(missionState(manager.mission, { ...baseStats, time: 119 }).status, 'running');
  assert.equal(missionState(manager.mission, { ...baseStats, time: 120 }).status, 'won');
});

test('missions 3 et 5 : génération atteinte et population simultanée, délai respecté', () => {
  assert.equal(missionState(getMission(3), { ...baseStats, maxGeneration: 3 }).status, 'won');
  assert.equal(missionState(getMission(3), { ...baseStats, time: 150 }).status, 'lost');
  assert.equal(missionState(getMission(5), { ...baseStats, population: 14, maxGeneration: 5, time: 100 }).status, 'running');
  assert.equal(missionState(getMission(5), { ...baseStats, population: 15, maxGeneration: 5, time: 100 }).status, 'won');
  assert.equal(missionState(getMission(5), { ...baseStats, population: 14, maxGeneration: 8, time: 240 }).status, 'lost');
});

test('mission 4 : trois chasseurs persistants requis pendant les 180 secondes', () => {
  const manager = start(4); assert.equal(manager.world.stats.activePredators, 3);
  assert.equal(manager.world.predation.energyDrain, 0);
  assert.equal(missionState(manager.mission, { ...baseStats, activePredators: 3, time: 179 }).status, 'running');
  assert.equal(missionState(manager.mission, { ...baseStats, activePredators: 3, time: 180 }).status, 'won');
  assert.equal(missionState(manager.mission, { ...baseStats, activePredators: 2, time: 12 }).status, 'lost');
});

test('chronomètre : accumulateur fixe, temps invalide ignoré, pause fige points et cooldowns', () => {
  const manager = start(); for (let i = 0; i < 60; i++) manager.advance(1 / 60);
  near(manager.world.time, 1);
  for (const dt of [NaN, Infinity, -1, 0]) manager.advance(dt); near(manager.world.time, 1);
  manager.act('food', 500, 300); manager.togglePause(); const snapshot = JSON.stringify(manager);
  manager.advance(300); manager.step(); assert.equal(JSON.stringify(manager), snapshot);
  manager.togglePause(); manager.advance(1 / 60); near(manager.world.time, 1 + 1 / 60);
});

test('fin de mission : arrêt au pas gagnant, résultat gelé et aucune action après victoire', () => {
  const manager = start(); manager.world.time = 60 - 1 / 60; manager.advance(0.25);
  assert.equal(manager.status, 'won'); near(manager.world.time, 60);
  const before = JSON.stringify(manager.result); manager.advance(10); manager.step();
  assert.equal(JSON.stringify(manager.result), before); assert.equal(manager.act('food', 500, 300), false);
  assert.equal(manager.result.stars >= 1, true);
});

test('défaite réelle : extinction, zéro étoile, aucune progression ni régénération après la fin', () => {
  const manager = start(); manager.world.creatures = []; manager.step();
  assert.equal(manager.status, 'lost'); assert.equal(manager.result.stars, 0); assert.equal(manager.progress.isUnlocked(2), false);
  const points = manager.points.available; manager.advance(100); near(manager.points.available, points);
});

test('points : coût atomique, dépenses cumulées, régénération plafonnée et entrées invalides', () => {
  const points = new EcosystemPoints(); assert.equal(points.available, 60);
  assert.equal(points.spend(60), true); near(points.available, 0); assert.equal(points.spend(1), false);
  near(points.spent, 60); points.tick(10); near(points.available, 3.5); points.tick(1000); near(points.available, 100);
  assert.throws(() => points.spend(-1)); assert.throws(() => points.tick(NaN));
  assert.throws(() => new EcosystemPoints({ initial: 200 }));
});

test('nourriture : ressources réelles, coût/cooldown exacts, pas de manipulation de gènes', () => {
  const manager = start(); const dna = manager.world.creatures.map(c => c.dna.genes);
  const before = manager.world.food.length; assert.equal(manager.act('food', 500, 300), true);
  assert.equal(manager.world.food.length, before + 10); near(manager.points.available, 48); near(manager.points.spent, 12);
  assert.equal(manager.act('food', 500, 300), false); assert.equal(manager.world.food.length, before + 10);
  manager.world.time = 6; assert.equal(manager.act('food', 500, 300), true);
  assert.deepEqual(manager.world.creatures.map(c => c.dna.genes), dna);
});

test('échec sans effet : coordonnées invalides, points insuffisants et plafond ne coûtent rien', () => {
  const manager = start(); assert.equal(manager.act('food', NaN, 20), false); near(manager.points.spent, 0);
  while (manager.world.addResource('food', 500, 300)) { /* atteint le plafond */ }
  assert.equal(manager.act('food', 500, 300), false); near(manager.points.spent, 0);
  manager.points.available = 0; assert.equal(manager.act('shelter', 500, 300), false); assert.equal(manager.actions.zone, null);
  assert.equal(manager.act('unknown', 0, 0), false);
});

test('nettoyage : poison local seulement, six éléments au maximum, aucun coût si vide', () => {
  const manager = start(2); manager.world.poison = [];
  assert.equal(manager.act('cleanse', 500, 300), false); near(manager.points.spent, 0);
  for (let i = 0; i < 8; i++) manager.world.addResource('poison', 500 + i, 300);
  manager.world.addResource('poison', 900, 500); assert.equal(manager.act('cleanse', 500, 300), true);
  assert.equal(manager.world.poison.length, 3); near(manager.points.spent, 18);
  assert.ok(manager.world.poison.some(p => p.pos.x === 900));
});

test('protection : entité Vehicle, zone locale de 8 secondes, capture bloquée puis permise', () => {
  const manager = start(4), world = manager.world, c = world.creatures[0], p = world.predators[0];
  c.pos.set(500, 300); p.pos.set(500, 300); p.age = 5; p.state = 'pursue'; p.targetId = c.id;
  assert.equal(manager.act('shelter', 500, 300), true); assert.ok(manager.actions.zone instanceof Vehicle);
  assert.ok(manager.actions.zone instanceof ProtectionZone); assert.equal(world.tryCapture(p), null);
  assert.equal(manager.actions.isProtected(createVector(595, 300)), false); // bord strict
  world.time = 8; manager.actions.update(); assert.equal(manager.actions.zone, null);
  assert.ok(world.tryCapture(p));
});

test('protection limitée : aucun effet sur la faim, aucune protection globale ou permanente', () => {
  const manager = start(4); manager.act('shelter', 500, 300);
  const c = manager.world.creatures[0]; c.pos.set(500, 300); c.energy = 0.00001;
  manager.step(); assert.ok(!manager.world.creatures.includes(c));
  assert.equal(manager.actions.isProtected(createVector(700, 300)), false);
  assert.equal(manager.act('shelter', 500, 300), false); assert.ok(ACTIONS.shelter.cooldown > ACTIONS.shelter.duration);
});

test('abondance : flux temporaire, aucune modification des réglages ni accumulation des effets', () => {
  const manager = start(); const settings = manager.world.settings;
  assert.equal(manager.act('abundance'), true); near(manager.points.spent, 35);
  near(manager.actions.foodRateBonus(), 6); assert.equal(manager.world.settings, settings);
  manager.world.time = 10; near(manager.actions.foodRateBonus(), 0);
  assert.equal(manager.act('abundance'), false); manager.actions.update(); assert.equal(manager.actions.lastEffect, null);
});

test('abondance réelle : bonus alimentaire effectif et taux fractionnaires sans perte de budget', () => {
  let actions;
  const world = new Simulation({ creatureCount: 0, foodCount: 0, poisonCount: 0, foodPerSecond: 1,
    poisonPerSecond: 0, hooks: { foodRateBonus: time => actions?.foodRateBonus(time) ?? 0 } });
  actions = new PlayerActions(world, new EcosystemPoints()); actions.perform('abundance');
  for (let i = 0; i < 60; i++) world.step(); assert.equal(world.food.length, 7);
  const fractional = new Simulation({ creatureCount: 0, foodCount: 0, poisonCount: 0, foodPerSecond: 3.5, poisonPerSecond: 0 });
  for (let i = 0; i < 120; i++) fractional.step(); assert.equal(fractional.food.length, 7);
});

test('extensions moteur neutres au laboratoire et validation des callbacks/bonus', () => {
  assert.throws(() => new Simulation({ hooks: { unknown: () => 0 } }));
  assert.throws(() => new Simulation({ hooks: { foodRateBonus: 1 } }));
  const bad = new Simulation({ hooks: { foodRateBonus: () => NaN } }); assert.throws(() => bad.step());
  const a = new Simulation({ seed: 7 }), b = new Simulation({ seed: 7, hooks: { foodRateBonus: () => 0, isCaptureProtected: () => false } });
  for (let i = 0; i < 120; i++) { a.step(); b.step(); }
  assert.deepEqual(a.stats, b.stats); assert.deepEqual(a.creatures.map(c => c.pos), b.creatures.map(c => c.pos));
});

test('progression : victoire débloque la suite, défaite ne débloque rien, meilleur résultat conservé', () => {
  const progress = new MissionProgress(); assert.equal(progress.isUnlocked(2), false);
  progress.record({ missionId: 1, status: 'lost', stars: 0 }); assert.equal(progress.isUnlocked(2), false);
  progress.record({ missionId: 1, status: 'won', stars: 3 }); assert.equal(progress.isUnlocked(2), true);
  progress.record({ missionId: 1, status: 'won', stars: 1 }); assert.equal(progress.bestStars.get(1), 3);
  assert.equal(progress.nextId(5), null);
});

test('étoiles : 0 en défaite ; 1, 2 ou 3 selon population et dépenses, seuils inclusifs', () => {
  const mission = getMission(1); const actions = { used: 0 };
  const result = (population, spent, status = 'won') => gameResult(mission, { ...baseStats, population }, { spent }, actions, { status, reason: '' }).stars;
  assert.equal(result(44, 25), 1); assert.equal(result(45, 25), 2);
  assert.equal(result(44, 24), 2); assert.equal(result(45, 24), 3); assert.equal(result(45, 0, 'lost'), 0);
});

test('rejouer : nouveau monde avec même graine, points, effets, temps et cooldowns remis à zéro', () => {
  const manager = start(); const world = manager.world; const initial = world.creatures.map(c => [...c.dna.genes]);
  manager.act('shelter', 500, 300); manager.step(); manager.replay();
  assert.notEqual(manager.world, world); assert.equal(manager.world.time, 0); assert.equal(manager.points.available, 60);
  assert.equal(manager.actions.zone, null); assert.equal(manager.actions.used, 0); near(manager.actions.cooldownRemaining('shelter'), 0);
  assert.deepEqual(manager.world.creatures.map(c => c.dna.genes), initial);
});

test('mission suivante et abandon : règles de progression et arrêt immédiat', () => {
  const manager = start(); assert.equal(manager.next(), false);
  manager.world.time = 60 - 1 / 60; manager.step(); assert.equal(manager.next(), true); assert.equal(manager.mission.id, 2);
  manager.showSelection(); const time = manager.world.time; manager.advance(100); near(manager.world.time, time);
  assert.equal(manager.status, 'selection'); assert.equal(manager.actions.enabled, false);
});

test('isolation : laboratoire conservé, réglages non importés, aucune avancée en arrière-plan', () => {
  const laboratory = new Simulation(); laboratory.configureEvolution({ mutationRate: 0.5 });
  const game = new GameMode(laboratory); const before = JSON.stringify(laboratory);
  game.switchTo('survival'); game.missions.start(1); game.advance(0.1);
  assert.equal(JSON.stringify(laboratory), before); assert.equal(game.activeWorld.evolution.mutationRate, 0.01);
  const time = game.missions.world.time; game.switchTo('laboratory'); game.advance(0.1);
  near(game.missions.world.time, time); assert.ok(laboratory.time > 0);
  assert.equal(game.missions.actions.availability('food'), 'Mission inactive ou en pause.');
  game.switchTo('survival'); assert.equal(game.missions.actions.enabled, true);
  assert.throws(() => game.switchTo('unknown'));
});

test('clic Survie : sélection gratuite, interventions uniquement armées et payantes', () => {
  const manager = start(); const count = manager.world.food.length;
  manager.click(500, 300); assert.equal(manager.world.food.length, count);
  assert.equal(manager.arm('food'), true); manager.click(500, 300);
  assert.equal(manager.world.food.length, count + 10); assert.equal(manager.armedAction, null);
  manager.togglePause(); const c = manager.world.creatures[0]; manager.click(c.pos.x, c.pos.y);
  assert.equal(manager.world.selectedId, c.id);
});

test('interface de jeu et HTML réel : sélection, modes, actions, résultat et progression', () => {
  const root = fakeDocument(), game = new GameMode(new Simulation()), ui = new GameInterface(game, root);
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
  for (const id of Object.keys(ui.elements)) assert.ok(ids.includes(id), id);
  root.getElementById('mode-survival').click(); assert.equal(game.mode, 'survival');
  root.getElementById('mission-1').click(); assert.equal(game.missions.status, 'running');
  assert.equal(root.getElementById('laboratory-settings').hidden, true);
  root.getElementById('action-food').click(); assert.equal(game.missions.armedAction, 'food');
  root.getElementById('game-cancel').click(); assert.equal(game.missions.armedAction, null);
  game.missions.world.time = 60 - 1 / 60; game.missions.step(); ui.update();
  assert.equal(root.getElementById('game-results').hidden, false); assert.match(root.getElementById('game-stars').textContent, /★/);
  root.getElementById('game-next').click(); assert.equal(game.missions.mission.id, 2);
  ui.dispose(); root.getElementById('mode-laboratory').click(); assert.equal(game.mode, 'survival');
});

test('rendu des actions : zone visible et abondance sans argument numérique invalide', () => {
  const manager = start(); manager.act('shelter', 500, 300); manager.points.available = 100; manager.act('abundance');
  const circles = []; const p = { width: 880, height: 520 };
  for (const method of ['push', 'pop', 'scale', 'noFill', 'stroke', 'strokeWeight', 'rect', 'fill', 'circle']) {
    p[method] = (...args) => { assert.ok(args.every(v => typeof v !== 'number' || Number.isFinite(v))); if (method === 'circle') circles.push(args[2]); };
  }
  new GameRenderer(p).draw(manager); assert.ok(circles.includes(190));
});

test('application complète : routage pause/reset/clics et retour au laboratoire sans régression', async () => {
  globalThis.window = {};
  const { mountApp } = await import('../src/main.js');
  const root = fakeDocument(); const canvas = { setAttribute() {} };
  const sketch = { width: 880, height: 520, deltaTime: 1000 / 60, mouseX: 100, mouseY: 100, HALF_PI: Math.PI / 2,
    createCanvas(width, height) { this.width = width; this.height = height; return { elt: canvas, parent() {} }; },
    resizeCanvas(width, height) { this.width = width; this.height = height; }, pixelDensity() {}, frameRate() {},
  };
  for (const key of ['background', 'push', 'pop', 'scale', 'stroke', 'strokeWeight', 'line', 'noFill', 'rect', 'noStroke', 'fill', 'circle', 'translate', 'rotate', 'triangle']) {
    sketch[key] = (...args) => assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value)));
  }
  const app = mountApp(sketch, root); sketch.draw(); const laboratoryTime = app.world.time;
  root.getElementById('mode-survival').click(); sketch.draw(); near(app.world.time, laboratoryTime);
  root.getElementById('mission-1').click(); sketch.draw(); const missionWorld = app.game.missions.world;
  const food = missionWorld.food.length; sketch.mousePressed({ target: canvas, shiftKey: true }); assert.equal(missionWorld.food.length, food);
  root.getElementById('action-food').click(); sketch.mousePressed({ target: canvas }); assert.equal(missionWorld.food.length, food + 10);
  root.getElementById('pause').click(); const missionTime = missionWorld.time; sketch.draw(); near(missionWorld.time, missionTime);
  root.getElementById('reset').click(); assert.notEqual(app.game.missions.world, missionWorld); near(app.game.missions.world.time, 0);
  root.getElementById('mode-laboratory').click(); sketch.draw(); near(app.world.time, laboratoryTime + 1 / 60);
  assert.equal(root.getElementById('laboratory-settings').hidden, false);
  app.ui.dispose(); app.gameUI.dispose();
});

for (let id = 1; id <= 5; id++) {
  test(`équilibrage mission ${id} : cinq graines réelles, politique de nourriture limitée, mission réalisable`, () => {
    for (const seed of BALANCE_SEEDS) {
      const result = runMissionTrial(id, seed, 'food');
      assert.equal(result.status, 'won', JSON.stringify(result));
      assert.ok(result.time <= getMission(id).deadline + 1e-6);
      assert.ok(result.spent <= 60 + 0.35 * result.time + 1e-6);
    }
  });
}

test('trois étoiles réalisables dans chaque mission sur au moins une graine testée', () => {
  for (const [id, seed, policy] of [[1, 42, 'efficient'], [2, 7, 'idle'], [3, 42, 'food'], [4, 2026, 'efficient'], [5, 7, 'efficient']]) {
    const result = runMissionTrial(id, seed, policy);
    assert.equal(result.stars, 3, JSON.stringify(result));
  }
});

test('longue session : 20 000 pas actifs avec relecture de mission, aucune valeur NaN', () => {
  const manager = start(4); let attempts = 1;
  for (let i = 0; i < 20000; i++) {
    if (manager.status !== 'running') { manager.replay(); attempts++; }
    manager.step();
    assert.ok([...manager.world.creatures, ...manager.world.predators].every(finiteCreature));
    assert.ok(Number.isFinite(manager.points.available) && manager.points.available >= 0 && manager.points.available <= 100);
    assert.ok(manager.world.metrics.history.length <= 600);
  }
  assert.ok(attempts >= 2);
});
