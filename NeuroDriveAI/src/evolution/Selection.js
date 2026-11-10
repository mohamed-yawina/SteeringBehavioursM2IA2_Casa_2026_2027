export const score = value => Number.isFinite(value) && value > 0 ? value : 0;
export function selectParent(population, random, strategy = 'tournament', tournamentSize = 5) {
  if (!Array.isArray(population) || !population.length) throw new RangeError('Cannot select from empty population');
  if (!['roulette','tournament'].includes(strategy)) throw new RangeError('Unknown selection strategy');
  if (!Number.isInteger(tournamentSize) || tournamentSize < 1 || tournamentSize > 100) throw new RangeError('Invalid tournament size');
  const pick = () => population[Math.floor(random.next() * population.length)];
  if (strategy === 'tournament') {
    let best = pick();
    for (let i = 1; i < tournamentSize; i++) { const candidate = pick(); if (score(candidate.fitness) > score(best.fitness)) best = candidate; }
    return best;
  }
  const max = population.reduce((n,p) => Math.max(n, score(p.fitness)), 0);
  if (max === 0) return pick();
  const weights = population.map(p => score(p.fitness) / max);
  let r = random.next() * weights.reduce((a,b) => a+b, 0);
  for (let i = 0; i < population.length; i++) { if (r < weights[i]) return population[i]; r -= weights[i]; }
  return population[weights.findLastIndex(w => w > 0)];
}
