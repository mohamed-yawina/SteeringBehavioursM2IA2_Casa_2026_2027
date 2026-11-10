// Seek est réutilisé depuis Vehicle : desiredVelocity - currentVelocity.
export function flee(vehicle, target) {
  const desired = p5.Vector.sub(vehicle.pos, target).setMag(vehicle.maxSpeed);
  // Inverser la direction AVANT la soustraction, jamais inverser Seek.
  return desired.sub(vehicle.vel).limit(vehicle.maxForce);
}

export function resourceForce(vehicle, target, weight) {
  if (!target || weight === 0) return createVector(0, 0);
  const force = weight > 0 ? vehicle.seek(target.pos) : flee(vehicle, target.pos);
  return force.mult(Math.abs(weight)).limit(vehicle.maxForce);
}

export function boundaryForce(vehicle, width, height) {
  const margin = 48;
  let x = vehicle.vel.x;
  let y = vehicle.vel.y;
  let nearEdge = false;
  if (vehicle.pos.x < margin) { x = vehicle.maxSpeed; nearEdge = true; }
  else if (vehicle.pos.x > width - margin) { x = -vehicle.maxSpeed; nearEdge = true; }
  if (vehicle.pos.y < margin) { y = vehicle.maxSpeed; nearEdge = true; }
  else if (vehicle.pos.y > height - margin) { y = -vehicle.maxSpeed; nearEdge = true; }
  if (!nearEdge) return createVector(0, 0);
  return createVector(x, y).setMag(vehicle.maxSpeed).sub(vehicle.vel).limit(vehicle.maxForce);
}

export function combinedForce(vehicle, foodTarget, poisonTarget, width, height, {
  foodWeight = 1, poisonWeight = 1, evadeForce = null, evadeWeight = 1,
} = {}) {
  const edges = boundaryForce(vehicle, width, height);
  // Priorité aux bords : une attraction opposée ne doit pas annuler le retour.
  if (edges.magSq() > 0) return edges;
  const force = resourceForce(vehicle, foodTarget, vehicle.dna.foodWeight).mult(foodWeight)
    .add(resourceForce(vehicle, poisonTarget, vehicle.dna.poisonWeight).mult(poisonWeight));
  if (evadeForce) force.add(evadeForce.copy().mult(evadeWeight));
  return force.limit(vehicle.maxForce);
}
