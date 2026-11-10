export function wander(actor, rng, jitter = 0.08) {
  // L'angle persiste et dérive doucement ; pas de nouvelle direction brutale.
  actor.wanderAngle += (rng() * 2 - 1) * jitter;
  const forward = actor.vel.copy();
  if (forward.magSq() === 0) forward.set(1, 0);
  const heading = forward.heading() + actor.wanderAngle;
  const target = actor.pos.copy().add(forward.setMag(35))
    .add(createVector(Math.cos(heading) * 22, Math.sin(heading) * 22));
  return actor.seek(target);
}
