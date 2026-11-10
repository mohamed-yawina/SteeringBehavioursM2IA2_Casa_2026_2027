export function nearestResource(position, resources, radius) {
  let nearest = null;
  let bestSquared = radius * radius;
  if (radius <= 0) return null;
  for (const resource of resources) {
    const dx = resource.pos.x - position.x;
    const dy = resource.pos.y - position.y;
    const squared = dx * dx + dy * dy;
    if (squared < bestSquared) {
      nearest = resource;
      bestSquared = squared;
    }
  }
  return nearest;
}

export function consumeResources(creature, resources, energyChange) {
  let consumed = 0;
  // Le contact physique est indépendant de la perception, comme dans le TP.
  const squaredRadius = creature.eatRadius ** 2;
  for (let i = resources.length - 1; i >= 0 && !creature.dead(); i--) {
    const dx = resources[i].pos.x - creature.pos.x;
    const dy = resources[i].pos.y - creature.pos.y;
    if (dx * dx + dy * dy < squaredRadius) {
      resources.splice(i, 1);
      consumed++;
      creature.energy = Math.max(0, Math.min(creature.maxEnergy, creature.energy + energyChange));
    }
  }
  return consumed;
}
