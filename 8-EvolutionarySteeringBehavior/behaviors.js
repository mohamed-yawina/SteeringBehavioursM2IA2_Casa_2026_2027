// =====================================================================
// Catalogue de comportements nommés.
// Chaque fonction reçoit un contexte et utilise les méthodes de Vehicle.
// =====================================================================

const Behaviors = {
  // --- Pour un véhicule "mangeur" (colonie) -------------------------
  seekFood: (v) => (ctx) => {
    const target = nearest(v, ctx.food, v.dna[2]);
    return target ? v.seek(target).mult(v.dna[0]) : createVector(0, 0);
  },
  seekPoison: (v) => (ctx) => {
    // poids ADN (négatif = fuite naturelle)
    const target = nearest(v, ctx.poison, v.dna[3]);
    return target ? v.seek(target).mult(v.dna[1]) : createVector(0, 0);
  },
  avoidPredators: (v) => (ctx) => {
    const target = nearest(v, ctx.predators.map(p => p.pos), v.dna[5]);
    return target ? v.seek(target).mult(v.dna[4]) : createVector(0, 0);
  },
  wander: (v) => {
    const state = { theta: random(TWO_PI) };
    return (ctx) => v.wander(state);
  },
  boundaries: (v) => (ctx) => v.boundaries(),
  separation: (v) => (ctx) => v.separation(ctx.neighbors ?? []),

  // --- Pour un prédateur ---------------------------------------------
  pursuePrey: (v) => (ctx) => {
    if (!ctx.prey || ctx.prey.length === 0) return createVector(0, 0);
    const target = nearest(v, ctx.prey.map(p => p.pos), v.perception);
    if (!target) return createVector(0, 0);
    return v.seek(p5.Vector.add(target, p5.Vector.mult(
      ctx.prey.find(p => p.pos === target)?.vel ?? createVector(0, 0), 12)));
  },
  avoidObstacles: (v) => (ctx) => v.obstacleAvoidance(ctx.obstacles ?? []),
  arriveMouse: (v) => (ctx) => v.arrive(createVector(mouseX, mouseY), 100, 40),
};

// Helper : renvoie le point (Vector) le plus proche dans le rayon
function nearest(v, list, radius) {
  let best = null, bestD = radius;
  for (const item of list) {
    const p = item.pos ?? item;
    const d = p5.Vector.dist(v.pos, p);
    if (d < bestD) { bestD = d; best = p; }
  }
  return best;
}