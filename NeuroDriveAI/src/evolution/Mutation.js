import { Genome, GENE_BOUND } from './Genome.js';
export function mutate(genome, random, rate = .1, amplitude = .2) {
  if (!(genome instanceof Genome)) throw new TypeError('Expected Genome');
  if (!Number.isFinite(rate) || rate < 0 || rate > 1 || !Number.isFinite(amplitude) || amplitude < 0 || amplitude > 5) throw new RangeError('Invalid mutation parameters');
  return new Genome(genome.values.map(value => {
    if (random.next() >= rate || amplitude === 0) return value;
    const noise = Math.max(-5, Math.min(5, random.normal())) * amplitude;
    return Math.max(-GENE_BOUND, Math.min(GENE_BOUND, value + noise));
  }), genome.seed);
}
