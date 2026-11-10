export const GENE_LIMITS = Object.freeze([
  Object.freeze({ name: 'foodWeight', min: -2, max: 2, mutationStep: 0.1 }),
  Object.freeze({ name: 'poisonWeight', min: -2, max: 2, mutationStep: 0.1 }),
  Object.freeze({ name: 'foodPerception', min: 0, max: 100, mutationStep: 10 }),
  Object.freeze({ name: 'poisonPerception', min: 0, max: 100, mutationStep: 10 }),
]);

export class DNA {
  constructor(genes) {
    if (!Array.isArray(genes) || genes.length !== 4 || !Array.from(genes).every(Number.isFinite)) {
      throw new TypeError('Un ADN doit contenir exactement quatre nombres finis.');
    }
    if (GENE_LIMITS.some((rule, index) => genes[index] < rule.min || genes[index] > rule.max)) {
      throw new RangeError('Poids dans [-2, 2], perceptions dans [0, 100] pixels.');
    }
    this.genes = Object.freeze([...genes]);
    Object.freeze(this);
  }

  static random(rng = Math.random) {
    // Ordre et intervalles initiaux du TP original.
    return new DNA([rng() * 4 - 2, rng() * 4 - 2, rng() * 100, rng() * 100]);
  }

  copy() { return new DNA(this.genes); }

  mutated({ probability = 0.01, amplitude = 1 } = {}, rng = Math.random) {
    if (!Number.isFinite(probability) || probability < 0 || probability > 1
      || !Number.isFinite(amplitude) || amplitude < 0 || amplitude > 5) {
      throw new RangeError('Mutation : probabilité [0, 1], amplitude [0, 5].');
    }
    const genes = this.genes.map((value, index) => {
      const rule = GENE_LIMITS[index];
      if (rng() >= probability) return value;
      // Tirage indépendant par gène, perturbation uniforme comme dans le TP.
      const delta = (rng() * 2 - 1) * rule.mutationStep * amplitude;
      return Math.max(rule.min, Math.min(rule.max, value + delta));
    });
    return new DNA(genes); // toujours un objet indépendant, même sans mutation
  }

  get foodWeight() { return this.genes[0]; }
  get poisonWeight() { return this.genes[1]; }
  get foodPerception() { return this.genes[2]; }
  get poisonPerception() { return this.genes[3]; }
}
