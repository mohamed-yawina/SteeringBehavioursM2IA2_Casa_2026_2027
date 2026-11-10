import { MISSIONS } from '../game/MissionDefinitions.js';
import { ACTIONS } from '../game/PlayerActions.js';
const ACTION_ENTRIES = Object.freeze(Object.entries(ACTIONS));

export class GameInterface {
  constructor(game, root = document, { notifications = null } = {}) {
    this.game = game;
    this.notifications = notifications;
    this.previousStatus = null;
    this.previousWorld = null;
    this.previousMessage = '';
    const ids = ['mode-laboratory', 'mode-survival', 'mission-selection', 'mission-seed', 'game-hud',
      'game-mission', 'game-objective', 'game-time', 'game-population', 'game-generation', 'game-points',
      'game-progress', 'game-message', 'game-effects', 'game-results', 'game-result-title', 'game-result-detail', 'game-stars',
      'game-replay', 'game-next', 'game-selection', 'game-cancel', 'game-star-rules', 'game-selected',
      'laboratory-metrics', 'laboratory-genetics', 'laboratory-settings', 'arena-panel', 'arena-hint',
      'pause', 'reset', 'status', 'extinction', ...MISSIONS.flatMap(m => [`mission-${m.id}`, `mission-${m.id}-progress`]),
      'game-energy', 'game-predators',
      ...ACTION_ENTRIES.flatMap(([key]) => [`action-${key}-state`, `action-${key}-progress`]),
      ...Object.keys(ACTIONS).map(key => `action-${key}`)];
    this.elements = Object.fromEntries(ids.map(id => [id, root.getElementById(id)]));
    this.abortController = new AbortController();
    const options = { signal: this.abortController.signal };
    const bind = (id, fn) => this.elements[id].addEventListener('click', () => {
      try { fn(); } catch (error) { this.game.missions.message = error.message; }
      this.update();
    }, options);
    bind('mode-laboratory', () => game.switchTo('laboratory'));
    bind('mode-survival', () => game.switchTo('survival'));
    this.elements['mission-seed'].value = '2026';
    for (const mission of MISSIONS) bind(`mission-${mission.id}`, () => {
      const value = this.elements['mission-seed'].value;
      if (!value.trim()) throw new Error('Entrez une graine entière.');
      game.missions.start(mission.id, Number(value));
    });
    for (const key of Object.keys(ACTIONS)) bind(`action-${key}`, () => game.missions.arm(key));
    bind('game-replay', () => game.missions.replay());
    bind('game-next', () => game.missions.next());
    bind('game-selection', () => game.missions.showSelection());
    bind('game-cancel', () => { game.missions.armedAction = null; game.missions.message = 'Action annulée, sans dépense.'; });
    this.update();
  }

  text(id, value) {
    const text = String(value);
    if (this.elements[id].textContent !== text) this.elements[id].textContent = text;
  }

  update() {
    const survival = this.game.mode === 'survival';
    const manager = this.game.missions;
    const selecting = manager.status === 'selection';
    for (const id of ['laboratory-metrics', 'laboratory-genetics', 'laboratory-settings']) this.elements[id].hidden = survival;
    this.elements['mission-selection'].hidden = !survival || !selecting;
    this.elements['game-hud'].hidden = !survival || selecting;
    this.elements['arena-panel'].hidden = survival && selecting;
    this.elements['game-results'].hidden = !survival || !['won', 'lost'].includes(manager.status);
    this.elements['mode-laboratory'].setAttribute('aria-pressed', String(!survival));
    this.elements['mode-survival'].setAttribute('aria-pressed', String(survival));
    this.text('arena-hint', survival ? 'Clic : sélectionner · Action armée : cliquer pour placer · Aucun ajout gratuit'
      : 'Clic créature : inspecter · Clic vide : nourriture · Maj + clic : poison');
    for (const mission of MISSIONS) {
      this.elements[`mission-${mission.id}`].disabled = !manager.progress.isUnlocked(mission.id);
      const stars = manager.progress.bestStars.get(mission.id) ?? 0;
      this.text(`mission-${mission.id}-progress`, stars ? `${'★'.repeat(stars)} · Rejouable`
        : manager.progress.isUnlocked(mission.id) ? 'Disponible' : 'Terminer la mission précédente');
    }
    this.text('game-message', manager.message || 'Choisissez une mission et une graine pour démarrer une tentative reproductible.');
    this.elements['game-message'].hidden = !survival;
    if (!survival || selecting || !manager.world) return;
    const { mission, world, points, actions } = manager;
    const stats = world.stats;
    if (manager.status !== this.previousStatus || this.previousWorld !== world) {
      const result = manager.status === 'won' || manager.status === 'lost';
      this.notifications?.push(result ? `${manager.status === 'won' ? 'Victoire' : 'Défaite'} — ${mission.title}` : `Mission ${mission.id} — ${mission.title}`, {
        tone: manager.status === 'won' ? 'success' : manager.status === 'lost' ? 'error' : 'info',
      });
      this.previousStatus = manager.status;
      this.previousWorld = world;
    }
    if (manager.message && manager.message !== this.previousMessage) {
      this.notifications?.push(manager.message, { tone: /insuffisants|refus|Aucun|plafond|récupération/.test(manager.message) ? 'error' : 'info' });
      this.previousMessage = manager.message;
    }
    this.text('game-mission', `MISSION ${mission.id} — ${mission.title}`);
    this.text('game-objective', mission.objective);
    this.text('game-time', `${world.time.toFixed(1)} s / ${mission.deadline} s`);
    this.text('game-population', stats.population);
    this.text('game-generation', stats.maxGeneration);
    this.text('game-points', Math.floor(points.available));
    this.text('game-energy', `${Math.round(stats.meanEnergy * 100)} %`);
    this.text('game-predators', stats.activePredators);
    this.text('game-effects', `Protection : ${Math.max(0, (actions.zone?.expiresAt ?? 0) - world.time).toFixed(1)} s · Abondance : ${Math.max(0, actions.abundanceUntil - world.time).toFixed(1)} s · Régénération : ${points.regeneration} point/s.`);
    const timeProgress = mission.duration ? Math.min(1, world.time / mission.duration) : 1;
    const generationProgress = Math.min(1, stats.maxGeneration / mission.generation);
    const populationProgress = Math.min(1, stats.population / mission.minimumPopulation);
    this.elements['game-progress'].value = Math.min(timeProgress, generationProgress, populationProgress) * 100;
    this.text('game-star-rules', `★ Victoire · +★ au moins ${mission.starPopulation} créatures · +★ dépenses ≤ ${mission.starSpending} points. Score de jeu, pas mesure d’adaptation.`);
    for (const [key, action] of ACTION_ENTRIES) {
      const cooldown = actions.cooldownRemaining(key);
      const reason = actions.availability(key);
      this.elements[`action-${key}`].disabled = reason !== null;
      this.elements[`action-${key}`].title = reason ?? (key === 'abundance' ? 'Déclencher une abondance de 10 s' : 'Choisir puis cliquer dans l’arène');
      this.text(`action-${key}-state`, reason ?? (key === 'abundance' ? 'Disponible · effet immédiat, 10 s' : 'Disponible · choisir une position'));
      this.elements[`action-${key}-progress`].value = Math.max(0, Math.min(100, 100 * (1 - cooldown / action.cooldown)));
      this.elements[`action-${key}`].setAttribute('aria-pressed', String(manager.armedAction === key));
      this.text(`action-${key}`, `${action.label} · ${action.cost} pts · ${cooldown > 0 ? cooldown.toFixed(1) + ' s' : 'prête'}`);
    }
    this.elements['game-cancel'].disabled = !manager.armedAction;
    this.text('pause', world.paused ? 'Reprendre' : 'Pause');
    this.elements.pause.disabled = manager.status !== 'running';
    this.elements.pause.setAttribute('aria-pressed', String(world.paused));
    this.text('reset', 'Rejouer');
    this.text('status', manager.status === 'won' ? 'Victoire' : manager.status === 'lost' ? 'Défaite'
      : world.paused ? 'Survie en pause' : 'Survie active');
    this.elements.extinction.hidden = true; // le panneau de résultat exprime la défaite
    const selected = world.selectedCreature;
    this.text('game-selected', selected ? `${selected.id} · G${selected.generation} · ${selected.age.toFixed(1)} s · énergie ${selected.energy.toFixed(2)} · ADN [${selected.dna.genes.map(g => g.toFixed(2)).join(', ')}]` : 'Cliquez sur une créature pour l’inspecter.');
    if (manager.result) {
      this.elements['game-results'].dataset.result = manager.status;
      this.text('game-result-title', manager.status === 'won' ? 'Écosystème préservé — Victoire' : 'Mission terminée — Défaite');
      this.text('game-result-detail', `${manager.result.reason} ${stats.population} créatures · G${stats.maxGeneration} · ${world.time.toFixed(1)} s · ${points.spent} points dépensés.`);
      this.text('game-stars', '★'.repeat(manager.result.stars) + '☆'.repeat(3 - manager.result.stars));
      this.elements['game-stars'].setAttribute('aria-label', `${manager.result.stars} étoiles sur 3`);
      this.elements['game-next'].disabled = manager.status !== 'won' || manager.progress.nextId(mission.id) === null;
    }
  }

  dispose() { this.abortController.abort(); }
}
