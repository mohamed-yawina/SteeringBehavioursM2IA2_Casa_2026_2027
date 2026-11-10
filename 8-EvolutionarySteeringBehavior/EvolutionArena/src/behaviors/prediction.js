import { flee } from './steering.js';

export function predictPosition(actor, target, maxSeconds = 0.75) {
  // Les vitesses du cours sont en pixels/pas (60 pas/s), pas en pixels/s.
  const speedPerSecond = actor.maxSpeed * 60;
  const seconds = speedPerSecond > 0 ? Math.min(maxSeconds, actor.pos.dist(target.pos) / speedPerSecond) : 0;
  const position = target.pos.copy().add(target.vel.copy().mult(seconds * 60));
  return { position, seconds };
}

export function pursue(actor, target, maxSeconds = 0.75) {
  const prediction = predictPosition(actor, target, maxSeconds);
  return { force: actor.seek(prediction.position), prediction };
}

export function evade(actor, threat, maxSeconds = 0.75) {
  const prediction = predictPosition(actor, threat, maxSeconds);
  // Flee construit la vitesse désirée opposée AVANT de soustraire la vitesse.
  // On n'inverse jamais la force de Pursue.
  return { force: flee(actor, prediction.position), prediction };
}
