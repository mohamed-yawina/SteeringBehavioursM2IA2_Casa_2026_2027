import { Simulation } from '../simulation/Simulation.js';
import { cloneData, SCIENCE_MODEL_VERSION, DIVERSITY_DEFINITION } from './Experiments.js';
import { describeReplicates } from './Statistics.js';

export function runScientificTrial(configuration, seed, durationSeconds) {
  if (!Number.isInteger(durationSeconds) || durationSeconds < 1 || durationSeconds > 3600) throw new RangeError('Horizon : entier de 1 à 3600 secondes.');
  const config = cloneData(configuration);
  const world = new Simulation({ ...config.environment, seed, evolution: config.evolution, predation: config.predation });
  let extinctionTime = world.creatures.length ? null : 0;
  for (let step = 0; step < durationSeconds * 60 && extinctionTime === null; step++) {
    world.step();
    if (!world.creatures.length) extinctionTime = world.time;
  }
  const stats = world.stats;
  return { seed, configuration: { ...config, seed }, horizonSeconds: durationSeconds, extinct: extinctionTime !== null,
    extinctionTime, censored: extinctionTime === null,
    restrictedSurvival: extinctionTime ?? durationSeconds, finalPopulation: stats.population,
    maxGeneration: stats.maxGeneration, diversity: stats.diversity,
    completedLives: stats.completedLives, meanLifespanDead: stats.completedLives ? stats.meanLifespan : null,
    births: stats.births, deaths: stats.deaths, foodConsumed: stats.foodConsumed, poisonConsumed: stats.poisonConsumed,
    attacks: stats.attacks, captures: stats.captures, predationDeaths: stats.predationDeaths,
  };
}

export function aggregateTrials(trials) {
  if (!trials.length) throw new RangeError('Aucune répétition.');
  return { repetitions: trials.length, extinct: trials.filter(trial => trial.extinct).length,
    extinctionRate: trials.filter(trial => trial.extinct).length / trials.length,
    rightCensored: trials.filter(trial => trial.censored).length,
    restrictedSurvival: describeReplicates(trials.map(trial => trial.restrictedSurvival)),
    finalPopulation: describeReplicates(trials.map(trial => trial.finalPopulation)),
    maxGeneration: describeReplicates(trials.map(trial => trial.maxGeneration)),
    diversityAmongSurvivors: describeReplicates(trials.map(trial => trial.diversity)),
  };
}

export function runScientificBatch(profiles, seeds, durationSeconds, onProfile = () => {}) {
  if (!profiles.length || profiles.length > 8 || new Set(profiles.map(profile => profile.id)).size !== profiles.length) throw new RangeError('Un à huit profils distincts requis.');
  if (!seeds.length || seeds.length > 30 || new Set(seeds).size !== seeds.length
    || seeds.some(seed => !Number.isInteger(seed) || seed < 0 || seed > 0xffffffff)) throw new RangeError('Une à trente graines distinctes requises.');
  const groups = [];
  for (const profile of profiles) {
    const trials = seeds.map(seed => runScientificTrial(profile.configuration, seed, durationSeconds));
    const group = { id: profile.id, label: profile.label, configuration: cloneData(profile.configuration),
      trials, aggregate: aggregateTrials(trials) };
    groups.push(group);
    onProfile(group);
  }
  return { schema: 'evolution-arena-batch-v1', modelVersion: SCIENCE_MODEL_VERSION, diversityDefinition: DIVERSITY_DEFINITION,
    runtime: 'JavaScript, pas fixe 1/60 s',
    horizonSeconds: durationSeconds, seeds: [...seeds],
    caution: 'Résultats descriptifs ; aucune supériorité ni adaptation démontrée. Diversité agrégée conditionnelle aux survivants.', groups };
}
