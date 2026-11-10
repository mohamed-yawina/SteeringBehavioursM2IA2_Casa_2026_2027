import { DEFAULT_DISPLAY_SETTINGS } from '../ui/DisplaySettings.js';

export const STORAGE_KEY = 'evolution-arena.preferences.v1';
export function defaultPreferences() {
  return { version: 1, stars: [], display: { ...DEFAULT_DISPLAY_SETTINGS }, preferences: { perception: false, predatorDebug: false } };
}

// Liste blanche : aucun monde, ADN, graine ou paramètre expérimental n'est chargé.
export function validatePreferences(data) {
  if (!data || data.version !== 1 || !Array.isArray(data.stars) || data.stars.length > 5
    || !data.display || !data.preferences) throw new TypeError('Sauvegarde incompatible.');
  const result = defaultPreferences();
  for (const key of ['reducedMotion', 'highContrast', 'effects']) {
    if (typeof data.display[key] !== 'boolean') throw new TypeError('Préférence visuelle invalide.');
    result.display[key] = data.display[key];
  }
  if (!['standard', 'economy'].includes(data.display.quality)) throw new TypeError('Qualité invalide.');
  result.display.quality = data.display.quality;
  for (const key of ['perception', 'predatorDebug']) {
    if (typeof data.preferences[key] !== 'boolean') throw new TypeError('Préférence utilisateur invalide.');
    result.preferences[key] = data.preferences[key];
  }
  // La progression doit former un préfixe de missions gagnées, sans doublon.
  const entries = [...data.stars].sort((a, b) => (a?.[0] ?? 0) - (b?.[0] ?? 0));
  entries.forEach((entry, index) => {
    if (!Array.isArray(entry) || entry.length !== 2 || entry[0] !== index + 1
      || !Number.isInteger(entry[1]) || entry[1] < 1 || entry[1] > 3) throw new TypeError('Progression invalide.');
    result.stars.push([...entry]);
  });
  return result;
}

export class LocalPreferences {
  constructor(storage) { this.storage = storage; this.message = ''; }
  load() {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return defaultPreferences();
      if (raw.length > 8192) throw new RangeError('Sauvegarde trop volumineuse.');
      return validatePreferences(JSON.parse(raw));
    } catch {
      this.message = 'Sauvegarde illisible ou stockage inaccessible : valeurs par défaut utilisées.';
      return defaultPreferences();
    }
  }
  save(data) {
    const valid = validatePreferences(data);
    try {
      if (!this.storage) throw new Error('Stockage indisponible.');
      this.storage.setItem(STORAGE_KEY, JSON.stringify(valid));
      this.message = 'Progression et préférences enregistrées sur ce navigateur.';
      return true;
    } catch {
      this.message = 'Stockage indisponible ou saturé : la session reste utilisable, sans sauvegarde.';
      return false;
    }
  }
}

export function browserStorage(sketch) {
  try { return sketch.localStorage; } catch { return undefined; }
}
