import { MissionManager } from './MissionManager.js';

export class GameMode {
  constructor(laboratory) {
    this.laboratory = laboratory;
    this.mode = 'laboratory';
    this.missions = new MissionManager();
  }

  switchTo(mode) {
    if (!['laboratory', 'survival'].includes(mode)) throw new RangeError('Mode inconnu.');
    this.mode = mode;
    if (this.missions.actions) this.missions.actions.enabled = mode === 'survival' && this.missions.status === 'running';
  }

  get activeWorld() { return this.mode === 'survival' ? this.missions.world : this.laboratory; }

  advance(seconds) {
    if (this.mode === 'laboratory') this.laboratory.advance(seconds);
    else this.missions.advance(seconds);
  }
}
