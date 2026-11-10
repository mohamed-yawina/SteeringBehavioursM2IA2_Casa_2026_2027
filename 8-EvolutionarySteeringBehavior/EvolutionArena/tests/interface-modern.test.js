import './helpers/runtime.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fakeDocument } from './helpers/runtime.js';
import { Simulation } from '../src/simulation/Simulation.js';
import { GameMode } from '../src/game/GameMode.js';
import { DisplaySettings } from '../src/ui/DisplaySettings.js';
import { AppShell } from '../src/ui/AppShell.js';
import { Tutorial, TUTORIAL_STEPS } from '../src/ui/Tutorial.js';
import { NotificationCenter } from '../src/ui/NotificationCenter.js';
import { GameInterface } from '../src/ui/GameInterface.js';
import { ArenaRenderer } from '../src/ui/ArenaRenderer.js';
import { GameRenderer } from '../src/ui/GameRenderer.js';

function setupShell(options = {}) {
  const root = fakeDocument(), game = new GameMode(new Simulation());
  const shell = new AppShell(game, root, options);
  return { root, game, shell, get: id => root.getElementById(id) };
}

function fakeSketch() {
  const calls = [];
  const canvas = { setAttribute() {} };
  const p = { width: 880, height: 520, deltaTime: 1000 / 60, mouseX: 100, mouseY: 100, HALF_PI: Math.PI / 2,
    createCanvas(width, height) { this.width = width; this.height = height; return { elt: canvas, parent() {} }; },
    resizeCanvas(width, height) { this.width = width; this.height = height; },
    pixelDensity(value) { this.density = value; }, frameRate(value) { this.requestedFPS = value; },
  };
  for (const method of ['background', 'push', 'pop', 'scale', 'stroke', 'strokeWeight', 'line', 'noFill', 'rect', 'noStroke', 'fill', 'circle', 'translate', 'rotate', 'triangle']) {
    p[method] = (...args) => {
      assert.ok(args.every(value => typeof value !== 'number' || Number.isFinite(value)), method);
      calls.push([method, ...args]);
    };
  }
  return { p, canvas, calls };
}

test('accueil : quatre entrées, navigation Laboratoire/Survie sans réinitialiser les mondes', () => {
  const { game, shell, get } = setupShell();
  assert.equal(shell.screen, 'home'); assert.equal(get('screen-workspace').hidden, true);
  get('home-laboratory').click(); assert.equal(shell.isWorkspace, true); assert.equal(game.mode, 'laboratory');
  game.laboratory.advance(0.1); const time = game.laboratory.time;
  get('nav-home').click(); get('home-play').click(); assert.equal(game.mode, 'survival');
  assert.equal(game.missions.status, 'selection'); assert.equal(game.laboratory.time, time);
  shell.dispose();
});

test('écrans secondaires : retour imbriqué, historique borné et focus du titre', () => {
  const { shell, get } = setupShell({ startScreen: 'laboratory' });
  get('nav-settings').click(); assert.equal(shell.screen, 'settings'); assert.ok(get('settings-title').focused);
  get('nav-help').click(); assert.equal(shell.screen, 'tutorial');
  get('tutorial-close').click(); assert.equal(shell.screen, 'settings');
  get('settings-back').click(); assert.equal(shell.screen, 'workspace'); assert.ok(get('workspace-title').focused);
  for (let i = 0; i < 20; i++) { shell.open('settings'); shell.open('tutorial'); }
  assert.ok(shell.history.length <= 4); assert.throws(() => shell.open('invalid'));
  shell.dispose();
});

test('tutoriel : sept sujets, bornes, navigation, redémarrage et fermeture finale', () => {
  const tutorial = new Tutorial(); assert.equal(tutorial.total, 7);
  tutorial.previous(); assert.equal(tutorial.index, 0);
  for (let i = 0; i < 10; i++) tutorial.next(); assert.equal(tutorial.index, 6);
  tutorial.restart(); assert.equal(tutorial.index, 0);
  const { shell, get } = setupShell(); get('home-help').click(); assert.ok(get('tutorial-previous').disabled);
  for (let i = 0; i < 6; i++) get('tutorial-next').click();
  assert.equal(get('tutorial-next').textContent, 'Terminer'); get('tutorial-next').click(); assert.equal(shell.screen, 'home');
  assert.ok(TUTORIAL_STEPS.some(s => /mutée/.test(s.text)) && TUTORIAL_STEPS.some(s => /poison/.test(s.text)));
  shell.dispose();
});

test('paramètres : validation atomique, instantané immuable et restauration', () => {
  const settings = new DisplaySettings(); const initial = settings.values;
  settings.update({ reducedMotion: true, highContrast: true, quality: 'economy', effects: false });
  assert.equal(settings.values.quality, 'economy'); assert.ok(settings.values.reducedMotion);
  const previous = settings.values;
  for (const change of [{ quality: 'ultra' }, { effects: 1 }, { maxSpeed: 10 }]) {
    assert.throws(() => settings.update(change)); assert.equal(settings.values, previous);
  }
  assert.throws(() => { settings.values.effects = true; }, TypeError);
  settings.reset(); assert.equal(settings.values, initial);
});

test('réduction système : activée par défaut et non contournable par le contrôle', () => {
  const settings = new DisplaySettings({ systemReducedMotion: true }); settings.update({ reducedMotion: false });
  assert.equal(settings.values.reducedMotion, true);
  const { shell, get } = setupShell({ settings }); assert.ok(get('pref-reduced-motion').disabled);
  settings.reset(); assert.equal(settings.values.reducedMotion, true); shell.dispose();
});

test('paramètres HTML : effets, contraste, qualité et réduction reliés aux attributs visuels', () => {
  const { shell, get } = setupShell(); get('home-settings').click();
  get('pref-high-contrast').checked = true; get('pref-high-contrast').dispatchEvent(new Event('change'));
  assert.equal(get('app-root').dataset.contrast, 'high');
  get('pref-effects').checked = false; get('pref-effects').dispatchEvent(new Event('change'));
  assert.equal(get('app-root').dataset.effects, 'off');
  get('pref-quality').value = 'economy'; get('pref-quality').dispatchEvent(new Event('change'));
  assert.match(get('settings-summary').textContent, /30 images/);
  get('settings-reset').click(); assert.equal(shell.settings.values.effects, true); shell.dispose();
});

test('notifications : capacité trois, déduplication, expiration et fermeture clavier/native', () => {
  const root = fakeDocument(); const center = new NotificationCenter(root);
  center.push('Une'); center.push('Une'); assert.equal(center.items.length, 1);
  center.push('Deux', { tone: 'success' }); center.push('Trois'); center.push('Quatre');
  assert.equal(center.items.length, 3); assert.equal(center.items[0].message, 'Deux');
  assert.match(root.getElementById('notice-0-text').textContent, /Réussite/);
  root.getElementById('notice-0-close').click(); assert.equal(center.items.length, 2);
  center.advance(4); assert.equal(center.items.length, 0); assert.ok(root.getElementById('notice-0').hidden);
  assert.throws(() => center.push('bad', { duration: NaN })); center.dispose();
});

test('missions : cartes verrouillées, HUD complet, raisons de désactivation et barres de cooldown', () => {
  const root = fakeDocument(), game = new GameMode(new Simulation()); const ui = new GameInterface(game, root);
  game.switchTo('survival'); ui.update(); assert.ok(root.getElementById('mission-2').disabled);
  assert.match(root.getElementById('mission-2-progress').textContent, /précédente/);
  game.missions.start(1); ui.update(); assert.equal(root.getElementById('game-energy').textContent, '100 %');
  assert.equal(root.getElementById('game-predators').textContent, '0');
  game.missions.act('food', 500, 300); ui.update(); assert.ok(root.getElementById('action-food').disabled);
  assert.match(root.getElementById('action-food-state').textContent, /récupération/);
  assert.equal(root.getElementById('action-food-progress').value, 0);
  game.missions.points.available = 0; ui.update(); assert.match(root.getElementById('action-shelter-state').textContent, /insuffisants/);
  ui.dispose();
});

test('résultats : style victoire/défaite, étoiles accessibles, notifications sans doublons', () => {
  const root = fakeDocument(), game = new GameMode(new Simulation()), notifications = new NotificationCenter(root);
  const ui = new GameInterface(game, root, { notifications }); game.switchTo('survival'); game.missions.start(1); ui.update();
  game.missions.world.time = 60 - 1 / 60; game.missions.step(); ui.update();
  assert.equal(root.getElementById('game-results').dataset.result, 'won');
  assert.match(root.getElementById('game-stars').attributes['aria-label'], /étoiles sur 3/);
  const count = notifications.items.length; ui.update(); assert.equal(notifications.items.length, count);
  game.missions.replay(); ui.update(); game.missions.world.creatures = []; game.missions.step(); ui.update();
  assert.equal(root.getElementById('game-results').dataset.result, 'lost'); assert.ok(root.getElementById('game-next').disabled);
  assert.ok(notifications.items.some(item => item.tone === 'error')); ui.dispose(); notifications.dispose();
});

test('HTML : tous les nouveaux composants existent, boutons natifs et labels sans duplications', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]); assert.equal(ids.length, new Set(ids).size);
  const { shell } = setupShell(); for (const id of Object.keys(shell.elements)) assert.ok(ids.includes(id), id);
  assert.match(html, /id="notifications"[^>]*aria-live="polite"/);
  for (const id of ['home-play', 'home-laboratory', 'home-help', 'home-settings', 'tutorial-next', 'settings-back']) {
    assert.ok(new RegExp(`<button[^>]*id="${id}"`).test(html), id);
  }
  for (const id of ['pref-reduced-motion', 'pref-high-contrast', 'pref-effects', 'pref-quality']) {
    assert.ok(new RegExp(`<label[^>]*>[\\s\\S]*?id="${id}"[\\s\\S]*?<\\/label>`).test(html), id);
  }
  shell.dispose();
});

test('HTML : structure des écrans correctement imbriquée, sans balise ouverte restante', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  const voidTags = new Set(['meta', 'link', 'input', 'br', 'hr', 'img', 'source', 'area', 'base', 'col', 'embed', 'param', 'track', 'wbr']);
  const stack = [];
  for (const match of html.matchAll(/<(\/?)([a-z][\w-]*)\b[^>]*>/gi)) {
    const name = match[2].toLowerCase();
    if (voidTags.has(name)) continue;
    if (match[1]) assert.equal(stack.pop(), name, `Fermeture ${name}`);
    else stack.push(name);
  }
  assert.deepEqual(stack, []);
});

test('CSS : responsive, mouvements réduits, focus visible et motifs non fondés sur la couleur seule', () => {
  const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
  for (const pattern of [/prefers-reduced-motion/, /focus-visible/, /data-motion=reduced/, /max-width: 760px/, /border-style: dashed/]) assert.match(css, pattern);
});

test('contrastes de palette : texte principal, texte secondaire et bouton primaire ≥ 4,5:1', () => {
  const css = readFileSync(new URL('../theme.css', import.meta.url), 'utf8');
  const color = name => css.match(new RegExp(`--${name}:\\s*(#[0-9a-f]{6})`))[1];
  const luminance = hex => {
    const channel = [1, 3, 5].map(start => parseInt(hex.slice(start, start + 2), 16) / 255)
      .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
    return channel[0] * 0.2126 + channel[1] * 0.7152 + channel[2] * 0.0722;
  };
  for (const [text, background] of [[color('text'), color('panel')], [color('muted'), color('panel')], ['#071322', color('cyan')]]) {
    const a = luminance(text), b = luminance(background); assert.ok((Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05) >= 4.5);
  }
});

test('point d’entrée navigateur : window.setup ouvre bien l’accueil, sans avancer le monde', async () => {
  const previousWindow = globalThis.window, previousDocument = globalThis.document;
  const root = fakeDocument(), { p } = fakeSketch();
  globalThis.window = p; globalThis.document = root;
  try {
    await import('../src/main.js?test-home-entry');
    const app = p.setup(); assert.equal(app.shell.screen, 'home'); p.draw(); assert.equal(app.world.time, 0); app.dispose();
  } finally {
    globalThis.window = previousWindow;
    if (previousDocument === undefined) delete globalThis.document; else globalThis.document = previousDocument;
  }
});

test('rendu : lecture seule, aucun appel aléatoire et aucune valeur NaN', () => {
  const world = new Simulation({ predation: { enabled: true } }); world.advance(0.2);
  const { p } = fakeSketch(); const renderer = new ArenaRenderer(world, p); const before = JSON.stringify(world);
  const random = Math.random;
  try {
    Math.random = () => { throw new Error('Aléatoire dans le rendu'); };
    renderer.draw(true, true);
  } finally { Math.random = random; }
  assert.equal(JSON.stringify(world), before);
});

test('animations réduites/effets désactivés : halos stables, sélection et zone toujours visibles', () => {
  const world = new Simulation(), settings = new DisplaySettings(); const { p, calls } = fakeSketch();
  const c = world.creatures[0]; c.birthFlash = 0.8; world.selectedId = c.id;
  settings.update({ reducedMotion: true }); const renderer = new ArenaRenderer(world, p, settings); renderer.draw(false);
  assert.ok(calls.some(call => call[0] === 'circle' && call[3] === 20));
  settings.update({ effects: false }); calls.length = 0; renderer.draw(false);
  assert.ok(calls.some(call => call[0] === 'circle' && call[3] === 24));
  const game = new GameMode(world); game.missions.start(1); game.missions.act('shelter', 500, 300);
  new GameRenderer(p, settings).draw(game.missions); assert.ok(calls.some(call => call[0] === 'circle' && call[3] === 190));
});

test('qualité économique : moins de primitives, générations reconnaissables sans changer la physique', () => {
  const world = new Simulation(), settings = new DisplaySettings(); const { p, calls } = fakeSketch();
  const renderer = new ArenaRenderer(world, p, settings); renderer.draw(false); const normalCalls = calls.length;
  calls.length = 0; settings.update({ quality: 'economy' }); renderer.draw(false); assert.ok(calls.length < normalCalls);
  const c = world.creatures[0]; calls.length = 0; c.generation = 1; renderer.drawCreature(c, false); const g1 = calls.filter(c => c[0] === 'line').length;
  calls.length = 0; c.generation = 3; renderer.drawCreature(c, false); const g3 = calls.filter(c => c[0] === 'line').length;
  assert.equal(g3, g1 + 2);
});

test('application : accueil initial, menus sans avancée, retour de partie et réglages purement visuels', async () => {
  globalThis.window = {};
  const { mountApp } = await import('../src/main.js'); const root = fakeDocument(); const { p, canvas, calls } = fakeSketch();
  const app = mountApp(p, root, { startScreen: 'home' });
  for (let i = 0; i < 30; i++) p.draw(); assert.equal(app.world.time, 0);
  p.mousePressed({ target: canvas }); assert.equal(app.world.food.length, 90);
  root.getElementById('home-play').click(); p.draw(); assert.equal(calls.filter(call => call[0] === 'background').length, 0);
  root.getElementById('nav-home').click();
  root.getElementById('home-laboratory').click(); p.draw(); assert.ok(app.world.time > 0);
  root.getElementById('nav-settings').click(); const snapshot = JSON.stringify(app.world);
  root.getElementById('pref-quality').value = 'economy'; root.getElementById('pref-quality').dispatchEvent(new Event('change'));
  assert.equal(p.requestedFPS, 30); assert.equal(p.density, 1);
  for (let i = 0; i < 30; i++) p.draw(); assert.equal(JSON.stringify(app.world), snapshot);
  root.getElementById('settings-back').click(); p.draw(); assert.ok(app.world.time > JSON.parse(snapshot).time);
  app.dispose();
});

test('temps simulé : 30 et 60 rendus/s donnent le même état, mêmes réglages scientifiques', async () => {
  globalThis.window = {}; const { mountApp } = await import('../src/main.js');
  const a = fakeSketch(), b = fakeSketch(); const appA = mountApp(a.p, fakeDocument()), appB = mountApp(b.p, fakeDocument());
  a.p.deltaTime = 1000 / 30; b.p.deltaTime = 1000 / 60;
  for (let i = 0; i < 30; i++) a.p.draw(); for (let i = 0; i < 60; i++) b.p.draw();
  assert.deepEqual(appA.world.stats, appB.world.stats);
  assert.deepEqual(appA.world.creatures.map(c => [c.pos.x, c.pos.y]), appB.world.creatures.map(c => [c.pos.x, c.pos.y]));
  appA.dispose(); appB.dispose();
});

test('Survie suspendue par un menu : points, effets et actions préservés jusqu’au retour', async () => {
  globalThis.window = {}; const { mountApp } = await import('../src/main.js');
  const root = fakeDocument(), { p } = fakeSketch(), app = mountApp(p, root, { startScreen: 'home' });
  root.getElementById('home-play').click(); root.getElementById('mission-1').click(); p.draw();
  const manager = app.game.missions; manager.act('shelter', 500, 300); root.getElementById('nav-help').click();
  const time = manager.world.time, energy = manager.points.available;
  for (let i = 0; i < 30; i++) p.draw(); assert.equal(manager.world.time, time); assert.equal(manager.points.available, energy);
  assert.equal(manager.actions.enabled, false); root.getElementById('tutorial-close').click();
  assert.equal(manager.actions.enabled, true); p.draw(); assert.ok(manager.world.time > time); app.dispose();
});
