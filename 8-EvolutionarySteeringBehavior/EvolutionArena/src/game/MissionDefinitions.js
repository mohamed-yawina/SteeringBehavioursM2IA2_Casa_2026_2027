function freezeTree(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freezeTree);
    Object.freeze(value);
  }
  return value;
}

// Équilibrage des scénarios seulement : mêmes quatre gènes et même algorithme.
const base = { energyDrain: 0.025, foodCount: 100, foodPerSecond: 4 };
export const MISSIONS = freezeTree([
  { id: 1, title: 'Premiers pas', objective: 'Survivre 60 s avec au moins 10 créatures à la fin.',
    duration: 60, deadline: 60, minimumPopulation: 10, generation: 1,
    starPopulation: 45, starSpending: 24,
    simulation: { ...base, poisonCount: 0, poisonPerSecond: 0 }, predation: { enabled: false } },
  { id: 2, title: 'Équilibre naturel', objective: 'Survivre 120 s dans un écosystème avec nourriture et poison.',
    duration: 120, deadline: 120, minimumPopulation: 1, generation: 1,
    starPopulation: 24, starSpending: 60, requiresFoodAndPoison: true,
    simulation: { ...base, foodPerSecond: 3.5, energyDrain: 0.035, poisonCount: 28, poisonPerSecond: 0.2 }, predation: { enabled: false } },
  { id: 3, title: 'Première évolution', objective: 'Atteindre la génération 3 avant 150 s.',
    duration: 0, deadline: 150, minimumPopulation: 1, generation: 3,
    starPopulation: 35, starSpending: 48,
    simulation: { ...base, foodPerSecond: 3, energyDrain: 0.035, poisonCount: 28, poisonPerSecond: 0.2 }, predation: { enabled: false } },
  { id: 4, title: 'Invasion', objective: 'Survivre 180 s sous la menace de 3 prédateurs actifs.',
    duration: 180, deadline: 180, minimumPopulation: 1, generation: 1, requiredPredators: 3,
    starPopulation: 21, starSpending: 60,
    simulation: { creatureCount: 40, foodCount: 100, maxFood: 180, foodPerSecond: 4,
      poisonCount: 22, poisonPerSecond: 0.15, energyDrain: 0.03 },
    // Menace persistante pour toute la mission : pas de mort de faim des chasseurs.
    predation: { enabled: true, count: 3, speed: 2.5, perceptionRadius: 160, captureRadius: 9,
      captureCooldown: 6, evadeWeight: 2.5, energyDrain: 0 } },
  { id: 5, title: 'Survival of the Smartest', objective: 'Atteindre la génération 5 avec au moins 15 créatures, avant 240 s.',
    duration: 0, deadline: 240, minimumPopulation: 15, generation: 5,
    starPopulation: 20, starSpending: 84,
    simulation: { creatureCount: 44, foodCount: 110, maxFood: 200, foodPerSecond: 3.5,
      poisonCount: 24, poisonPerSecond: 0.18, energyDrain: 0.035 },
    predation: { enabled: true, count: 2, speed: 2.6, perceptionRadius: 170,
      captureRadius: 10, captureCooldown: 4, energyDrain: 0.008 } },
]);

export function getMission(id) {
  const mission = MISSIONS.find(item => item.id === id);
  if (!mission) throw new RangeError('Mission inconnue.');
  return mission;
}

export function validateMission(mission, world) {
  if (!Number.isFinite(mission.deadline) || mission.deadline <= 0
    || !Number.isFinite(mission.duration) || mission.duration < 0 || mission.duration > mission.deadline
    || !Number.isInteger(mission.minimumPopulation) || mission.minimumPopulation < 1
    || mission.minimumPopulation > world.evolution.maxPopulation
    || !Number.isInteger(mission.generation) || mission.generation < 1
    || !Number.isInteger(mission.starPopulation) || mission.starPopulation < mission.minimumPopulation
    || mission.starPopulation > world.evolution.maxPopulation
    || !Number.isFinite(mission.starSpending) || mission.starSpending < 0
    || (mission.generation > 1 && (world.evolution.mode === 'off' || world.evolution.birthProbability === 0))
    || (mission.requiredPredators && world.stats.activePredators !== mission.requiredPredators)
    || (mission.requiresFoodAndPoison && !(world.food.length && world.poison.length
      && world.settings.foodPerSecond > 0 && world.settings.poisonPerSecond > 0))) {
    throw new RangeError('Objectif incompatible avec la configuration de mission.');
  }
}
