import vm from 'node:vm';
import { readFileSync } from 'node:fs';

// Doublure de p5.Vector pour les tests Node sans DOM ni dépendance.
// Les tests vérifient les règles du moteur, pas l'implémentation de p5.
class TestVector {
  constructor(x = 0, y = 0) { this.x = x; this.y = y; this.z = 0; }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new TestVector(this.x, this.y); }
  add(vector) { this.x += vector.x; this.y += vector.y; return this; }
  sub(vector) { this.x -= vector.x; this.y -= vector.y; return this; }
  mult(value) { this.x *= value; this.y *= value; return this; }
  magSq() { return this.x ** 2 + this.y ** 2; }
  mag() { return Math.hypot(this.x, this.y); }
  normalize() { const length = this.mag(); return length ? this.mult(1 / length) : this; }
  setMag(value) { return this.normalize().mult(value); }
  limit(value) { return this.magSq() > value ** 2 ? this.setMag(value) : this; }
  heading() { return Math.atan2(this.y, this.x); }
  dist(vector) { return Math.hypot(this.x - vector.x, this.y - vector.y); }
  static sub(a, b) { return a.copy().sub(b); }
}

globalThis.createVector = (x, y) => new TestVector(x, y);
globalThis.p5 = { Vector: TestVector };
globalThis.random = (min = 1, max) => max === undefined ? min * 0.5 : min + (max - min) * 0.5;
const source = readFileSync(new URL('../../vendor/vehicle.js', import.meta.url), 'utf8');
// Charge le vrai Vehicle fourni, sans l'éditer, puis expose sa classe aux modules.
vm.runInThisContext(`${source}\nglobalThis.Vehicle = Vehicle;`, { filename: 'vendor/vehicle.js' });

export function seededRandom(seed = 42) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function finiteCreature(creature) {
  return [creature.pos, creature.vel, creature.acc].every(vector =>
    [vector.x, vector.y, vector.z].every(Number.isFinite)) && Number.isFinite(creature.energy);
}

export function fakeDocument() {
  const elements = new Map();
  for (const id of ['population', 'food-count', 'poison-count', 'sim-time', 'mean-energy',
    'pause', 'reset', 'perception', 'status', 'extinction', 'arena',
    'births', 'deaths', 'max-generation', 'mean-age', 'reproduction-mode', 'seed', 'seed-reset',
    'control-message', 'inspector-title', 'inspector-detail', 'mode-description',
    'mean-lifespan', 'mean-offspring', 'food-rate', 'poison-rate', 'mutation-count', 'experiment-status',
    'predators-enabled', 'predator-debug', 'add-predator', 'remove-predator',
    'active-predators', 'captures', 'attacks', 'predation-deaths', 'predation-survival', 'predator-status',
    'mode-laboratory', 'mode-survival', 'mission-selection', 'mission-seed', 'game-hud',
    'game-mission', 'game-objective', 'game-time', 'game-population', 'game-generation', 'game-points',
    'game-progress', 'game-message', 'game-effects', 'game-results', 'game-result-title', 'game-result-detail', 'game-stars',
    'game-replay', 'game-next', 'game-selection', 'game-cancel', 'game-star-rules', 'game-selected',
    'laboratory-metrics', 'laboratory-genetics', 'laboratory-settings', 'arena-panel', 'arena-hint',
    'app-root', 'screen-home', 'screen-workspace', 'screen-tutorial', 'screen-settings', 'workspace-title',
    'home-title', 'home-play', 'home-laboratory', 'home-help', 'home-settings', 'nav-home', 'nav-help', 'nav-settings',
    'tutorial-title', 'tutorial-previous', 'tutorial-next', 'tutorial-restart', 'tutorial-close', 'tutorial-counter', 'tutorial-symbol', 'tutorial-text',
    'settings-title', 'settings-back', 'settings-reset', 'pref-reduced-motion', 'pref-high-contrast', 'pref-effects', 'pref-quality', 'settings-summary',
    'game-energy', 'game-predators', 'notifications', 'progress-reset', 'persistence-status',
    'science-profile', 'science-seed', 'science-apply', 'science-save', 'science-label', 'science-export', 'science-status',
    'science-current-seed', 'science-timeline', 'science-diversity', 'science-lifespan', 'science-food', 'science-poison', 'science-predation',
    'chart-population', 'chart-events', 'chart-energy', 'chart-generation', 'chart-diversity',
    ...[0, 1, 2, 3].flatMap(i => [`chart-gene-${i}`, `min-gene-${i}`, `max-gene-${i}`]),
    ...[0, 1, 2, 3].flatMap(i => ['row', 'label', 'config', 'duration', 'pop', 'generation', 'diversity', 'replay', 'export'].map(field => `experiment-${field}-${i}`)),
    ...[0, 1, 2].flatMap(i => [`notice-${i}`, `notice-${i}-text`, `notice-${i}-close`]),
    ...['food', 'cleanse', 'shelter', 'abundance'].flatMap(kind => [`action-${kind}-state`, `action-${kind}-progress`]),
    ...[1, 2, 3, 4, 5].flatMap(id => [`mission-${id}`, `mission-${id}-progress`]),
    ...['food', 'cleanse', 'shelter', 'abundance'].map(kind => `action-${kind}`),
    ...['predator-count', 'predator-speed', 'predator-perception', 'predator-capture', 'evade-weight', 'food-weight', 'poison-weight']
      .flatMap(id => [id, `${id}-value`]),
    ...['mutation-rate', 'mutation-amplitude', 'energy-threshold', 'energy-cost', 'min-age', 'max-population', 'cooldown']
      .flatMap(id => [id, `${id}-value`]),
    ...Array.from({ length: 4 }, (_, i) => [`mean-gene-${i}`, `sd-gene-${i}`, `initial-gene-${i}`]).flat()]) {
    const target = new EventTarget();
    Object.assign(target, { textContent: '', value: '', checked: false, hidden: true, dataset: {}, attributes: {}, clientWidth: 880,
      setAttribute(name, value) { this.attributes[name] = value; },
      click() { this.dispatchEvent(new Event('click')); },
      focus() { this.focused = true; },
    });
    elements.set(id, target);
  }
  return { getElementById: id => elements.get(id) };
}
