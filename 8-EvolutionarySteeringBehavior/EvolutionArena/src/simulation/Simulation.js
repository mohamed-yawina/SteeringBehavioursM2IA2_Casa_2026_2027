import { DNA } from '../core/DNA.js';
import { Creature } from '../entities/Creature.js';
import { Food } from '../entities/Food.js';
import { Poison } from '../entities/Poison.js';
import { consumeResources } from '../behaviors/perception.js';
import { seededRandom } from '../core/random.js';
import { evolutionSettings, canReproduce } from '../evolution/reproduction.js';
import { EvolutionMetrics } from '../evolution/EvolutionMetrics.js';
import { Predator } from '../entities/Predator.js';
import { predationSettings } from '../predation/settings.js';
import { captureCandidate } from '../predation/capture.js';

const DEFAULTS = Object.freeze({
  width: 1100, height: 650, creatureCount: 36, foodCount: 90, poisonCount: 28,
  maxFood: 140, maxPoison: 45, foodPerSecond: 3, poisonPerSecond: 0.3,
  energyDrain: 0.035, foodEnergy: 0.25, poisonEnergy: -0.65,
});

export class Simulation {
  constructor({ rng, seed = 2026, evolution = {}, predation = {}, hooks = {}, ...settings } = {}) {
    if (Object.entries(hooks).some(([key, value]) => !['isCaptureProtected', 'foodRateBonus'].includes(key) || typeof value !== 'function')) {
      throw new TypeError('Extension de simulation invalide.');
    }
    this.hooks = Object.freeze({ ...hooks });
    this.settings = Object.freeze({ ...DEFAULTS, ...settings });
    const config = this.settings;
    if (!Object.values(config).every(Number.isFinite)
      || config.width < 200 || config.height < 200
      || ['creatureCount', 'foodCount', 'poisonCount', 'maxFood', 'maxPoison']
        .some(key => !Number.isInteger(config[key]) || config[key] < 0)
      || config.foodCount > config.maxFood || config.poisonCount > config.maxPoison
      || ['foodPerSecond', 'poisonPerSecond', 'energyDrain'].some(key => config[key] < 0)
      || config.foodEnergy < 0 || config.poisonEnergy > 0) {
      throw new RangeError('Configuration de simulation invalide.');
    }
    seededRandom(seed); // validation, même si un générateur de test est injecté
    if (rng !== undefined && typeof rng !== 'function') throw new TypeError('Générateur aléatoire invalide.');
    this.externalRng = rng;
    this.seed = seed;
    this.evolution = evolutionSettings(evolution);
    this.predation = predationSettings(predation);
    this.runNumber = 0;
    this.width = config.width;
    this.height = config.height;
    this.fixedStep = 1 / 60;
    this.reset();
  }

  randomPosition() {
    return [55 + this.rng() * (this.width - 110), 55 + this.rng() * (this.height - 110)];
  }

  reset() {
    // Deux flux : les tirages génétiques n'avancent pas le flux de l'environnement.
    this.rng = this.externalRng ?? seededRandom(this.seed);
    this.geneticRng = this.externalRng ?? seededRandom((this.seed ^ 0x9e3779b9) >>> 0);
    this.predatorRng = seededRandom((this.seed ^ 0x85ebca6b) >>> 0);
    this.runNumber++;
    this.nextCreatureId = 1;
    this.nextPredatorId = 1;
    this.predators = [];
    this.creatures = [];
    this.food = [];
    this.poison = [];
    this.time = 0;
    this.accumulator = 0;
    this.paused = false;
    this.deaths = 0;
    this.births = 0;
    this.captures = 0;
    this.attacks = 0;
    this.predationDeaths = 0;
    this.predatorsStarved = 0;
    this.maxGeneration = 0;
    this.tickCount = 0;
    this.selectedId = null;
    this.metrics = new EvolutionMetrics();
    this.interventions = 0;
    this.foodBudget = 0;
    this.poisonBudget = 0;
    for (let i = 0; i < Math.min(this.settings.creatureCount, this.evolution.maxPopulation); i++) {
      const [x, y] = this.randomPosition();
      this.creatures.push(new Creature(x, y, DNA.random(this.rng), this.rng, { id: this.allocateId() }));
    }
    this.maxGeneration = this.creatures.length ? 1 : 0;
    for (let i = 0; i < this.settings.foodCount; i++) this.addResource('food');
    for (let i = 0; i < this.settings.poisonCount; i++) this.addResource('poison');
    this.syncPredators();
    this.initialMeanGenes = this.stats.meanGenes;
    this.metrics.sample(this.stats, this.evolution, this.predation, this.settings, 'initial');
  }

  allocateId() { return `r${this.runNumber}-c${this.nextCreatureId++}`; }

  setSeed(seed) {
    seededRandom(seed);
    if (this.externalRng) throw new Error('Une graine ne remplace pas un générateur externe injecté.');
    this.seed = seed;
    this.reset();
  }

  configureEvolution(changes) {
    const next = evolutionSettings(changes, this.evolution);
    this.evolution = next;
    this.interventions++;
    // Diminuer le plafond bloque les naissances ; ne tue aucun individu.
    this.metrics.sample(this.stats, this.evolution, this.predation, this.settings, 'configuration');
  }

  syncPredators() {
    while (this.predators.length > this.predation.count) this.predators.pop();
    while (this.predators.length < this.predation.count) {
      // Flux indépendant : ajouter un prédateur ne change ni les gènes ni les
      // prochaines positions de ressources tirées dans le flux d'environnement.
      const x = 55 + this.predatorRng() * (this.width - 110);
      const y = 55 + this.predatorRng() * (this.height - 110);
      this.predators.push(new Predator(x, y, this.predation, this.predatorRng,
        `r${this.runNumber}-p${this.nextPredatorId++}`));
    }
  }

  configurePredation(changes) {
    const previous = this.predation;
    this.predation = predationSettings(changes, previous);
    if (Object.hasOwn(changes, 'count') || (!previous.enabled && this.predation.enabled)) this.syncPredators();
    for (const predator of this.predators) {
      predator.applySettings(this.predation);
      if (!this.predation.enabled) {
        predator.acc.mult(0);
        predator.clearTarget();
        predator.state = 'inactive';
      } else if (!previous.enabled || predator.state === 'inactive') predator.state = 'wander';
    }
    if (!this.predation.enabled) for (const creature of this.creatures) creature.clearThreat();
    this.interventions++;
    this.metrics.sample(this.stats, this.evolution, this.predation, this.settings, 'configuration');
  }

  addPredator() {
    if (this.predators.length >= 8) return false;
    this.configurePredation({ count: this.predators.length + 1 });
    return true;
  }

  removePredator() {
    if (!this.predators.length) return false;
    this.configurePredation({ count: this.predators.length - 1 });
    return true;
  }

  tryCapture(predator) {
    if (!this.predators.includes(predator)) return null;
    const victim = captureCandidate(predator, this);
    if (!victim) return null;
    // Suppression immédiate et atomique dans cette boucle séquentielle : un
    // second prédateur ne retrouve plus cette proie et ne peut pas la recompter.
    const index = this.creatures.indexOf(victim);
    victim.energy = 0;
    victim.deathCause = 'predator';
    this.metrics.recordDeath(victim);
    this.creatures.splice(index, 1);
    this.deaths++;
    this.captures++;
    this.predationDeaths++;
    predator.onCapture(victim.pos, this.predation);
    return victim;
  }

  selectAt(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    let selected = null, distance = 14 ** 2;
    for (const creature of this.creatures) {
      const squared = (creature.pos.x - x) ** 2 + (creature.pos.y - y) ** 2;
      if (squared <= distance) { selected = creature; distance = squared; }
    }
    this.selectedId = selected?.id ?? null;
    return selected;
  }

  get selectedCreature() { return this.creatures.find(creature => creature.id === this.selectedId) ?? null; }

  tryReproduce(parent) {
    const config = this.evolution;
    if (this.paused || this.creatures.length >= config.maxPopulation
      || !this.creatures.includes(parent) || !canReproduce(parent, config)
      || this.geneticRng() >= config.birthProbability) return null;

    const childDNA = parent.dna.mutated({ probability: config.mutationRate, amplitude: config.mutationAmplitude }, this.geneticRng);
    const child = new Creature(parent.pos.x, parent.pos.y, childDNA, this.geneticRng, {
      id: this.allocateId(), parentId: parent.id, generation: parent.generation + 1,
    });
    child.vel.set(0, -2); // vitesse initiale du TP ; aucune vitesse héritée
    if (config.mode === 'arena') {
      // Transfert d'énergie : parent + enfant ne gagnent rien lors de la naissance.
      parent.energy -= config.energyCost;
      child.energy = config.energyCost;
    } // en mode TP, enfant à 1 et parent inchangé
    parent.lastReproductionAge = parent.age;
    parent.offspringCount++;
    this.births++;
    this.maxGeneration = Math.max(this.maxGeneration, child.generation);
    this.metrics.mutatedGenes += child.dna.genes.filter((gene, index) => gene !== parent.dna.genes[index]).length;
    this.creatures.push(child);
    return child;
  }

  addResource(kind, x, y) {
    if (kind !== 'food' && kind !== 'poison') throw new TypeError('Ressource inconnue.');
    const cap = kind === 'food' ? this.settings.maxFood : this.settings.maxPoison;
    if (this[kind].length >= cap) return false;
    if (x === undefined && y === undefined) [x, y] = this.randomPosition();
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > this.width || y > this.height) {
      return false;
    }
    this[kind].push(kind === 'food' ? new Food(x, y) : new Poison(x, y));
    return true;
  }

  togglePause() {
    this.paused = !this.paused;
    this.accumulator = 0;
  }

  advance(elapsedSeconds) {
    if (this.paused || !Number.isFinite(elapsedSeconds) || elapsedSeconds <= 0) return;
    // Au retour d'un onglet inactif : pas de rattrapage illimité ni de spirale CPU.
    this.accumulator += Math.min(elapsedSeconds, 0.25);
    while (this.accumulator + 1e-12 >= this.fixedStep) {
      this.step();
      this.accumulator = Math.max(0, this.accumulator - this.fixedStep);
    }
  }

  step() {
    if (this.paused) return;
    const dt = this.fixedStep;
    this.time += dt;
    this.tickCount++;
    this.metrics.creatureSeconds += this.creatures.length * dt;
    if (this.creatures.length >= this.evolution.maxPopulation) this.metrics.capSeconds += dt;
    if (this.predation.enabled) for (const predator of this.predators) predator.plan(this);
    for (let i = this.creatures.length - 1; i >= 0; i--) {
      const creature = this.creatures[i];
      if (!creature.dead()) {
        this.metrics.foodConsumed += consumeResources(creature, this.food, this.settings.foodEnergy);
        this.metrics.poisonConsumed += consumeResources(creature, this.poison, this.settings.poisonEnergy);
        if (!creature.dead()) {
          creature.steer(this);
          creature.tick(dt, this.settings.energyDrain);
        }
      }
      if (creature.dead()) {
        this.metrics.recordDeath(creature);
        this.creatures.splice(i, 1);
        this.deaths++;
      }
    }
    if (this.predation.enabled) {
      for (let i = this.predators.length - 1; i >= 0; i--) {
        const predator = this.predators[i];
        if (!predator.dead()) predator.tick(dt, this.predation.energyDrain);
        if (predator.dead()) {
          this.predators.splice(i, 1);
          this.predatorsStarved++;
        }
      }
      for (const predator of this.predators) this.tryCapture(predator);
    }
    // Photographie des survivants : aucun nouveau-né ne se reproduit dans ce pas.
    if (this.evolution.mode !== 'off') {
      for (const parent of [...this.creatures].reverse()) this.tryReproduce(parent);
    }
    // Flux régulier, plafonné. Les remplacements arrivent après la consommation,
    // ce qui évite qu'une même créature mange une chaîne de remplacements.
    const foodBonus = this.hooks.foodRateBonus?.(this.time) ?? 0;
    if (!Number.isFinite(foodBonus) || foodBonus < 0 || foodBonus > 30) throw new RangeError('Bonus alimentaire invalide.');
    // Conserve la fraction excédentaire pour les taux non entiers et les bonus
    // temporaires. Au plus un élément par type et par pas, sans arriéré illimité.
    this.foodBudget = Math.min(2, this.foodBudget + (this.settings.foodPerSecond + foodBonus) * dt);
    this.poisonBudget = Math.min(2, this.poisonBudget + this.settings.poisonPerSecond * dt);
    if (this.foodBudget >= 1 - 1e-12) {
      this.addResource('food');
      this.foodBudget = Math.max(0, this.foodBudget - 1);
    }
    if (this.poisonBudget >= 1 - 1e-12) {
      this.addResource('poison');
      this.poisonBudget = Math.max(0, this.poisonBudget - 1);
    }
    if (this.tickCount % 60 === 0) this.metrics.sample(this.stats, this.evolution, this.predation, this.settings);
  }

  get stats() {
    return {
      population: this.creatures.length, food: this.food.length, poison: this.poison.length,
      time: this.time, paused: this.paused, deaths: this.deaths, births: this.births,
      maxGeneration: this.maxGeneration, seed: this.seed, mode: this.evolution.mode,
      interventions: this.interventions,
      predationEnabled: this.predation.enabled,
      activePredators: this.predation.enabled ? this.predators.filter(predator => !predator.dead()).length : 0,
      captures: this.captures, attacks: this.attacks, predationDeaths: this.predationDeaths,
      predatorsStarved: this.predatorsStarved,
      ...this.metrics.summarize(this.creatures),
    };
  }
}
