import { Simulation } from '../simulation/Simulation.js';
import { getMission, validateMission } from './MissionDefinitions.js';
import { MissionProgress } from './MissionProgress.js';
import { EcosystemPoints } from './EcosystemPoints.js';
import { PlayerActions } from './PlayerActions.js';
import { missionState, gameResult } from './GameResults.js';

export class MissionManager {
  constructor({ progress = new MissionProgress() } = {}) {
    this.progress = progress;
    this.status = 'selection';
    this.world = null;
    this.mission = null;
    this.result = null;
    this.armedAction = null;
    this.message = '';
    this.accumulator = 0;
  }

  start(id, seed = 2026) {
    const mission = getMission(id);
    if (!this.progress.isUnlocked(id)) throw new Error('Terminez la mission précédente pour débloquer celle-ci.');
    // Construction avant remplacement : une graine/configuration invalide ne détruit pas la session.
    let actions;
    const world = new Simulation({ ...mission.simulation, seed, evolution: { mode: 'arena' },
      predation: mission.predation,
      hooks: { isCaptureProtected: (position, time) => actions?.isProtected(position, time) ?? false,
        foodRateBonus: time => actions?.foodRateBonus(time) ?? 0 } });
    validateMission(mission, world);
    this.points = new EcosystemPoints();
    actions = new PlayerActions(world, this.points);
    this.actions = actions;
    this.world = world;
    this.mission = mission;
    this.status = 'running';
    this.result = null;
    this.accumulator = 0;
    this.armedAction = null;
    this.message = 'Sélectionnez une action puis cliquez dans l’arène. Les créatures restent autonomes.';
  }

  showSelection() {
    if (this.actions) this.actions.enabled = false;
    this.status = 'selection';
    this.armedAction = null;
    this.accumulator = 0;
  }

  replay() { if (this.mission) this.start(this.mission.id, this.world.seed); }

  next() {
    const id = this.mission && this.progress.nextId(this.mission.id);
    if (this.status !== 'won' || id === null) return false;
    this.start(id, this.world.seed);
    return true;
  }

  togglePause() {
    if (this.status !== 'running') return;
    this.world.togglePause();
    this.accumulator = 0;
  }

  step() {
    if (this.status !== 'running' || this.world.paused) return;
    this.world.step();
    this.points.tick(this.world.fixedStep);
    this.actions.update();
    const outcome = missionState(this.mission, this.world.stats);
    if (outcome.status !== 'running') {
      this.status = outcome.status;
      this.result = gameResult(this.mission, this.world.stats, this.points, this.actions, outcome);
      this.progress.record(this.result);
      this.world.paused = true;
      this.actions.enabled = false;
      this.armedAction = null;
      this.accumulator = 0;
    }
  }

  advance(seconds) {
    if (this.status !== 'running' || this.world.paused || !Number.isFinite(seconds) || seconds <= 0) return;
    this.accumulator += Math.min(seconds, 0.25);
    while (this.accumulator + 1e-12 >= this.world.fixedStep && this.status === 'running') {
      this.accumulator = Math.max(0, this.accumulator - this.world.fixedStep);
      this.step();
    }
  }

  arm(kind) {
    if (this.status !== 'running') return false;
    const blocked = this.actions.availability(kind);
    if (blocked) { this.message = blocked; return false; }
    if (kind === 'abundance') return this.act(kind);
    this.armedAction = kind;
    this.message = `${this.actions.definitions[kind].label} : cliquez dans l’arène pour choisir la zone.`;
    return true;
  }

  act(kind, x, y) {
    if (this.status !== 'running') return false;
    const result = this.actions.perform(kind, x, y);
    this.message = result.reason;
    if (result.ok) this.armedAction = null;
    return result.ok;
  }

  click(x, y) {
    if (!this.world || this.status === 'selection') return;
    if (this.armedAction && !this.world.paused) this.act(this.armedAction, x, y);
    else this.world.selectAt(x, y); // aucun ajout gratuit de nourriture/poison
  }
}
