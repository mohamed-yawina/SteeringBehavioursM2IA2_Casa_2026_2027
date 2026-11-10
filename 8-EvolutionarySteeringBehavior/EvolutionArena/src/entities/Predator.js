import { Vehicle } from '../core/courseVehicle.js';
import { boundaryForce } from '../behaviors/steering.js';
import { pursue } from '../behaviors/prediction.js';
import { wander } from '../behaviors/wander.js';
import { selectPrey } from '../predation/targeting.js';

export class Predator extends Vehicle {
  constructor(x, y, settings, rng, id) {
    super(x, y);
    this.id = id;
    this.maxEnergy = 1.5;
    this.age = 0;
    this.cooldown = 0;
    this.captureFlash = 0;
    this.capturePosition = null;
    this.wanderAngle = rng() * Math.PI * 2;
    this.state = settings.enabled ? 'wander' : 'inactive';
    this.targetId = null;
    this.prediction = null;
    this.pursueForce = createVector(0, 0);
    this.applySettings(settings);
    this.vel.set(Math.cos(this.wanderAngle), Math.sin(this.wanderAngle)).limit(this.maxSpeed);
  }

  get energy() { return this.health; }
  set energy(value) { this.health = value; }

  applySettings(settings) {
    this.maxSpeed = settings.speed;
    this.maxForce = settings.maxForce;
    this.perceptionRadius = settings.perceptionRadius;
    this.captureRadius = settings.captureRadius;
  }

  clearTarget() {
    this.targetId = null;
    this.prediction = null;
    this.pursueForce.set(0, 0);
  }

  plan(world) {
    const settings = world.predation;
    const previousTarget = this.targetId;
    if (this.dead()) { this.state = 'dead'; this.clearTarget(); return; }
    const resting = this.cooldown > 1e-9 || this.age < settings.spawnGrace
      || world.creatures.length <= settings.minimumPrey;
    const target = resting ? null : selectPrey(this, world.creatures, settings);
    this.clearTarget();
    let force;
    if (target) {
      this.state = 'pursue';
      this.targetId = target.id;
      const result = pursue(this, target, settings.maxPredictionSeconds);
      this.prediction = result.prediction;
      this.pursueForce = result.force.copy();
      force = result.force;
      if (previousTarget !== target.id) world.attacks++;
    } else {
      this.state = resting ? 'rest' : 'wander';
      force = wander(this, world.predatorRng);
      if (resting) force.mult(0.4);
    }
    const edges = boundaryForce(this, world.width, world.height);
    this.applyForce((edges.magSq() > 0 ? edges : force).limit(this.maxForce));
  }

  tick(dt, energyDrain) {
    this.energy += 0.005; // neutralise seulement le drain de la base fournie
    super.update(); // locomotion du cours, jamais recopiée
    this.energy = Math.max(0, this.energy - energyDrain * dt);
    this.age += dt;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.captureFlash = Math.max(0, this.captureFlash - dt);
    if (this.dead()) { this.state = 'dead'; this.clearTarget(); }
  }

  onCapture(position, settings) {
    this.energy = Math.min(this.maxEnergy, this.energy + settings.captureEnergy);
    this.cooldown = settings.captureCooldown;
    this.captureFlash = 0.6;
    this.capturePosition = position.copy();
    this.state = 'rest';
    this.clearTarget();
  }
}
