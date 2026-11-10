import { fileURLToPath } from 'node:url';
import path from 'node:path';
// Évaluation Node sans navigateur : même doublure vectorielle que les tests.
import '../tests/helpers/runtime.js';
import { MissionManager } from '../src/game/MissionManager.js';

export const BALANCE_SEEDS = Object.freeze([1, 7, 42, 2026, 9001]);

export function runMissionTrial(id, seed, policy = 'food') {
  if (!['food', 'idle', 'efficient'].includes(policy)) throw new RangeError('Politique inconnue.');
  const manager = new MissionManager();
  // Les scénarios sont évalués indépendamment ; ce déblocage de test ne touche
  // aucune créature, aucun ADN et n'existe pas dans les contrôles du jeu.
  for (let previous = 1; previous < id; previous++) manager.progress.record({ missionId: previous, status: 'won', stars: 1 });
  manager.start(id, seed);
  const limit = manager.mission.deadline * 60 + 2;
  let steps = 0;
  while (manager.status === 'running' && steps++ < limit) {
    if (policy === 'efficient') {
      if (id > 1 && manager.world.time < 50 && manager.points.spent + 35 <= manager.mission.starSpending
        && manager.actions.availability('abundance') === null) manager.act('abundance');
      if (manager.world.time > 15 && manager.points.spent + 12 <= manager.mission.starSpending
        && manager.actions.availability('food') === null) {
        const hungry = manager.world.creatures.filter(c => c.dna.foodWeight > 0).sort((a, b) => a.energy - b.energy)[0];
        if (hungry) manager.act('food', hungry.pos.x, hungry.pos.y);
      }
    }
    if (policy === 'food' && manager.world.time > 6 && manager.actions.availability('food') === null) {
      const candidate = manager.world.creatures.filter(c => c.dna.foodWeight > 0)
        .sort((a, b) => b.generation - a.generation || a.energy - b.energy)[0];
      if (candidate) manager.act('food', candidate.pos.x, candidate.pos.y);
    }
    manager.step();
    if (steps % 60 === 0) {
      const finite = [...manager.world.creatures, ...manager.world.predators].every(entity =>
        [entity.pos.x, entity.pos.y, entity.vel.x, entity.vel.y, entity.energy, entity.age].every(Number.isFinite));
      if (!finite) throw new Error(`État non fini, mission ${id}, graine ${seed}.`);
    }
  }
  if (manager.status === 'running') throw new Error('La mission ne se termine pas à sa limite.');
  return { mission: id, seed, policy, status: manager.status, time: Number(manager.world.time.toFixed(2)),
    population: manager.world.creatures.length, generation: manager.world.maxGeneration,
    stars: manager.result.stars, spent: manager.points.spent, captures: manager.world.captures };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  for (let id = 1; id <= 5; id++) {
    for (const policy of ['idle', 'food', 'efficient']) {
      const trials = BALANCE_SEEDS.map(seed => runMissionTrial(id, seed, policy));
      console.log(JSON.stringify({ mission: id, policy, wins: trials.filter(t => t.status === 'won').length, trials }));
    }
  }
}
