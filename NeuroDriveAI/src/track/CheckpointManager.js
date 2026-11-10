import { checkpointCrossing, EPS } from '../math/geometry.js';

export class CheckpointManager {
  constructor(checkpoints) {
    if (!Array.isArray(checkpoints) || checkpoints.length < 2) throw new RangeError('At least two gates required');
    this.checkpoints = checkpoints;
    this.reset();
  }
  reset() {
    // Contract: spawn after finish (index 0); first required gate is 1.
    this.nextIndex = 1;
    this.laps = 0;
    this.validated = 0;
    this.lastEvent = 'Départ — suivre les flèches';
  }
  process(from, to) {
    const events = this.checkpoints.map((cp, index) => ({ index, t: checkpointCrossing(from, to, cp) }))
      .filter(event => event.t !== null).sort((a, b) => a.t - b.t);
    const accepted = [];
    let lastTime = -Infinity;
    for (const event of events) {
      if (event.index !== this.nextIndex || event.t <= lastTime + EPS) {
        this.lastEvent = 'Checkpoint hors ordre : non validé';
        // Do not credit later gates in a segment that already skipped one.
        break;
      }
      lastTime = event.t;
      accepted.push(event.index);
      this.validated++;
      if (event.index === 0) {
        this.laps++;
        this.lastEvent = `Tour ${this.laps} terminé`;
      } else this.lastEvent = `Checkpoint ${event.index} validé`;
      this.nextIndex = (this.nextIndex + 1) % this.checkpoints.length;
    }
    return accepted;
  }
}
