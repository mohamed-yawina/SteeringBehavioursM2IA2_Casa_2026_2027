export function missionState(mission, stats) {
  // L'extinction a priorité sur une limite de temps ou de génération atteinte.
  if (stats.population === 0) return { status: 'lost', reason: 'La population s’est éteinte.' };
  if (mission.requiredPredators && stats.activePredators !== mission.requiredPredators) {
    return { status: 'lost', reason: 'Les trois prédateurs requis ne sont plus actifs.' };
  }
  const goal = stats.time + 1e-8 >= mission.duration && stats.population >= mission.minimumPopulation
    && stats.maxGeneration >= mission.generation;
  if (goal && stats.time <= mission.deadline + 1e-8) return { status: 'won', reason: 'Objectif de mission atteint.' };
  if (stats.time + 1e-8 >= mission.deadline) return { status: 'lost', reason: 'Temps écoulé : objectif non atteint.' };
  return { status: 'running', reason: '' };
}

export function gameResult(mission, stats, points, actions, outcome) {
  const stars = outcome.status === 'won'
    ? 1 + Number(stats.population >= mission.starPopulation) + Number(points.spent <= mission.starSpending) : 0;
  return Object.freeze({ missionId: mission.id, ...outcome, stars, seed: stats.seed, time: stats.time,
    population: stats.population, generation: stats.maxGeneration, pointsSpent: points.spent,
    actionsUsed: actions.used, captures: stats.captures });
}
