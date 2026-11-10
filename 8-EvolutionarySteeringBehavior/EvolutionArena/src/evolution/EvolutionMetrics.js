import { normalizedDiversity } from '../science/Statistics.js';

export class EvolutionMetrics {
  constructor() {
    this.foodConsumed = 0;
    this.poisonConsumed = 0;
    this.creatureSeconds = 0;
    this.deathAgeSum = 0;
    this.completedLives = 0;
    this.offspringAtDeath = 0;
    this.mutatedGenes = 0;
    this.capSeconds = 0;
    this.history = [];
    this.maxSamples = 600;
    this.totalSamples = 0;
    this.droppedSamples = 0;
    this.initialConfiguration = null;
  }

  recordDeath(creature) {
    this.deathAgeSum += creature.age;
    this.completedLives++;
    this.offspringAtDeath += creature.offspringCount;
  }

  summarize(creatures) {
    const count = creatures.length;
    const meanGenes = [0, 0, 0, 0];
    const geneMin = count ? [Infinity, Infinity, Infinity, Infinity] : [null, null, null, null];
    const geneMax = count ? [-Infinity, -Infinity, -Infinity, -Infinity] : [null, null, null, null];
    let energy = 0, age = 0;
    for (const creature of creatures) {
      energy += creature.energy;
      age += creature.age;
      creature.dna.genes.forEach((gene, i) => {
        meanGenes[i] += gene / count;
        geneMin[i] = Math.min(geneMin[i], gene);
        geneMax[i] = Math.max(geneMax[i], gene);
      });
    }
    const geneVariance = [0, 0, 0, 0];
    for (const creature of creatures) {
      creature.dna.genes.forEach((gene, i) => { geneVariance[i] += (gene - meanGenes[i]) ** 2 / count; });
    }
    return {
      meanEnergy: count ? energy / count : 0, meanAge: count ? age / count : 0,
      meanGenes, geneVariance,
      geneMin, geneMax, geneStd: geneVariance.map(value => count ? Math.sqrt(value) : null),
      geneticSampleSize: count, diversity: normalizedDiversity(geneVariance, count),
      meanLifespan: this.completedLives ? this.deathAgeSum / this.completedLives : 0,
      meanLifetimeOffspring: this.completedLives ? this.offspringAtDeath / this.completedLives : 0,
      foodPerCreatureSecond: this.creatureSeconds ? this.foodConsumed / this.creatureSeconds : 0,
      poisonPerCreatureSecond: this.creatureSeconds ? this.poisonConsumed / this.creatureSeconds : 0,
      foodConsumed: this.foodConsumed, poisonConsumed: this.poisonConsumed,
      mutatedGenes: this.mutatedGenes, completedLives: this.completedLives, capSeconds: this.capSeconds,
    };
  }

  sample(stats, settings, predation = {}, environment = {}, sampleType = 'interval') {
    if (!this.initialConfiguration) this.initialConfiguration = Object.freeze({ seed: stats.seed ?? null,
      environment: Object.freeze({ ...environment }), evolution: Object.freeze({ ...settings }), predation: Object.freeze({ ...predation }) });
    // Copie des valeurs, jamais de référence à une créature morte ou à son ADN.
    this.totalSamples++;
    this.history.push({ ...stats, sampleIndex: this.totalSamples, sampleType,
      meanGenes: [...stats.meanGenes], geneVariance: [...stats.geneVariance],
      geneMin: [...(stats.geneMin ?? [null, null, null, null])], geneMax: [...(stats.geneMax ?? [null, null, null, null])],
      geneStd: [...(stats.geneStd ?? [null, null, null, null])],
      settings: { ...settings }, predation: { ...predation }, environment: { ...environment } });
    if (this.history.length > this.maxSamples) { this.history.shift(); this.droppedSamples++; }
  }
}
