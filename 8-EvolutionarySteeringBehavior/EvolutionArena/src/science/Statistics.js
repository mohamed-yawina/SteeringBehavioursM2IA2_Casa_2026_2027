import { GENE_LIMITS } from '../core/DNA.js';

export function normalizedDiversity(variances, population) {
  if (!Number.isInteger(population) || population < 0) throw new RangeError('Effectif invalide.');
  if (population === 0) return null; // absence de données ≠ homogénéité génétique
  if (variances.length !== 4 || variances.some(value => !Number.isFinite(value) || value < 0)) {
    throw new RangeError('Variances génétiques invalides.');
  }
  let sum = 0;
  for (let i = 0; i < 4; i++) sum += variances[i] / (GENE_LIMITS[i].max - GENE_LIMITS[i].min) ** 2;
  return sum / 4;
}

export function describeReplicates(values) {
  const usable = values.filter(value => value !== null);
  if (usable.some(value => !Number.isFinite(value))) throw new RangeError('Mesure non finie.');
  const n = usable.length;
  if (!n) return { n: 0, mean: null, min: null, max: null, sd: null };
  let mean = 0, m2 = 0, count = 0;
  for (const value of usable) {
    count++;
    const delta = value - mean;
    mean += delta / count;
    m2 += delta * (value - mean);
  }
  return { n, mean, min: Math.min(...usable), max: Math.max(...usable), sd: n > 1 ? Math.sqrt(Math.max(0, m2) / (n - 1)) : null };
}
