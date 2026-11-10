export const PREDATION_DEFAULTS = Object.freeze({
  enabled: false, count: 2, speed: 2.4, maxForce: 0.14,
  perceptionRadius: 160, captureRadius: 9, evadeWeight: 2,
  foodWeight: 1, poisonWeight: 1, preyPerception: 140, smoothingSeconds: 0.12,
  maxPredictionSeconds: 0.75, energyDrain: 0.015, captureEnergy: 0.45,
  captureCooldown: 4, spawnGrace: 3, newbornProtection: 1.5, minimumPrey: 6,
});

export function predationSettings(changes = {}, current = PREDATION_DEFAULTS) {
  if (Object.keys(changes).some(key => !Object.hasOwn(PREDATION_DEFAULTS, key))) {
    throw new TypeError('Paramètre de prédation inconnu.');
  }
  const config = { ...current, ...changes };
  const within = (key, min, max) => Number.isFinite(config[key]) && config[key] >= min && config[key] <= max;
  if (typeof config.enabled !== 'boolean' || !within('count', 0, 8) || !Number.isInteger(config.count)
    || !within('speed', 0.2, 4) || !within('maxForce', 0.01, 0.3)
    || !within('perceptionRadius', 40, 350) || !within('captureRadius', 3, 24)
    || !within('evadeWeight', 0, 5) || !within('foodWeight', 0, 3) || !within('poisonWeight', 0, 3)
    || !within('preyPerception', 40, 350) || !within('smoothingSeconds', 0.05, 1)
    || !within('maxPredictionSeconds', 0, 2) || !within('energyDrain', 0, 1)
    || !within('captureEnergy', 0, 1.5) || !within('captureCooldown', 0.2, 30)
    || !within('spawnGrace', 0, 20) || !within('newbornProtection', 0, 20)
    || !within('minimumPrey', 0, 1000) || !Number.isInteger(config.minimumPrey)) {
    throw new RangeError('Paramètres de prédation invalides.');
  }
  return Object.freeze(config);
}
