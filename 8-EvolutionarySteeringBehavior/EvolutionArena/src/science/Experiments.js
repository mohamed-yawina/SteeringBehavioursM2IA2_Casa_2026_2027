import { Simulation } from '../simulation/Simulation.js';

export const SCIENCE_SCHEMA = 'evolution-arena-science-v1';
export const SCIENCE_MODEL_VERSION = 'arena-0.7.0';
export const DIVERSITY_DEFINITION = 'mean_j(population_variance(gene_j) / range_j^2), j=0..3; empty=null';

export function finiteTree(value) {
  if (value === undefined || ['function', 'symbol', 'bigint'].includes(typeof value)) throw new TypeError('Donnée non sérialisable.');
  if (typeof value === 'number' && !Number.isFinite(value)) throw new RangeError('Les données scientifiques contiennent une valeur non finie.');
  if (value && typeof value === 'object') for (const child of Object.values(value)) finiteTree(child);
  return value;
}

export function cloneData(value) { finiteTree(value); return JSON.parse(JSON.stringify(value)); }

function freezeData(value) {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freezeData(child); Object.freeze(value); }
  return value;
}

export function configurationOf(world) {
  return cloneData({ seed: world.seed, environment: world.settings, evolution: world.evolution, predation: world.predation });
}

export function comparisonProfiles(base) {
  const profiles = [];
  for (const mode of ['tp', 'arena']) for (const predators of [false, true]) for (const mutation of [false, true]) {
    const configuration = cloneData(base);
    configuration.evolution.mode = mode;
    configuration.evolution.mutationRate = mutation ? 0.01 : 0;
    configuration.predation.enabled = predators;
    configuration.predation.count = 2;
    profiles.push(freezeData({ id: `${mode}-p${Number(predators)}-m${Number(mutation)}`,
      label: `${mode === 'tp' ? 'TP comparable' : 'Arena'} / prédateurs ${predators ? 'oui' : 'non'} / mutation ${mutation ? '1 %' : '0 %'}`,
      configuration }));
  }
  return profiles;
}

export function snapshotExperiment(world, label, id) {
  const current = cloneData(world.stats);
  const history = cloneData(world.metrics.history);
  const last = history.at(-1);
  const finalSample = { ...current, sampleIndex: world.metrics.totalSamples + 1, sampleType: 'terminal',
    settings: cloneData(world.evolution), predation: cloneData(world.predation), environment: cloneData(world.settings) };
  // La photo terminale ne modifie pas l'historique du moteur et reste bornée.
  const changed = !last || ['time', 'population', 'births', 'deaths', 'meanEnergy', 'meanAge', 'diversity', 'interventions', 'foodConsumed', 'poisonConsumed', 'captures']
    .some(key => last[key] !== current[key]) || current.meanGenes.some((gene, i) => gene !== last.meanGenes[i]);
  if (changed) history.push(finalSample);
  if (history.length > world.metrics.maxSamples) history.shift();
  const initialConfiguration = cloneData(world.metrics.initialConfiguration ?? configurationOf(world));
  const limitations = [];
  if (world.externalRng) limitations.push('Générateur externe : son état ne peut pas être reconstruit.');
  if (Object.keys(world.hooks).length) limitations.push('Extensions actives : leurs effets ne sont pas sérialisés.');
  if (world.interventions > 0) limitations.push('Les interventions ne sont pas rejouées automatiquement.');
  const runtime = typeof process !== 'undefined' && process.versions?.node
    ? `Node ${process.versions.node} ; vérifier le runtime vectoriel utilisé par l'appelant`
    : `Navigateur ${typeof navigator !== 'undefined' ? navigator.userAgent : 'inconnu'} ; p5.js local 1.7.0`;
  return freezeData({ schema: SCIENCE_SCHEMA, modelVersion: SCIENCE_MODEL_VERSION, runtime, id, label: String(label || id).slice(0, 80),
    initialConfiguration, finalConfiguration: configurationOf(world), current, history,
    totalSamples: world.metrics.totalSamples, terminalPhotoAdded: changed,
    droppedSamples: world.metrics.droppedSamples + Number(history[0]?.sampleIndex > world.metrics.history[0]?.sampleIndex),
    startTimeRetained: history[0]?.time ?? current.time, fixedStep: world.fixedStep,
    sampleIntervalSeconds: 1, historyLimit: world.metrics.maxSamples, limitations,
    replayable: !world.externalRng && Object.keys(world.hooks).length === 0,
    diversityDefinition: DIVERSITY_DEFINITION,
  });
}

export class ExperimentStore {
  constructor(limit = 4) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 8) throw new RangeError('Capacité de comparaison invalide.');
    this.limit = limit;
    this.records = [];
    this.nextId = 1;
  }

  save(world, label) {
    const record = snapshotExperiment(world, label, `exp-${this.nextId++}`);
    this.records.push(record);
    if (this.records.length > this.limit) this.records.shift();
    return record;
  }
}

export function restartExperiment(world, configuration) {
  const config = cloneData(configuration);
  if (!config || !Number.isInteger(config.seed) || !config.environment || !config.evolution || !config.predation) throw new TypeError('Configuration scientifique incomplète.');
  // Réutilise la validation du moteur ; aucun comportement ou constructeur
  // génétique n'est recopié. Cette allocation a lieu uniquement sur demande.
  const validated = new Simulation({ ...config.environment, seed: config.seed, evolution: config.evolution, predation: config.predation });
  world.settings = validated.settings;
  world.seed = validated.seed;
  world.evolution = validated.evolution;
  world.predation = validated.predation;
  world.width = validated.width;
  world.height = validated.height;
  world.externalRng = undefined;
  world.hooks = Object.freeze({});
  world.reset();
}
