import { positive, finite } from '../math/vector.js';

export class FixedStepClock {
  constructor(step = 1 / 120, maxSteps = 12) {
    this.step = positive(step, 'step');
    if (step > 0.1 || !Number.isInteger(maxSteps) || maxSteps < 1) throw new RangeError('Invalid clock configuration');
    this.maxSteps = maxSteps;
    this.reset();
  }
  reset() { this.accumulator = 0; }
  advance(seconds, callback) {
    finite(seconds, 'elapsed time');
    if (seconds < 0) throw new RangeError('Elapsed time must be nonnegative');
    this.accumulator += Math.min(seconds, this.step * this.maxSteps);
    let steps = 0;
    while (this.accumulator + 1e-12 >= this.step && steps < this.maxSteps) {
      callback(this.step);
      this.accumulator = Math.max(0, this.accumulator - this.step);
      steps++;
    }
    return steps;
  }
}
