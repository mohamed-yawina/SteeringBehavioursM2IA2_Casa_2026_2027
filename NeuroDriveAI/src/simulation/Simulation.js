import { Car } from '../entities/Car.js';
import { createOvalTrack } from '../track/Track.js';
import { CheckpointManager } from '../track/CheckpointManager.js';
import { firstCollision } from '../math/geometry.js';
import { NeuralController } from '../ai/NeuralController.js';

export class Simulation {
  constructor(track = createOvalTrack()) {
    this.track = track;
    this.mode = 'manual';
    this.neuralController = new NeuralController();
    this.reset();
  }
  setMode(mode) {
    if (!['manual', 'autonomous'].includes(mode)) throw new RangeError('Unknown driving mode');
    this.mode = mode;
    this.neuralController.diagnostics = null;
  }
  setNetwork(network) { this.neuralController.setNetwork(network); }
  reset() {
    this.car = new Car(this.track.start);
    this.checkpoints = new CheckpointManager(this.track.checkpoints);
    this.elapsed = 0;
    this.paused = false;
    this.neuralController.diagnostics = null;
    this.car.sensors.scan(this.car.position, this.car.orientation, this.track.walls);
  }
  step(dt, input = {}) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > 0.1) throw new RangeError('Invalid simulation dt');
    if (this.paused) return;
    if (!this.car.active) {
      if (this.mode === 'autonomous') this.neuralController.decide(this.car);
      return;
    }
    // Sensors already represent this exact state (reset or previous accepted step).
    const command = this.mode === 'autonomous' ? this.neuralController.decide(this.car) : input;
    this.car.control(command, dt);
    this.car.update(dt, (from, to) => firstCollision(from, to, this.car.collisionRadius, this.track.walls));
    // Only accepted motion BEFORE first contact is eligible for gate validation.
    this.checkpoints.process(this.car.previousPosition, this.car.position);
    this.elapsed += dt;
    this.car.sensors.scan(this.car.position, this.car.orientation, this.track.walls);
  }
}
