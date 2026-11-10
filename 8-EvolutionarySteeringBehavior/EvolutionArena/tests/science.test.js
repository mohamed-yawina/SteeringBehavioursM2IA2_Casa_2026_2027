import './helpers/runtime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDocument } from './helpers/runtime.js';
import { Simulation } from '../src/simulation/Simulation.js';
import { Creature } from '../src/entities/Creature.js';
import { DNA } from '../src/core/DNA.js';
import { EvolutionMetrics } from '../src/evolution/EvolutionMetrics.js';
import { normalizedDiversity, describeReplicates } from '../src/science/Statistics.js';
import { configurationOf, comparisonProfiles, ExperimentStore, restartExperiment, snapshotExperiment, cloneData } from '../src/science/Experiments.js';
import { csvCell, experimentCSV, downloadCSV } from '../src/science/CSVExport.js';
import { runScientificTrial, aggregateTrials, runScientificBatch } from '../src/science/ExperimentBatch.js';
import { CHARTS, chartCoordinates, TimeSeriesCharts } from '../src/ui/TimeSeriesCharts.js';
import { ScienceInterface } from '../src/ui/ScienceInterface.js';
import { batchArguments } from '../tools/science-batch.mjs';

const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≠ ${b}`);
const creature = genes => new Creature(500, 300, new DNA(genes), () => 0);
const defaultConfig = () => configurationOf(new Simulation());

function parseCSV(text) {
  const rows = []; let row = [], cell = '', quoted = false;
  const source = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < source.length; i++) {
    const char = source[i];
    if (char === '"') {
      if (quoted && source[i + 1] === '"') { cell += '"'; i++; } else quoted = !quoted;
    } else if (char === ',' && !quoted) { row.push(cell); cell = ''; }
    else if (char === '\n' && !quoted) { row.push(cell.replace(/\r$/, '')); rows.push(row); row = []; cell = ''; }
    else cell += char;
  }
  return rows;
}

function fakeContext() {
  const calls = [];
  const context = {};
  for (const method of ['setTransform', 'clearRect', 'beginPath', 'moveTo', 'lineTo', 'stroke', 'fillText', 'setLineDash', 'fillRect']) {
    context[method] = (...args) => {
      assert.ok(args.every(arg => typeof arg !== 'number' || Number.isFinite(arg)), method);
      calls.push([method, ...args]);
    };
  }
  return { context, calls };
}

test('gènes : moyennes, extrêmes, variance et écart-type de population sur données connues', () => {
  const metrics = new EvolutionMetrics(); const result = metrics.summarize([
    creature([0, -2, 20, 40]), creature([2, 0, 40, 60]),
  ]);
  assert.deepEqual(result.meanGenes, [1, -1, 30, 50]);
  assert.deepEqual(result.geneMin, [0, -2, 20, 40]); assert.deepEqual(result.geneMax, [2, 0, 40, 60]);
  assert.deepEqual(result.geneVariance, [1, 1, 100, 100]); assert.deepEqual(result.geneStd, [1, 1, 10, 10]);
  near(result.diversity, (1 / 16 + 1 / 16 + 100 / 10000 + 100 / 10000) / 4);
});

test('diversité : clones à zéro, extrêmes à 0,25 et population vide non définie', () => {
  const metrics = new EvolutionMetrics();
  near(metrics.summarize([creature([1, -1, 20, 80]), creature([1, -1, 20, 80])]).diversity, 0);
  near(metrics.summarize([creature([-2, -2, 0, 0]), creature([2, 2, 100, 100])]).diversity, 0.25);
  assert.equal(metrics.summarize([]).diversity, null);
  assert.equal(normalizedDiversity([0, 0, 0, 0], 0), null);
  assert.throws(() => normalizedDiversity([NaN, 0, 0, 0], 2));
  assert.throws(() => normalizedDiversity([0, 0, 0, 0], -1));
});

test('population vide : pas de NaN, extrêmes et écarts-types absents, compteurs historiques préservés', () => {
  const metrics = new EvolutionMetrics(); const stats = metrics.summarize([]);
  assert.deepEqual(stats.meanGenes, [0, 0, 0, 0]); // compatibilité du moteur
  assert.deepEqual(stats.geneMin, [null, null, null, null]); assert.deepEqual(stats.geneStd, [null, null, null, null]);
  assert.equal(stats.geneticSampleSize, 0); assert.doesNotThrow(() => cloneData(stats));
});

test('réplicats : moyenne et écart-type échantillonnal n−1, cas absent/unique explicites', () => {
  const result = describeReplicates([1, 3, null]);
  near(result.mean, 2); near(result.sd, Math.sqrt(2)); assert.equal(result.n, 2);
  assert.equal(describeReplicates([1]).sd, null); assert.equal(describeReplicates([]).mean, null);
  assert.throws(() => describeReplicates([NaN]));
});

test('historique : 1 Hz, événements de paramètres datés et paramètres environnementaux complets', () => {
  const world = new Simulation(); for (let i = 0; i < 120; i++) world.step();
  assert.equal(world.metrics.history.length, 3); near(world.metrics.history[2].time, 2);
  assert.equal(world.metrics.history[0].environment.foodCount, 90);
  world.configureEvolution({ mutationRate: 0 });
  const last = world.metrics.history.at(-1); near(last.time, 2); assert.equal(last.settings.mutationRate, 0);
  assert.equal(last.sampleType, 'configuration'); assert.equal(world.metrics.history[0].sampleType, 'initial');
  assert.equal(world.metrics.initialConfiguration.evolution.mutationRate, 0.01);
});

test('historique borné : pertes annoncées, configuration initiale préservée et instantanés indépendants', () => {
  const world = new Simulation(); world.metrics.maxSamples = 3;
  for (let i = 0; i < 300; i++) world.step();
  assert.equal(world.metrics.history.length, 3); assert.equal(world.metrics.totalSamples, 6); assert.equal(world.metrics.droppedSamples, 3);
  assert.equal(world.metrics.initialConfiguration.seed, 2026);
  const copy = snapshotExperiment(world, 'Trace', 'test');
  const before = copy.history[0].geneMin[0]; world.metrics.history[0].geneMin[0] = -999;
  assert.equal(copy.history[0].geneMin[0], before); assert.ok(copy.startTimeRetained > 0);
});

test('capture de trace : lecture seule, photo terminale et limite de quatre expériences', () => {
  const world = new Simulation(); world.advance(0.1); const before = JSON.stringify(world);
  const store = new ExperimentStore(); const record = store.save(world, 'Test');
  assert.equal(JSON.stringify(world), before); near(record.history.at(-1).time, world.time);
  assert.ok(Object.isFrozen(record.history));
  for (let i = 0; i < 4; i++) store.save(world, `Autre ${i}`);
  assert.equal(store.records.length, 4); assert.equal(store.records[0].id, 'exp-2');
});

test('reproductibilité : paramètres enregistrés, même état après relance et même nombre de pas', () => {
  const world = new Simulation({ seed: 42 }); const config = configurationOf(world);
  for (let i = 0; i < 600; i++) world.step();
  const state = world.creatures.map(c => [c.pos.x, c.pos.y, c.energy, c.dna.genes]); const stats = world.stats;
  restartExperiment(world, config); for (let i = 0; i < 600; i++) world.step();
  assert.deepEqual(world.creatures.map(c => [c.pos.x, c.pos.y, c.energy, c.dna.genes]), state); assert.deepEqual(world.stats, stats);
});

test('relance atomique : configuration invalide refusée sans modifier le monde courant', () => {
  const world = new Simulation(); const before = JSON.stringify(world), config = defaultConfig(); config.seed = -1;
  assert.throws(() => restartExperiment(world, config)); assert.equal(JSON.stringify(world), before);
  assert.throws(() => restartExperiment(world, { seed: 42 })); assert.throws(() => cloneData({ invalid: NaN }));
});

test('huit configurations : axes indépendants, mêmes autres paramètres et aucune mutation du modèle source', () => {
  const config = defaultConfig(); const before = JSON.stringify(config), profiles = comparisonProfiles(config);
  assert.equal(profiles.length, 8); assert.equal(new Set(profiles.map(p => p.id)).size, 8);
  assert.equal(JSON.stringify(config), before);
  const a = profiles.find(p => p.id === 'arena-p0-m0'), b = profiles.find(p => p.id === 'arena-p0-m1');
  assert.equal(a.configuration.evolution.mutationRate, 0); assert.equal(b.configuration.evolution.mutationRate, 0.01);
  assert.deepEqual(a.configuration.environment, b.configuration.environment);
  assert.deepEqual(a.configuration.predation, b.configuration.predation);
  assert.throws(() => { a.configuration.seed = 1; }, TypeError);
});

test('limites de déterminisme : générateur externe, hooks et interventions signalés', () => {
  const external = new Simulation({ rng: () => 0.5 });
  assert.equal(snapshotExperiment(external, 'Ext', 'e').replayable, false);
  const hooks = new Simulation({ hooks: { foodRateBonus: () => 0 } });
  assert.equal(snapshotExperiment(hooks, 'Hook', 'h').replayable, false);
  const world = new Simulation(); world.configurePredation({ count: 1 });
  const record = snapshotExperiment(world, 'Modifié', 'm'); assert.ok(record.limitations.some(text => /interventions/.test(text)));
  assert.equal(record.initialConfiguration.predation.count, 2); assert.equal(record.finalConfiguration.predation.count, 1);
});

test('CSV : lignes rectangulaires, métadonnées parsables, quatre gènes et précision numérique', () => {
  const world = new Simulation({ seed: 7 }); for (let i = 0; i < 60; i++) world.step();
  const record = snapshotExperiment(world, 'A, "B"\nC', 'csv'); const csv = experimentCSV(record), rows = parseCSV(csv);
  assert.ok(csv.startsWith('\uFEFF')); assert.ok(rows.every(row => row.length === rows[0].length));
  const value = (row, key) => row[rows[0].indexOf(key)];
  assert.equal(value(rows[1], 'label'), 'A, "B"\nC');
  const config = JSON.parse(value(rows[1], 'initial_configuration_json'));
  assert.equal(config.seed, 7); assert.equal(config.environment.energyDrain, 0.035);
  assert.equal(Number(value(rows.at(-1), 'foodWeight_mean')), record.history.at(-1).meanGenes[0]);
  assert.ok(rows[0].includes('poisonPerception_sd') && rows[0].includes('predation_deaths'));
});

test('CSV : population vide et durée de vie non observée exportées en cellules vides', () => {
  const world = new Simulation({ creatureCount: 0 }); const rows = parseCSV(experimentCSV(snapshotExperiment(world, 'Vide', 'empty')));
  for (const name of ['foodWeight_mean', 'foodWeight_min', 'diversity', 'mean_lifespan_dead_s']) {
    assert.equal(rows[1][rows[0].indexOf(name)], '');
  }
  assert.ok(!rows.flat().includes('NaN'));
});

test('CSV : échappement des textes et formules, sans transformer les nombres négatifs', () => {
  assert.equal(csvCell('=1+1'), "'=1+1"); assert.equal(csvCell('-danger'), "'-danger");
  assert.equal(csvCell(-1.5), '-1.5'); assert.equal(csvCell('a"b,c'), '"a""b,c"');
  assert.throws(() => csvCell(Infinity));
});

test('téléchargement : un seul fichier CSV et URL temporaire libérée après le clic', () => {
  const calls = []; const link = { click() { calls.push('click'); }, remove() { calls.push('remove'); } };
  const root = { createElement: () => link, body: { append() { calls.push('append'); } } };
  const browser = { URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => calls.push('revoke') }, setTimeout: fn => fn() };
  downloadCSV('a,b\r\n1,2', 'test.csv', root, browser);
  assert.equal(link.download, 'test.csv'); assert.deepEqual(calls, ['append', 'click', 'remove', 'revoke']);
});

test('graphiques : temps réel sur l’axe x, aucune division par zéro, lacune après extinction', () => {
  const chart = CHARTS.find(c => c.id === 'chart-gene-0');
  const history = [{ time: 0, population: 1, meanGenes: [0] }, { time: 1, population: 1, meanGenes: [1] }, { time: 10, population: 0, meanGenes: [0] }];
  const geometry = chartCoordinates(history, chart, 500, 190);
  near((geometry.points[0][1].x - geometry.points[0][0].x) / (500 - 62), 0.1);
  assert.equal(geometry.points[0][2], null);
  assert.doesNotThrow(() => chartCoordinates([{ ...history[0], time: 0 }], chart, 500, 190));
});

test('graphiques Canvas : rendu seulement si échantillon, taille ou source changent', () => {
  const root = fakeDocument(); const { context } = fakeContext();
  for (const chart of CHARTS) root.getElementById(chart.id).getContext = () => context;
  const world = new Simulation(), charts = new TimeSeriesCharts(root, 2);
  charts.update(world.metrics); assert.equal(charts.drawCount, 9);
  charts.update(world.metrics); assert.equal(charts.drawCount, 9);
  for (let i = 0; i < 60; i++) world.step(); charts.update(world.metrics); assert.equal(charts.drawCount, 18);
  world.reset(); charts.update(world.metrics); assert.equal(charts.drawCount, 27);
});

test('tableau scientifique : contrôles, export, traces et relance des paramètres finaux', () => {
  const world = new Simulation(), root = fakeDocument(), downloads = [];
  const science = new ScienceInterface(world, root, { download: (text, name) => downloads.push({ text, name }) });
  const get = id => root.getElementById(id);
  get('science-profile').value = 'tp-p1-m0'; get('science-seed').value = '42'; get('science-apply').click();
  assert.equal(world.seed, 42); assert.equal(world.evolution.mode, 'tp'); assert.equal(world.evolution.mutationRate, 0);
  assert.equal(world.predation.enabled, true); get('science-save').click(); assert.equal(science.store.records.length, 1);
  world.configureEvolution({ mutationRate: 0.25 }); get('experiment-replay-0').click(); assert.equal(world.evolution.mutationRate, 0);
  get('science-export').click(); assert.equal(downloads.length, 1); assert.ok(downloads[0].text.includes('initial_configuration_json'));
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  for (const id of Object.keys(science.elements)) assert.ok(ids.includes(id), id);
  science.dispose(); get('science-save').click(); assert.equal(science.store.records.length, 1);
});

test('répétitions : extinction observée et durée censurée à l’horizon ne sont pas confondues', () => {
  const config = defaultConfig(); config.environment = { ...config.environment, creatureCount: 1, foodCount: 0, poisonCount: 0,
    foodPerSecond: 0, poisonPerSecond: 0, energyDrain: 1 }; config.evolution.mode = 'off';
  const dead = runScientificTrial(config, 1, 3); assert.equal(dead.extinct, true); assert.equal(dead.censored, false);
  assert.ok(dead.extinctionTime < 3); assert.equal(dead.diversity, null);
  config.environment.energyDrain = 0; const alive = runScientificTrial(config, 1, 3);
  assert.equal(alive.censored, true); assert.equal(alive.restrictedSurvival, 3); assert.equal(alive.extinctionTime, null);
});

test('agrégation : tous les essais pour population/survie, seulement survivants pour diversité', () => {
  const trials = [
    { extinct: true, censored: false, restrictedSurvival: 1, finalPopulation: 0, maxGeneration: 1, diversity: null },
    { extinct: false, censored: true, restrictedSurvival: 3, finalPopulation: 10, maxGeneration: 3, diversity: 0.1 },
  ];
  const result = aggregateTrials(trials); near(result.extinctionRate, 0.5); near(result.finalPopulation.mean, 5);
  near(result.restrictedSurvival.mean, 2); near(result.diversityAmongSurvivors.mean, 0.1);
  assert.equal(result.diversityAmongSurvivors.n, 1); assert.equal(result.rightCensored, 1);
});

test('batch : graines identiques, huit bras conservés, résultats répétables et validation des entrées', () => {
  const profiles = comparisonProfiles(defaultConfig());
  const a = runScientificBatch(profiles, [1, 7], 3), b = runScientificBatch(profiles, [1, 7], 3);
  assert.equal(a.groups.length, 8); assert.deepEqual(a, b);
  assert.equal(a.groups[0].trials[0].configuration.seed, 1);
  assert.throws(() => runScientificBatch(profiles, [1, 1], 3)); assert.throws(() => runScientificBatch(profiles, [-1], 3));
  assert.throws(() => runScientificTrial(defaultConfig(), 1, Infinity));
  assert.deepEqual(batchArguments(['--duration', '30', '--seeds', '1,42']), { duration: 30, seeds: [1, 42] });
  assert.throws(() => batchArguments(['--seeds', '1,,2']));
});

test('longue simulation scientifique : 40 000 pas, historique plafonné, données et export sans NaN', () => {
  const world = new Simulation({ seed: 2026, energyDrain: 0.005 });
  for (let i = 0; i < 40000; i++) {
    world.step();
    if (i % 60 === 0) {
      const sample = world.metrics.history.at(-1);
      assert.ok(sample.diversity === null || (Number.isFinite(sample.diversity) && sample.diversity >= 0 && sample.diversity <= 0.25 + 1e-9));
      assert.ok(world.metrics.history.length <= 600);
    }
  }
  assert.ok(world.metrics.droppedSamples > 0);
  const record = snapshotExperiment(world, 'Longue', 'long'); assert.ok(record.history.length <= 600);
  const rows = parseCSV(experimentCSV(record)); assert.ok(rows.length <= 601);
  assert.ok(!rows.flat().includes('NaN')); assert.ok(record.startTimeRetained > 0);
});
