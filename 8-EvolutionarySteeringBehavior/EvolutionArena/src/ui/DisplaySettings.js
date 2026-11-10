export const DEFAULT_DISPLAY_SETTINGS = Object.freeze({
  reducedMotion: false, highContrast: false, effects: true, quality: 'standard',
});

export class DisplaySettings {
  constructor({ systemReducedMotion = false } = {}) {
    this.systemReducedMotion = Boolean(systemReducedMotion);
    this.defaults = Object.freeze({ ...DEFAULT_DISPLAY_SETTINGS, reducedMotion: this.systemReducedMotion });
    this.values = this.defaults;
  }

  update(changes) {
    if (Object.keys(changes).some(key => !Object.hasOwn(DEFAULT_DISPLAY_SETTINGS, key))) throw new TypeError('Paramètre visuel inconnu.');
    const next = { ...this.values, ...changes };
    if (['reducedMotion', 'highContrast', 'effects'].some(key => typeof next[key] !== 'boolean')
      || !['standard', 'economy'].includes(next.quality)) throw new RangeError('Paramètre visuel invalide.');
    // La préférence système de réduction des mouvements est toujours respectée.
    next.reducedMotion ||= this.systemReducedMotion;
    this.values = Object.freeze(next);
  }

  reset() { this.values = this.defaults; }
}
