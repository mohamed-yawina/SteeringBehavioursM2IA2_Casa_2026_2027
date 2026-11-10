import { Simulation } from '../simulation/Simulation.js';
import { evaluateFitness, sectorFraction } from './Fitness.js';
import { Genome } from './Genome.js';

export class Population {
  constructor(genomes, track, generation, config) {
    if (!Array.isArray(genomes) || !genomes.length || Array.from(genomes).some(g => !(g instanceof Genome))) throw new RangeError('Nonempty genome population required');
    this.generation = generation; this.config = config; this.integrationSteps=0;
    this.individuals = genomes.map((genome, index) => {
      const simulation = new Simulation(track); simulation.setNetwork(genome.toNetwork()); simulation.setMode('autonomous');
      return { id: `${generation}:${index}`, generation, genome: genome.copy(), simulation,
        active: true, fitness: 0, progression: 0, checkpoints: 0, fraction: 0,
        lastProgressAt: 0, stagnationMark: 0, firstLapTime:null, termination: null, result: null };
    });
  }
  get activeCount() { return this.individuals.filter(i => i.active).length; }
  record(individual, reason = null) {
    const sim = individual.simulation;
    return Object.freeze({ id: individual.id, generation: individual.generation, checkpoints: sim.checkpoints.validated,
      laps: sim.checkpoints.laps, fraction: individual.fraction, progression: individual.progression,
      elapsed: sim.elapsed, firstLapTime:individual.firstLapTime, crashed: sim.car.crashed, reason, distance: sim.car.distanceTravelled });
  }
  finish(individual, reason) {
    if (!individual.active) return;
    individual.active = false; individual.termination = reason;
    // Keep crash state distinct from evaluation timeout/stagnation; no fake collision.
    individual.simulation.car.active = false;
    individual.result = this.record(individual, reason);
    individual.fitness = evaluateFitness(individual.result, this.config.fitness, this.config.maxDuration);
  }
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > .1) throw new RangeError('Invalid population dt');
    for (const individual of this.individuals) {
      if (!individual.active) continue;
      const sim = individual.simulation;
      const remaining = this.config.maxDuration - sim.elapsed;
      if (remaining <= 1e-9) { this.finish(individual, 'timeout'); continue; }
      sim.step(Math.min(dt, remaining));
      this.integrationSteps++;
      if (sim.checkpoints.laps>0 && individual.firstLapTime===null) individual.firstLapTime=sim.elapsed;
      individual.checkpoints = sim.checkpoints.validated;
      const fraction = sectorFraction(sim), progress = individual.checkpoints + fraction;
      if (progress > individual.stagnationMark + .01) {
        individual.lastProgressAt = sim.elapsed; individual.stagnationMark = progress;
      }
      // High-water mark: oscillation never accumulates progress or refreshes stagnation.
      if (progress > individual.progression) {
        individual.progression = progress; individual.fraction = fraction;
      }
      // On new gates the high-water mark advances even if fraction is zero.
      const reason = sim.car.crashed ? 'collision'
        : sim.elapsed >= this.config.maxDuration - 1e-9 ? 'timeout'
        : sim.elapsed - individual.lastProgressAt >= this.config.stagnationTime - 1e-9 ? 'stagnation' : null;
      individual.fitness = evaluateFitness(this.record(individual), this.config.fitness, this.config.maxDuration);
      if (reason) this.finish(individual, reason);
    }
  }
}
