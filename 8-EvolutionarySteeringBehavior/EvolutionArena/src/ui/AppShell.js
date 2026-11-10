import { DisplaySettings } from './DisplaySettings.js';
import { Tutorial } from './Tutorial.js';

const SCREEN_IDS = Object.freeze({ home: 'screen-home', workspace: 'screen-workspace', tutorial: 'screen-tutorial', settings: 'screen-settings' });
const SCREEN_TITLES = Object.freeze({ home: 'home-title', workspace: 'workspace-title', tutorial: 'tutorial-title', settings: 'settings-title' });

export class AppShell {
  constructor(game, root = document, { startScreen = 'home', settings = new DisplaySettings(), onNavigate = () => {}, onSettings = () => {}, onResetProgress = () => {} } = {}) {
    this.game = game;
    this.settings = settings;
    this.tutorial = new Tutorial();
    this.history = [];
    this.onNavigate = onNavigate;
    this.onSettings = onSettings;
    this.elements = Object.fromEntries([
      'app-root', 'home-play', 'home-laboratory', 'home-help', 'home-settings', 'nav-home', 'nav-help', 'nav-settings',
      'tutorial-previous', 'tutorial-next', 'tutorial-restart', 'tutorial-close', 'tutorial-counter', 'tutorial-symbol', 'tutorial-text',
      'settings-back', 'settings-reset', 'progress-reset', 'pref-reduced-motion', 'pref-high-contrast', 'pref-effects', 'pref-quality', 'settings-summary',
      ...Object.values(SCREEN_IDS), ...Object.values(SCREEN_TITLES),
    ].map(id => [id, root.getElementById(id)]));
    this.abortController = new AbortController();
    const bind = (id, fn, event = 'click') => this.elements[id].addEventListener(event, fn, { signal: this.abortController.signal });
    bind('home-play', () => this.enter('survival'));
    bind('home-laboratory', () => this.enter('laboratory'));
    for (const id of ['home-help', 'nav-help']) bind(id, () => this.open('tutorial'));
    for (const id of ['home-settings', 'nav-settings']) bind(id, () => this.open('settings'));
    bind('nav-home', () => this.home());
    bind('settings-back', () => this.back());
    bind('tutorial-close', () => this.back());
    bind('tutorial-previous', () => { this.tutorial.previous(); this.renderTutorial(); });
    bind('tutorial-next', () => {
      if (this.tutorial.index === this.tutorial.total - 1) this.back();
      else { this.tutorial.next(); this.renderTutorial(); }
    });
    bind('tutorial-restart', () => { this.tutorial.restart(); this.renderTutorial(); });
    for (const [id, key] of [['pref-reduced-motion', 'reducedMotion'], ['pref-high-contrast', 'highContrast'], ['pref-effects', 'effects']]) {
      bind(id, () => { this.settings.update({ [key]: this.elements[id].checked }); this.applySettings(); }, 'change');
    }
    bind('pref-quality', () => { this.settings.update({ quality: this.elements['pref-quality'].value }); this.applySettings(); }, 'change');
    bind('settings-reset', () => { this.settings.reset(); this.applySettings(); });
    this.resetArmed = false;
    bind('progress-reset', () => {
      if (!this.resetArmed) {
        this.resetArmed = true;
        this.elements['progress-reset'].textContent = 'Confirmer l’effacement des étoiles';
      } else {
        onResetProgress(); this.resetArmed = false;
        this.elements['progress-reset'].textContent = 'Réinitialiser la progression';
      }
    });
    this.screen = 'home';
    if (['laboratory', 'survival'].includes(startScreen)) { this.game.switchTo(startScreen); this.screen = 'workspace'; }
    else if (Object.hasOwn(SCREEN_IDS, startScreen)) this.screen = startScreen;
    else throw new RangeError('Écran inconnu.');
    this.applySettings();
    this.render(false);
  }

  get isWorkspace() { return this.screen === 'workspace'; }

  enter(mode) {
    this.game.switchTo(mode);
    this.history.length = 0;
    this.screen = 'workspace';
    this.render();
  }

  open(screen) {
    if (!['tutorial', 'settings'].includes(screen)) throw new RangeError('Écran secondaire inconnu.');
    if (this.screen !== screen) {
      this.history.push(this.screen);
      if (this.history.length > 4) this.history.shift();
      this.screen = screen;
    }
    this.render();
  }

  home() { this.history.length = 0; this.screen = 'home'; this.render(); }
  back() { this.screen = this.history.pop() ?? 'home'; this.render(); }

  render(focus = true) {
    this.resetArmed = false;
    this.elements['progress-reset'].textContent = 'Réinitialiser la progression';
    for (const [screen, id] of Object.entries(SCREEN_IDS)) this.elements[id].hidden = screen !== this.screen;
    if (this.game.missions.actions) this.game.missions.actions.enabled = this.isWorkspace
      && this.game.mode === 'survival' && this.game.missions.status === 'running';
    this.renderTutorial();
    this.onNavigate(this.screen);
    if (focus) this.elements[SCREEN_TITLES[this.screen]].focus({ preventScroll: true });
  }

  renderTutorial() {
    const step = this.tutorial.step;
    this.elements['tutorial-title'].textContent = step.title;
    this.elements['tutorial-text'].textContent = step.text;
    this.elements['tutorial-symbol'].textContent = step.symbol;
    this.elements['tutorial-counter'].textContent = `ÉTAPE ${this.tutorial.index + 1} / ${this.tutorial.total}`;
    this.elements['tutorial-previous'].disabled = this.tutorial.index === 0;
    this.elements['tutorial-next'].textContent = this.tutorial.index === this.tutorial.total - 1 ? 'Terminer' : 'Continuer';
  }

  applySettings() {
    const values = this.settings.values;
    this.elements['pref-reduced-motion'].checked = values.reducedMotion;
    this.elements['pref-reduced-motion'].disabled = this.settings.systemReducedMotion;
    this.elements['pref-high-contrast'].checked = values.highContrast;
    this.elements['pref-effects'].checked = values.effects;
    this.elements['pref-quality'].value = values.quality;
    this.elements['app-root'].dataset.motion = values.reducedMotion ? 'reduced' : 'full';
    this.elements['app-root'].dataset.contrast = values.highContrast ? 'high' : 'standard';
    this.elements['app-root'].dataset.effects = values.effects ? 'on' : 'off';
    this.elements['settings-summary'].textContent = `Animations ${values.reducedMotion ? 'réduites' : 'complètes'} · Effets ${values.effects ? 'actifs' : 'désactivés'} · Qualité ${values.quality === 'economy' ? 'économique (30 images/s visées)' : 'standard (60 images/s visées)'}. Aucun réglage physique ou génétique modifié.${this.settings.systemReducedMotion ? ' Réduction des mouvements imposée par la préférence système.' : ''}`;
    this.onSettings(values);
  }

  dispose() { this.abortController.abort(); }
}
