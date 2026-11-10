import { eligiblePrey } from './targeting.js';

export function captureCandidate(predator, world) {
  const settings = world.predation;
  if (!settings.enabled || world.paused || predator.dead() || predator.state !== 'pursue'
    || predator.cooldown > 1e-9 || predator.age < settings.spawnGrace
    || world.creatures.length <= settings.minimumPrey) return null;
  const target = world.creatures.find(creature => creature.id === predator.targetId);
  if (!target || !eligiblePrey(target, settings)) return null;
  if (world.hooks?.isCaptureProtected?.(target.pos, world.time)) return null;
  const squared = (predator.pos.x - target.pos.x) ** 2 + (predator.pos.y - target.pos.y) ** 2;
  return squared < predator.captureRadius ** 2 ? target : null;
}
