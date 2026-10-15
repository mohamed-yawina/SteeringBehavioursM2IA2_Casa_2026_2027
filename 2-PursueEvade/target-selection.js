/** Return the nearest agent, or null when the candidate set is empty. */
function closestTargetTo(agent, targets) {
  let nearest = null;
  let nearestDistanceSquared = Infinity;

  for (const target of targets) {
    const dx = target.pos.x - agent.pos.x;
    const dy = target.pos.y - agent.pos.y;
    const distanceSquared = dx * dx + dy * dy;
    if (distanceSquared < nearestDistanceSquared) {
      nearest = target;
      nearestDistanceSquared = distanceSquared;
    }
  }

  return nearest;
}

/** Return the closest pursuer only when it overlaps the target's hit radius. */
function capturingHunterFor(target, pursuers) {
  const nearest = closestTargetTo(target, pursuers);
  if (!nearest) return null;
  const radius = (target.r || 0) + (nearest.r || 0);
  const dx = target.pos.x - nearest.pos.x;
  const dy = target.pos.y - nearest.pos.y;
  return dx * dx + dy * dy < radius * radius ? nearest : null;
}
