export const EVOLUTION_CONTROLS = Object.freeze([
  ['mutation-rate', 'mutationRate'], ['mutation-amplitude', 'mutationAmplitude'],
  ['energy-threshold', 'energyThreshold'], ['energy-cost', 'energyCost'],
  ['min-age', 'minAge'], ['max-population', 'maxPopulation'], ['cooldown', 'cooldown'],
]);

export const PREDATION_CONTROLS = Object.freeze([
  ['predator-count', 'count'], ['predator-speed', 'speed'],
  ['predator-perception', 'perceptionRadius'], ['predator-capture', 'captureRadius'],
  ['evade-weight', 'evadeWeight'], ['food-weight', 'foodWeight'], ['poison-weight', 'poisonWeight'],
]);

export class Interface {
  constructor(simulation, root = document, controls = {}) {
    this.simulation = simulation;
    this.elements = Object.fromEntries([
      'population', 'food-count', 'poison-count', 'sim-time', 'mean-energy',
      'pause', 'reset', 'perception', 'status', 'extinction',
      'births', 'deaths', 'max-generation', 'mean-age', 'reproduction-mode', 'seed', 'seed-reset',
      'control-message', 'inspector-title', 'inspector-detail', 'mode-description',
      'mean-lifespan', 'mean-offspring', 'food-rate', 'poison-rate', 'mutation-count', 'experiment-status',
      'predators-enabled', 'predator-debug', 'add-predator', 'remove-predator',
      'active-predators', 'captures', 'attacks', 'predation-deaths', 'predation-survival', 'predator-status',
      ...PREDATION_CONTROLS.flatMap(([id]) => [id, `${id}-value`]),
      ...EVOLUTION_CONTROLS.flatMap(([id]) => [id, `${id}-value`]),
      ...Array.from({ length: 4 }, (_, i) => [`mean-gene-${i}`, `sd-gene-${i}`, `initial-gene-${i}`]).flat(),
    ].map(id => [id, root.getElementById(id)]));
    this.abortController = new AbortController();
    const options = { signal: this.abortController.signal };
    this.elements.pause.addEventListener('click', () => {
      if (controls.onPause) { controls.onPause(); return; }
      simulation.togglePause();
      this.update();
    }, options);
    this.elements.reset.addEventListener('click', () => {
      if (controls.onReset) { controls.onReset(); return; }
      simulation.reset();
      this.update();
    }, options);
    for (const [id, key] of EVOLUTION_CONTROLS) {
      this.elements[id].value = String(simulation.evolution[key]);
      this.elements[id].addEventListener('input', () => {
        simulation.configureEvolution({ [key]: Number(this.elements[id].value) });
        this.update();
      }, options);
    }
    this.elements['reproduction-mode'].value = simulation.evolution.mode;
    this.elements['reproduction-mode'].addEventListener('change', () => {
      simulation.configureEvolution({ mode: this.elements['reproduction-mode'].value });
      this.update();
    }, options);
    this.elements.seed.value = String(simulation.seed);
    this.elements['seed-reset'].addEventListener('click', () => {
      try {
        if (!this.elements.seed.value.trim()) throw new Error('Entrez une graine entière.');
        simulation.setSeed(Number(this.elements.seed.value));
        this.setText('control-message', 'Expérience réinitialisée avec cette graine et les paramètres courants.');
      } catch (error) { this.setText('control-message', error.message); }
      this.update();
    }, options);
    this.elements['predators-enabled'].checked = simulation.predation.enabled;
    this.elements['predators-enabled'].addEventListener('change', () => {
      simulation.configurePredation({ enabled: this.elements['predators-enabled'].checked });
      this.update();
    }, options);
    for (const [id, key] of PREDATION_CONTROLS) {
      this.elements[id].addEventListener('input', () => {
        simulation.configurePredation({ [key]: Number(this.elements[id].value) });
        this.update();
      }, options);
    }
    this.elements['add-predator'].addEventListener('click', () => { simulation.addPredator(); this.update(); }, options);
    this.elements['remove-predator'].addEventListener('click', () => { simulation.removePredator(); this.update(); }, options);
    this.update();
  }

  get showPerception() { return this.elements.perception.checked; }
  get showPredatorDebug() { return this.elements['predator-debug'].checked; }

  syncControls() {
    this.elements.seed.value = String(this.simulation.seed);
    this.elements['reproduction-mode'].value = this.simulation.evolution.mode;
    for (const [id, key] of EVOLUTION_CONTROLS) this.elements[id].value = String(this.simulation.evolution[key]);
    this.update();
  }

  setText(id, value) {
    const text = String(value);
    // Évite de réécrire les mêmes nœuds à chaque image, notamment le statut ARIA.
    if (this.elements[id].textContent !== text) this.elements[id].textContent = text;
  }

  update() {
    const stats = this.simulation.stats;
    this.setText('population', String(stats.population).padStart(2, '0'));
    this.setText('food-count', stats.food);
    this.setText('poison-count', stats.poison);
    const seconds = Math.floor(stats.time);
    this.setText('sim-time', `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
    this.setText('mean-energy', `${Math.round(stats.meanEnergy * 100)} %`);
    this.setText('pause', stats.paused ? 'Reprendre' : 'Pause');
    this.elements.pause.setAttribute('aria-pressed', String(stats.paused));
    this.setText('status', stats.population === 0 ? 'Population éteinte' : stats.paused ? 'Simulation en pause' : 'Simulation active');
    this.elements.status.dataset.state = stats.paused || stats.population === 0 ? 'idle' : 'live';
    this.elements.extinction.hidden = stats.population > 0;
    const predation = this.simulation.predation;
    this.elements['predators-enabled'].checked = predation.enabled;
    for (const [id, key] of PREDATION_CONTROLS) {
      this.elements[id].value = String(predation[key]);
      this.setText(`${id}-value`, predation[key]);
    }
    this.elements['add-predator'].disabled = this.simulation.predators.length >= 8;
    this.elements['remove-predator'].disabled = this.simulation.predators.length === 0;
    this.setText('active-predators', stats.activePredators);
    this.setText('captures', stats.captures);
    this.setText('attacks', stats.attacks);
    this.setText('predation-deaths', stats.predationDeaths);
    this.setText('predation-survival', `${stats.meanLifespan.toFixed(1)} s`);
    this.setText('predator-status', `${predation.enabled ? 'Prédation active' : 'Témoin sans prédation'} · ${this.simulation.predators.length} présents / ${predation.count} demandés · ${stats.predatorsStarved} morts de faim. Attaques = poursuites engagées. Survie = moyenne des vies terminées, toutes causes.`);
    this.setText('births', stats.births);
    this.setText('deaths', stats.deaths);
    this.setText('max-generation', stats.maxGeneration);
    this.setText('mean-age', `${stats.meanAge.toFixed(1)} s`);
    for (const [id, key] of EVOLUTION_CONTROLS) {
      this.setText(`${id}-value`, key === 'mutationRate' ? `${(this.simulation.evolution[key] * 100).toFixed(1)} %`
        : key === 'mutationAmplitude' ? `×${this.simulation.evolution[key].toFixed(2)}` : this.simulation.evolution[key]);
      this.elements[id].disabled = this.simulation.evolution.mode !== 'arena'
        && ['energyThreshold', 'energyCost', 'minAge', 'cooldown'].includes(key);
    }
    const genetics = this.simulation.metrics.history.at(-1) ?? stats;
    for (let i = 0; i < 4; i++) {
      this.setText(`mean-gene-${i}`, genetics.population ? genetics.meanGenes[i].toFixed(2) : '—');
      this.setText(`sd-gene-${i}`, genetics.population ? Math.sqrt(genetics.geneVariance[i]).toFixed(2) : '—');
      this.setText(`initial-gene-${i}`, this.simulation.initialMeanGenes[i].toFixed(2));
    }
    this.setText('mean-lifespan', `${stats.meanLifespan.toFixed(1)} s (${stats.completedLives} vies terminées)`);
    this.setText('mean-offspring', stats.meanLifetimeOffspring.toFixed(2));
    this.setText('food-rate', stats.foodPerCreatureSecond.toFixed(3));
    this.setText('poison-rate', stats.poisonPerCreatureSecond.toFixed(3));
    this.setText('mutation-count', stats.mutatedGenes);
    this.setText('experiment-status', `${stats.interventions} intervention(s) · ${this.simulation.metrics.history.length} échantillons · plafond atteint ${stats.capSeconds.toFixed(1)} s`);
    this.setText('mode-description', stats.mode === 'tp'
      ? 'TP comparable : 0,2 % par pas, sans âge minimal, coût ou délai. Enfant à énergie 1. Bornes ADN et vivants uniquement conservés.'
      : stats.mode === 'off' ? 'Témoin sans reproduction. Les créatures continuent à se nourrir, se déplacer et mourir.'
        : 'Arena : 0,2 % par pas admissible. Âge, énergie et délai requis. Le coût est transféré à l’enfant.');
    const selected = this.simulation.selectedCreature;
    this.setText('inspector-title', selected ? `${selected.id} · Génération ${selected.generation}`
      : this.simulation.selectedId ? `${this.simulation.selectedId} · décédée` : 'Sélectionnez une créature');
    this.setText('inspector-detail', selected
      ? `Parent : ${selected.parentId ?? 'fondateur'}\nÂge : ${selected.age.toFixed(1)} s\nÉnergie : ${selected.energy.toFixed(3)} / ${selected.maxEnergy}\nEnfants directs : ${selected.offspringCount}\nADN : [${selected.dna.genes.map(g => g.toFixed(2)).join(', ')}]`
      : 'Clic sur une créature, même en pause.\nLes descendants portent leur génération réelle.');
  }

  dispose() { this.abortController.abort(); }
}
