import { Vehicle } from '../core/courseVehicle.js';
import { DNA } from '../core/DNA.js';
import { nearestResource } from '../behaviors/perception.js';
import { combinedForce } from '../behaviors/steering.js';
import { evade } from '../behaviors/prediction.js';
import { nearestThreat } from '../predation/targeting.js';

export class Creature extends Vehicle {
  static nextStandaloneId = 1;

  constructor(x, y, dna, rng = Math.random, lineage = {}) {
    // Pas d'ADN parental : le constructeur de base ne passe pas par les mutations.
    super(x, y);
    this.dna = (dna ?? DNA.random(rng)).copy();
    this.id = lineage.id ?? `isolated-${Creature.nextStandaloneId++}`;
    this.parentId = lineage.parentId ?? null;
    this.generation = lineage.generation ?? 1;
    this.age = 0;
    this.offspringCount = 0;
    this.lastReproductionAge = null;
    this.birthFlash = this.parentId === null ? 0 : 0.8;
    this.maxSpeed = 2.8; // pixels par pas fixe de 1/60 s
    this.maxForce = 0.16;
    this.maxEnergy = 1.5;
    this.eatRadius = 8;
    this.clearThreat();
    const heading = rng() * Math.PI * 2;
    this.vel.set(Math.cos(heading) * 1.4, Math.sin(heading) * 1.4);
  }

  get energy() { return this.health; }
  set energy(value) { this.health = value; }

  clearThreat() {
    this.threatId = null;
    this.evadePrediction = null;
    this.evadeForce = createVector(0, 0);
    this.survivalForce = null;
  }

  steer(world) {
    const foodTarget = nearestResource(this.pos, world.food, this.dna.foodPerception);
    const poisonTarget = nearestResource(this.pos, world.poison, this.dna.poisonPerception);
    let force;
    if (world.predation?.enabled) {
      const settings = world.predation;
      const threat = nearestThreat(this, world.predators, settings.preyPerception);
      this.threatId = threat?.id ?? null;
      this.evadePrediction = null;
      this.evadeForce.set(0, 0);
      let influence = 0;
      if (threat) {
        const result = evade(this, threat, settings.maxPredictionSeconds);
        this.evadePrediction = result.prediction;
        this.evadeForce = result.force;
        const proximity = 1 - this.pos.dist(threat.pos) / settings.preyPerception;
        influence = proximity * proximity * (3 - 2 * proximity); // smoothstep
      }
      const alpha = 1 - Math.exp(-world.fixedStep / settings.smoothingSeconds);
      this.survivalForce ??= createVector(0, 0);
      // Seule la contribution de survie est filtrée : hors menace, la recherche
      // de nourriture conserve exactement la dynamique de l'étape précédente.
      this.survivalForce.mult(1 - alpha)
        .add(this.evadeForce.copy().mult(influence * settings.evadeWeight * alpha));
      force = combinedForce(this, foodTarget, poisonTarget, world.width, world.height, {
        foodWeight: settings.foodWeight, poisonWeight: settings.poisonWeight,
        evadeForce: this.survivalForce,
      });
    } else {
      this.clearThreat();
      force = combinedForce(this, foodTarget, poisonTarget, world.width, world.height, {
        foodWeight: world.predation?.foodWeight ?? 1, poisonWeight: world.predation?.poisonWeight ?? 1,
      });
    }
    this.applyForce(force);
  }

  tick(stepSeconds, energyDrain) {
    // Vehicle.update() conserve l'intégration d'origine. Sa perte de santé de
    // 0.005 est compensée pour appliquer un coût explicite par seconde.
    this.energy += 0.005;
    super.update();
    this.energy = Math.max(0, this.energy - energyDrain * stepSeconds);
    this.age += stepSeconds;
    this.birthFlash = Math.max(0, this.birthFlash - stepSeconds);
  }
}
