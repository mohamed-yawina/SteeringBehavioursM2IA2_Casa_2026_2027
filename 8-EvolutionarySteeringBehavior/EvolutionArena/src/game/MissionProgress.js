import { getMission, MISSIONS } from './MissionDefinitions.js';

export class MissionProgress {
  constructor() { this.bestStars = new Map(); this.onChange = () => {}; }

  isUnlocked(id) {
    getMission(id);
    return id === MISSIONS[0].id || this.bestStars.has(id - 1);
  }

  record(result) {
    getMission(result.missionId);
    if (result.status !== 'won') return;
    if (!Number.isInteger(result.stars) || result.stars < 1 || result.stars > 3) throw new RangeError('Étoiles invalides.');
    this.bestStars.set(result.missionId, Math.max(this.bestStars.get(result.missionId) ?? 0, result.stars));
    this.onChange();
  }

  reset() { this.bestStars.clear(); this.onChange(); }

  nextId(id) { return MISSIONS.find(mission => mission.id > id)?.id ?? null; }
}
