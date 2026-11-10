import { mkdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
// Runtime Node de test, explicitement distinct d'une validation p5 navigateur.
import '../tests/helpers/runtime.js';
import { Simulation } from '../src/simulation/Simulation.js';
import { configurationOf, comparisonProfiles } from '../src/science/Experiments.js';
import { runScientificBatch } from '../src/science/ExperimentBatch.js';
import { makeCSV } from '../src/science/CSVExport.js';

export function batchArguments(args) {
  let duration = 120, seeds = [1, 7, 42, 2026, 9001];
  for (let index = 0; index < args.length; index++) {
    const key = args[index], value = args[++index];
    if (key === '--duration') duration = Number(value);
    else if (key === '--seeds' && value && value.split(',').every(part => part.trim())) seeds = value.split(',').map(Number);
    else throw new Error('Options : --duration 120 --seeds 1,7,42,2026,9001');
  }
  return { duration, seeds };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { duration, seeds } = batchArguments(process.argv.slice(2));
  const profiles = comparisonProfiles(configurationOf(new Simulation()));
  const report = runScientificBatch(profiles, seeds, duration, group => {
    console.log(`${group.id} : extinction ${group.aggregate.extinct}/${group.aggregate.repetitions}, population moyenne ${group.aggregate.finalPopulation.mean.toFixed(2)}`);
  });
  report.runtime = `Node ${process.version}, doublure de p5.Vector ; aucun test navigateur`;
  const directory = new URL('../output/science/', import.meta.url);
  await mkdir(directory, { recursive: true });
  await writeFile(new URL('batch.json', directory), JSON.stringify(report, null, 2), 'utf8');
  const headers = ['profile', 'label', 'configuration_json', 'n', 'horizon_s', 'extinctions', 'extinction_rate', 'right_censored',
    'restricted_survival_mean_s', 'restricted_survival_sd_s', 'final_population_mean', 'final_population_sd',
    'max_generation_mean', 'max_generation_sd', 'diversity_survivors_mean', 'diversity_survivors_n'];
  await writeFile(new URL('summary.csv', directory), makeCSV(headers, report.groups.map(group => {
    const a = group.aggregate;
    return [group.id, group.label, JSON.stringify(group.configuration), a.repetitions, duration, a.extinct, a.extinctionRate,
      a.rightCensored, a.restrictedSurvival.mean, a.restrictedSurvival.sd, a.finalPopulation.mean, a.finalPopulation.sd,
      a.maxGeneration.mean, a.maxGeneration.sd, a.diversityAmongSurvivors.mean, a.diversityAmongSurvivors.n];
  })), 'utf8');
  await writeFile(new URL('trials.csv', directory), makeCSV(['profile', 'configuration_json', 'seed', 'horizon_s', 'extinct', 'extinction_time_s',
    'right_censored', 'restricted_survival_s', 'final_population', 'max_generation', 'diversity', 'mean_lifespan_dead_s', 'predation_deaths'],
  report.groups.flatMap(group => group.trials.map(trial => [group.id, JSON.stringify(trial.configuration), trial.seed, duration, trial.extinct,
    trial.extinctionTime, trial.censored, trial.restrictedSurvival, trial.finalPopulation, trial.maxGeneration, trial.diversity,
    trial.meanLifespanDead, trial.predationDeaths]))), 'utf8');
  console.log('Rapports écrits dans output/science/ (remplacés au prochain lancement). Aucune supériorité démontrée.');
}
