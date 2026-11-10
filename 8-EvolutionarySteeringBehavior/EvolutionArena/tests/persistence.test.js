import './helpers/runtime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { LocalPreferences, defaultPreferences, validatePreferences, browserStorage, STORAGE_KEY } from '../src/persistence/LocalPreferences.js';
import { MissionProgress } from '../src/game/MissionProgress.js';
import { AppShell } from '../src/ui/AppShell.js';
import { GameMode } from '../src/game/GameMode.js';
import { Simulation } from '../src/simulation/Simulation.js';
import { fakeDocument } from './helpers/runtime.js';

function memoryStorage() {
  const data = new Map();
  return { data, getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
}

test('persistance : valeurs par défaut indépendantes, stockage absent et refus du getter', () => {
  const a = defaultPreferences(), b = defaultPreferences(); a.stars.push([1, 1]); assert.deepEqual(b.stars, []);
  const store = new LocalPreferences(); assert.deepEqual(store.load(), b); assert.equal(store.save(b), false);
  assert.match(store.message, /sans sauvegarde/);
  assert.equal(browserStorage({ get localStorage() { throw new Error('SecurityError'); } }), undefined);
});

test('persistance : étoiles et préférences survivent à une nouvelle instance', () => {
  const storage = memoryStorage(); const preferences = defaultPreferences(); preferences.stars = [[1, 3], [2, 1]];
  preferences.display.quality = 'economy'; preferences.preferences.perception = true;
  assert.equal(new LocalPreferences(storage).save(preferences), true);
  const reloaded = new LocalPreferences(storage).load(); assert.deepEqual(reloaded, preferences);
  preferences.stars[0][1] = 1; assert.equal(reloaded.stars[0][1], 3);
});

test('persistance : JSON corrompu, schéma inconnu et données surdimensionnées sans crash', () => {
  const storage = memoryStorage(), store = new LocalPreferences(storage);
  for (const raw of ['{', 'null', '{}', '{"version":2}', 'x'.repeat(8193)]) {
    storage.setItem(STORAGE_KEY, raw); assert.deepEqual(store.load(), defaultPreferences()); assert.match(store.message, /défaut/);
  }
});

test('persistance : rejet des étoiles invalides et de la progression discontinue', () => {
  for (const stars of [[[1, 0]], [[1, 4]], [[2, 1]], [[1, 1], [1, 2]], [[1.5, 2]], [null]]) {
    assert.throws(() => validatePreferences({ ...defaultPreferences(), stars }));
  }
  assert.deepEqual(validatePreferences({ ...defaultPreferences(), stars: [[2, 2], [1, 3]] }).stars, [[1, 3], [2, 2]]);
});

test('persistance : liste blanche et validation des types, pas de simulation sérialisée', () => {
  const data = { ...defaultPreferences(), world: { seed: 12 }, dna: [1, 2, 3, 4] };
  assert.deepEqual(Object.keys(validatePreferences(data)), ['version', 'stars', 'display', 'preferences']);
  for (const bad of [{ ...data, display: { ...data.display, effects: 1 } }, { ...data, display: { ...data.display, quality: 'ultra' } },
    { ...data, preferences: { perception: 'true', predatorDebug: false } }]) assert.throws(() => validatePreferences(bad));
});

test('persistance : quota et lecture refusée conservent la session utilisable', () => {
  const store = new LocalPreferences({ getItem() { throw new Error('denied'); }, setItem() { throw new Error('quota'); } });
  assert.deepEqual(store.load(), defaultPreferences()); assert.equal(store.save(defaultPreferences()), false);
});

test('progression : callback uniquement après victoire et reset, conservation de la meilleure étoile', () => {
  const progress = new MissionProgress(); let changes = 0; progress.onChange = () => changes++;
  progress.record({ missionId: 1, status: 'lost', stars: 0 }); assert.equal(changes, 0);
  progress.record({ missionId: 1, status: 'won', stars: 3 }); progress.record({ missionId: 1, status: 'won', stars: 1 });
  assert.equal(progress.bestStars.get(1), 3); assert.equal(changes, 2); assert.ok(progress.isUnlocked(2));
  progress.reset(); assert.equal(changes, 3); assert.equal(progress.isUnlocked(2), false);
});

test('interface : reset de progression en deux clics, annulation par navigation et désabonnement', () => {
  const root = fakeDocument(); let resets = 0; const game = new GameMode(new Simulation());
  const shell = new AppShell(game, root, { onResetProgress: () => resets++ });
  const button = root.getElementById('progress-reset'); shell.open('settings'); button.click(); assert.equal(resets, 0);
  shell.back(); shell.open('settings'); button.click(); assert.equal(resets, 0); button.click(); assert.equal(resets, 1);
  shell.dispose(); button.click(); button.click(); assert.equal(resets, 1);
});

test('application : sauvegarde événementielle, rechargement et isolation scientifique', async () => {
  const previousWindow = globalThis.window; globalThis.window = {};
  const { mountApp } = await import('../src/main.js');
  const storage = memoryStorage(); let writes = 0;
  const originalSet = storage.setItem; storage.setItem = (...args) => { writes++; originalSet(...args); };
  function sketch() {
    return { localStorage: storage, devicePixelRatio: 1, createCanvas() { return { elt: { setAttribute() {} }, parent() {} }; },
      pixelDensity() {}, frameRate() {}, resizeCanvas() {} };
  }
  try {
    const root = fakeDocument(); const first = mountApp(sketch(), root, { startScreen: 'home' });
    const settings = first.world.evolution;
    first.game.missions.progress.record({ missionId: 1, status: 'won', stars: 3 });
    root.getElementById('perception').checked = true; root.getElementById('perception').dispatchEvent(new Event('change'));
    root.getElementById('pref-high-contrast').checked = true; root.getElementById('pref-high-contrast').dispatchEvent(new Event('change'));
    const count = writes; for (let i = 0; i < 20; i++) first.world.step(); assert.equal(writes, count);
    assert.equal(first.world.evolution, settings); first.dispose();
    const second = mountApp(sketch(), fakeDocument(), { startScreen: 'home', systemReducedMotion: true });
    assert.equal(second.game.missions.progress.bestStars.get(1), 3); assert.equal(second.display.values.highContrast, true);
    assert.equal(second.display.values.reducedMotion, true); assert.equal(second.ui.showPerception, true);
    assert.equal(second.world.time, 0); assert.equal(second.world.creatures.length, 36); assert.deepEqual(second.world.evolution, settings);
    second.dispose();
  } finally { globalThis.window = previousWindow; }
});
