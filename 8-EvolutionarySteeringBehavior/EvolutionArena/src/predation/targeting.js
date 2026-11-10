export function eligiblePrey(creature, settings) {
  return !creature.dead() && (creature.parentId === null || creature.age >= settings.newbornProtection);
}

export function selectPrey(predator, creatures, settings) {
  const retained = creatures.find(creature => creature.id === predator.targetId);
  // Hystérésis de perception : on n'abandonne pas une cible pour un voisin
  // légèrement plus proche, ni au premier franchissement du cercle de détection.
  if (retained && eligiblePrey(retained, settings)
    && predator.pos.dist(retained.pos) < predator.perceptionRadius * 1.15) return retained;
  let closest = null, distance = predator.perceptionRadius ** 2;
  for (const creature of creatures) {
    if (!eligiblePrey(creature, settings)) continue;
    const squared = (creature.pos.x - predator.pos.x) ** 2 + (creature.pos.y - predator.pos.y) ** 2;
    if (squared < distance) { closest = creature; distance = squared; }
  }
  return closest;
}

export function nearestThreat(creature, predators, radius) {
  let closest = null, distance = radius ** 2;
  for (const predator of predators) {
    if (predator.dead()) continue;
    const squared = (predator.pos.x - creature.pos.x) ** 2 + (predator.pos.y - creature.pos.y) ** 2;
    if (squared < distance) { closest = predator; distance = squared; }
  }
  return closest;
}
