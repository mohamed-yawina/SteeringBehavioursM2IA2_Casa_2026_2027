import { Simulation } from './simulation/Simulation.js';
import { Interface } from './ui/Interface.js';
import { ArenaRenderer } from './ui/ArenaRenderer.js';
import { GameMode } from './game/GameMode.js';
import { GameInterface } from './ui/GameInterface.js';
import { GameRenderer } from './ui/GameRenderer.js';
import { DisplaySettings } from './ui/DisplaySettings.js';
import { AppShell } from './ui/AppShell.js';
import { NotificationCenter } from './ui/NotificationCenter.js';
import { ScienceInterface } from './ui/ScienceInterface.js';
import { LocalPreferences, browserStorage } from './persistence/LocalPreferences.js';

// Seuls les callbacks requis par le mode global de p5 sont exposés.
export function mountApp(sketch = window, root = document, { startScreen = 'laboratory', systemReducedMotion } = {}) {
  const world = new Simulation();
  const game = new GameMode(world);
  const persistence = new LocalPreferences(browserStorage(sketch));
  const saved = persistence.load();
  const storageWarning = persistence.message;
  game.missions.progress.bestStars = new Map(saved.stars);
  const display = new DisplaySettings({ systemReducedMotion: systemReducedMotion
    ?? sketch.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false });
  display.update(saved.display);
  const notifications = new NotificationCenter(root);
  let gameUI;
  const ui = new Interface(world, root, {
    onPause: () => {
      if (game.mode === 'survival') { game.missions.togglePause(); gameUI.update(); }
      else { world.togglePause(); ui.update(); }
    },
    onReset: () => {
      if (game.mode === 'survival') { game.missions.replay(); gameUI.update(); }
      else { world.reset(); ui.update(); }
    },
  });
  ui.elements.perception.checked = saved.preferences.perception;
  ui.elements['predator-debug'].checked = saved.preferences.predatorDebug;
  const preferenceEvents = new AbortController();
  const persist = () => {
    persistence.save({ version: 1, stars: [...game.missions.progress.bestStars], display: display.values,
      preferences: { perception: ui.showPerception, predatorDebug: ui.showPredatorDebug } });
    const status = root.getElementById('persistence-status');
    if (status) status.textContent = persistence.message;
  };
  game.missions.progress.onChange = persist;
  for (const element of [ui.elements.perception, ui.elements['predator-debug']]) {
    element.addEventListener('change', persist, { signal: preferenceEvents.signal });
  }
  gameUI = new GameInterface(game, root, { notifications });
  const science = new ScienceInterface(world, root, { onReplay: () => ui.syncControls(),
    onNotice: text => notifications.push(text), pixelRatio: sketch.devicePixelRatio || 1 });
  const host = root.getElementById('arena');
  const size = () => Math.max(1, Math.floor(host.clientWidth));
  const canvas = sketch.createCanvas(size(), size() * world.height / world.width);
  canvas.parent(host);
  canvas.elt.setAttribute('aria-label', 'Arène : créatures par génération, nourriture verte, poison rose et prédateurs rouge orangé');
  const renderer = new ArenaRenderer(world, sketch, display);
  const effectsRenderer = new GameRenderer(sketch, display);
  let hudElapsed = 0;
  let scienceElapsed = 0;
  const pauseButton = root.getElementById('pause');
  const arenaPanel = root.getElementById('arena-panel');
  const shell = new AppShell(game, root, { startScreen, settings: display,
    onResetProgress: () => {
      game.missions.showSelection(); game.missions.progress.reset(); gameUI.update();
      notifications.push('Progression effacée. Les paramètres et le Laboratoire sont conservés.');
    },
    onNavigate: () => {
      if (game.mode === 'laboratory') { pauseButton.disabled = false; ui.update(); science.update(true); }
      gameUI.update();
    },
    onSettings: values => {
      sketch.pixelDensity(values.quality === 'economy' ? 1 : Math.min(sketch.devicePixelRatio || 1, 2));
      sketch.frameRate(values.quality === 'economy' ? 30 : 60);
      persist();
    },
  });
  if (storageWarning) {
    notifications.push(storageWarning);
    const status = root.getElementById('persistence-status');
    if (status) status.textContent = storageWarning;
  }
  sketch.draw = () => {
    const elapsed = Number.isFinite(sketch.deltaTime) ? Math.max(0, sketch.deltaTime / 1000) : 0;
    if (shell.isWorkspace) {
      const active = game.activeWorld ?? world;
      const width = Math.floor(host.clientWidth);
      const height = width * active.height / active.width;
      if (width > 0 && (width !== sketch.width || Math.abs(height - sketch.height) > 0.5)) sketch.resizeCanvas(width, height);
      game.advance(elapsed);
      if (game.mode === 'laboratory') {
        scienceElapsed += elapsed;
        if (scienceElapsed >= 1 - 1e-9) { science.update(); scienceElapsed = 0; }
      }
      renderer.simulation = active;
      if (!arenaPanel.hidden) {
        renderer.draw(ui.showPerception, ui.showPredatorDebug);
        if (game.mode === 'survival') effectsRenderer.draw(game.missions);
      }
    }
    // Le rendu reste fluide, les grands panneaux DOM sont actualisés à 10 Hz.
    hudElapsed += elapsed;
    if (hudElapsed + 1e-9 >= 0.1) {
      notifications.advance(hudElapsed);
      if (shell.isWorkspace) {
        if (game.mode === 'laboratory') { pauseButton.disabled = false; ui.update(); }
        gameUI.update();
      }
      hudElapsed = 0;
    }
  };
  sketch.windowResized = () => {
    const active = game.activeWorld ?? world;
    sketch.resizeCanvas(size(), size() * active.height / active.width);
    if (shell.isWorkspace && game.mode === 'laboratory') science.update(true);
  };
  sketch.mousePressed = event => {
    if (!shell.isWorkspace) return;
    if (event?.target !== canvas.elt) return;
    if (sketch.mouseX < 0 || sketch.mouseY < 0 || sketch.mouseX > sketch.width || sketch.mouseY > sketch.height) return;
    const active = game.activeWorld ?? world;
    const x = sketch.mouseX * active.width / sketch.width;
    const y = sketch.mouseY * active.height / sketch.height;
    if (game.mode === 'survival') { game.missions.click(x, y); gameUI.update(); return; }
    // La sélection ne change aucune force et reste possible pendant la pause.
    const selected = event.shiftKey ? null : world.selectAt(x, y);
    if (selected) notifications.push(`${selected.id} sélectionnée · génération ${selected.generation}.`);
    if (!selected && !world.paused && world.addResource(event.shiftKey ? 'poison' : 'food', x, y)) {
      world.interventions++;
      notifications.push(event.shiftKey ? 'Poison ajouté au laboratoire.' : 'Nourriture ajoutée au laboratoire.');
    }
    ui.update();
  };
  return { world, ui, renderer, game, gameUI, shell, display, notifications, science, persistence,
    dispose: () => { preferenceEvents.abort(); game.missions.progress.onChange = () => {}; ui.dispose(); gameUI.dispose(); shell.dispose(); notifications.dispose(); science.dispose(); },
  };
}

// Le point d'entrée navigateur ouvre l'accueil ; mountApp conserve son défaut
// Laboratoire pour les intégrations et les tests historiques.
window.setup = () => mountApp(window, document, { startScreen: 'home' });
