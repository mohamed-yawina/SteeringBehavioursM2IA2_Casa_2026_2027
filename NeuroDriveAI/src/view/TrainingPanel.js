import { EvolutionEngine } from '../evolution/EvolutionEngine.js';
import { geneticDiversity } from '../evolution/EvolutionStatistics.js';
import { STRATEGIES,strategyLabel } from '../experiments/Strategies.js';
import {TRACKS,createRegisteredTrack} from '../track/TrackRegistry.js';

export class TrainingPanel {
  constructor(simulation, keyboard, clock, root = document) {
    this.simulation = simulation; this.keyboard = keyboard; this.clock = clock; this.root = root;
    this.startButton = root.querySelector('#train-start');
    this.engine = null;
    if (!this.startButton) return;
    this.mode = root.querySelector('#drive-mode');
    this.status = root.querySelector('#training-status');
    this.stats = root.querySelector('#training-stats');
    this.history = root.querySelector('#training-history');
    root.querySelector('#training-strategy')?.addEventListener('change',event=>{
      const preset=STRATEGIES[event.currentTarget.value];if(!preset)return;
      root.querySelector('#training-selection').value=preset.selection;
      root.querySelector('#training-elites').value=String(Math.min(preset.eliteCount,Number(root.querySelector('#training-population').value)));
      const adaptive=root.querySelector('#training-adaptive');if(adaptive)adaptive.checked=preset.adaptiveMutation;
      const immigrants=root.querySelector('#training-immigrants');if(immigrants)immigrants.value='0';
      this.status.textContent='Préréglage choisi. Démarrer un nouvel essai pour appliquer ces paramètres.';
    });
    this.startButton.addEventListener('click', () => this.perform(() => this.initialize(true)));
    root.querySelector('#train-reset').addEventListener('click', () => this.perform(() => this.initialize(false)));
    root.querySelector('#train-pause').addEventListener('click', () => this.setPaused(true));
    root.querySelector('#train-resume').addEventListener('click', () => this.perform(() => {
      if (!this.engine) throw new Error('Démarrer un essai au préalable');
      this.setPaused(false);
    }));
    root.querySelector('#export-best').addEventListener('click', () => this.perform(() => {
      if (!this.engine) throw new Error('Aucun meilleur réseau');
      const field = root.querySelector('#network-json'); field.value = this.engine.exportBest(); field.focus(); field.select();
    }, 'Meilleur réseau exporté dans le champ JSON du panneau neuronal.'));
    root.querySelector('#import-best').addEventListener('click', () => this.perform(() => {
      const engine = this.engine ?? new EvolutionEngine(this.readConfig(), simulation.track);
      engine.importBest(root.querySelector('#network-json').value); this.engine = engine;
    }, 'Réseau importé en archive, fitness inconnue. Utiliser en autonome pour le tester.'));
    root.querySelector('#use-best').addEventListener('click', () => this.perform(() => {
      if (!this.engine?.best) throw new Error('Aucun meilleur réseau');
      simulation.setNetwork(this.engine.best.genome.toNetwork()); simulation.setMode('autonomous'); simulation.reset();
      this.engine.pause(); this.mode.value = 'autonomous';
      root.querySelector('#network-seed').value = String(simulation.neuralController.network.seed);
      root.querySelector('#network-status').textContent = 'Réseau de l’archive chargé. Les poids effectifs sont conservés ; la graine indique une origine, pas une recette pour reconstruire un génome évolué.';
      this.clearControls();
    }, 'Meilleur réseau chargé en mode autonome au départ.'));
    this.mode.addEventListener('change', () => { this.engine?.pause(); });
  }
  get isSelected() { return ['training','multi-training'].includes(this.mode?.value); }
  get paused() { return !this.engine?.running || this.engine.paused; }
  get speed() {
    const value = Number(this.root.querySelector('#training-speed')?.value ?? 1);
    return Number.isInteger(value) && value >= 1 && value <= 10 ? value : 1;
  }
  readConfig() {
    const read = id => {
      const text = this.root.querySelector(id).value.trim();
      if (!text) throw new Error(`Champ requis : ${id}`);
      return Number(text);
    };
    const optional=(id,fallback)=>this.root.querySelector(id)?read(id):fallback;
    return { populationSize: read('#training-population'), seed: read('#training-seed'),
      selection: this.root.querySelector('#training-selection').value,
      fitness: this.root.querySelector('#training-fitness').value,
      mutationRate: read('#training-mutation'), mutationAmplitude: read('#training-amplitude'),
      eliteCount: read('#training-elites'), maxDuration: read('#training-duration'),
      stagnationTime: read('#training-stagnation'), tournamentSize: read('#training-tournament'),
      adaptiveMutation:this.root.querySelector('#training-adaptive')?.checked??false,
      minMutationRate:optional('#training-min-rate',.02),maxMutationRate:optional('#training-max-rate',.3),
      mutationPatience:optional('#training-patience',2),diversityThreshold:optional('#training-diversity',.25),
      immigrantFraction:optional('#training-immigrants',0) };
  }
  clearControls() { this.keyboard.clear(); this.clock.reset(); }
  initialize(start) {
    const multi=this.mode.value==='multi-training'||(this.root.querySelector('#multi-enabled')?.checked??false);
    const tracks=multi?TRACKS.filter(t=>this.root.querySelector('#train-track-'+t.id)?.checked).map(t=>createRegisteredTrack(t.id)):null;
    if(multi&&tracks.length<2)throw new Error('Sélectionner au moins deux circuits d’entraînement');
    const config=this.readConfig();if(multi)config.fitness='normalized';
    const candidate = new EvolutionEngine(config,tracks?.[0]??this.simulation.track,tracks);
    if (start) candidate.start();
    this.engine = candidate; this.mode.value = multi?'multi-training':'training'; this.clearControls();
  }
  reset() { this.perform(() => this.initialize(false)); }
  setPaused(paused) {
    if (!this.engine) return;
    if (paused) this.engine.pause(); else { this.mode.value = this.engine.trainingTrackIds.length>1?'multi-training':'training'; this.engine.resume(); }
    this.clearControls();
  }
  perform(action, message = 'Paramètres appliqués au nouvel essai. Historique et archive réinitialisés.') {
    try { action(); this.status.textContent = message; }
    catch (error) { this.status.textContent = `Erreur : ${error.message}`; }
  }
  step(dt) {
    if (!this.engine) return;
    for (let i = 0; i < this.speed; i++) this.engine.step(dt);
  }
  render(now=performance.now()) {
    if (!this.startButton || !this.engine) return;
    const key=`${this.engine.generation}:${this.engine.phase}:${this.paused}`;
    if(this.renderedEngine===this.engine&&this.renderedKey===key&&now-(this.renderedAt??-Infinity)<100)return;
    this.renderedEngine=this.engine;this.renderedKey=key;this.renderedAt=now;
    const e = this.engine, leader = e.leader, individuals = e.population.individuals;
    const max = leader?.fitness ?? 0;
    const mean = max > 0 ? max * Math.min(1, individuals.reduce((n,i) => n+i.fitness/max,0)/individuals.length) : 0;
    const diagnostics=this.root.querySelector('#training-diagnostics');
    if(diagnostics)diagnostics.textContent=`Stratégie ${strategyLabel(e.config)} · Élites : ${e.config.eliteCount} · Mutation actuelle : ${e.currentMutationRate.toFixed(3)} (prochaine : ${(e.adaptation?.rate??e.currentMutationRate).toFixed(3)})\nDiversité RMS : ${geneticDiversity(individuals).toFixed(4)} · Seuil : ${e.config.diversityThreshold} · Générations sans progrès significatif : ${e.adaptation?.stagnantGenerations??0}\nProgression du leader : ${(leader?.progression??0).toFixed(3)} secteurs · Tours terminés cumulés (épisodes) : ${e.history.reduce((n,s)=>n+s.laps,0)} · Nouveaux génomes : ${e.immigrants}`;
    const number = n => n > 1e8 ? n.toExponential(3) : n.toFixed(2);
    const perTrack=this.root.querySelector('#training-per-track');if(perTrack)perTrack.textContent=`Entraînement : ${e.trainingTrackIds.join(', ')}\n`+(leader?.perTrack??[]).map(r=>`${r.trackId} : CP ${r.checkpoints}, tours ${r.laps}, score normalisé ${r.score.toFixed(3)}`).join('\n');
    this.stats.textContent = `Génération : ${e.generation} · Population : ${individuals.length} · Actives : ${e.population.activeCount}\nFitness max : ${number(max)} · Moyenne : ${number(mean)} · Archive : ${e.best?.fitness == null ? (e.best ? 'importée, non évaluée' : '—') : number(e.best.fitness)}\nCheckpoints du leader : ${leader?.checkpoints ?? 0} · Tours du leader : ${leader?.simulation.checkpoints.laps ?? 0} · Tours population : ${individuals.reduce((n,i)=>n+i.simulation.checkpoints.laps,0)}\nTemps : ${e.elapsed.toFixed(2)} / ${e.config.maxDuration} s simulées · Sélection : ${e.config.selection} · Mutation : ${e.currentMutationRate.toFixed(3)} (base ${e.config.mutationRate}, amplitude ${e.config.mutationAmplitude})\nFitness : ${e.config.fitness} · État : ${this.paused ? 'Pause / prêt' : e.phase === 'completed' ? 'Génération évaluée' : 'Simulation'}`;
    this.history.textContent = 'Gén. | max | moyenne | voitures avec CP | tours | collisions | diversité\n' +
      e.history.slice(-20).map(s => `${s.generation} | ${number(s.maxFitness)} | ${number(s.meanFitness)} | ${s.progressingCars} | ${s.laps} | ${s.collisions} | ${s.diversity.toFixed(4)}`).join('\n');
  }
}
