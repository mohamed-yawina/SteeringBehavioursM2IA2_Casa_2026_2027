import { score } from './Selection.js';
export function geneticDiversity(individuals) {
  if (individuals.length < 2) return 0;
  const genes = individuals[0].genome.values.length;
  let variance = 0;
  for (let g = 0; g < genes; g++) {
    const mean = individuals.reduce((n,i) => n + i.genome.values[g], 0) / individuals.length;
    variance += individuals.reduce((n,i) => n + (i.genome.values[g] - mean) ** 2, 0) / individuals.length;
  }
  return Math.sqrt(variance / genes);
}
export function generationStatistics(individuals, generation, duration) {
  if (!individuals.length) throw new RangeError('Cannot summarize empty population');
  const maxFitness = Math.max(...individuals.map(i => score(i.fitness)));
  const meanFitness = maxFitness === 0 ? 0 : maxFitness * Math.min(1, individuals.reduce((n,i) => n + score(i.fitness) / maxFitness, 0) / individuals.length);
  return Object.freeze({ generation, duration, population: individuals.length, maxFitness, meanFitness,
    progressingCars: individuals.filter(i => i.checkpoints > 0).length,
    laps: individuals.reduce((n,i) => n + i.result.laps, 0),
    collisions: individuals.filter(i => i.result.crashed).length,
    stagnant: individuals.filter(i => i.termination === 'stagnation').length,
    timeouts: individuals.filter(i => i.termination === 'timeout').length,
    bestCheckpoints: individuals.reduce((n,i) => Math.max(n,i.checkpoints),0), diversity: geneticDiversity(individuals) });
}
