import { Genome } from './Genome.js';
export function crossover(a, b, random) {
  if (!(a instanceof Genome) || !(b instanceof Genome)) throw new TypeError('Expected compatible genomes');
  return new Genome(a.values.map((value, i) => random.next() < .5 ? value : b.values[i]), a.seed);
}
