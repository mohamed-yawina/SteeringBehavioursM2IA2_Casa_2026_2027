export const EVOLUTION_DEFAULTS = Object.freeze({
  mode: 'arena', mutationRate: 0.01, mutationAmplitude: 1,
  energyThreshold: 1.15, energyCost: 0.4, minAge: 6, cooldown: 8,
  maxPopulation: 120, birthProbability: 0.002,
});

export function evolutionSettings(changes = {}, current = EVOLUTION_DEFAULTS) {
  if (Object.keys(changes).some(key => !Object.hasOwn(EVOLUTION_DEFAULTS, key))) {
    throw new TypeError('Paramètre génétique inconnu.');
  }
  const settings = { ...current, ...changes };
  const range = (key, min, max) => Number.isFinite(settings[key]) && settings[key] >= min && settings[key] <= max;
  if (!['arena', 'tp', 'off'].includes(settings.mode)
    || !range('mutationRate', 0, 1) || !range('mutationAmplitude', 0, 5)
    || !range('energyThreshold', 0, 1.5) || !range('energyCost', 0.01, 1.5)
    || !range('minAge', 0, 300) || !range('cooldown', 0, 300)
    || !range('birthProbability', 0, 1) || !range('maxPopulation', 1, 1000)
    || !Number.isInteger(settings.maxPopulation)) {
    throw new RangeError('Paramètres de reproduction invalides.');
  }
  return Object.freeze(settings);
}

export function canReproduce(creature, settings) {
  if (settings.mode === 'off' || creature.dead()) return false;
  if (settings.mode === 'tp') return true;
  return creature.energy >= settings.energyThreshold && creature.energy > settings.energyCost
    && creature.age + 1e-9 >= settings.minAge
    && (creature.lastReproductionAge === null
      || creature.age - creature.lastReproductionAge + 1e-9 >= settings.cooldown);
}
