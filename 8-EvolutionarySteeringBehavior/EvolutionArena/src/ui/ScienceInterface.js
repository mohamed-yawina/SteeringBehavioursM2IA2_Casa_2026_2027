import { configurationOf, comparisonProfiles, ExperimentStore, restartExperiment, snapshotExperiment } from '../science/Experiments.js';
import { experimentCSV, downloadCSV } from '../science/CSVExport.js';
import { TimeSeriesCharts, CHARTS } from './TimeSeriesCharts.js';

export class ScienceInterface {
  constructor(world, root = document, { onReplay = () => {}, onNotice = () => {}, download = downloadCSV, pixelRatio = 1 } = {}) {
    this.world = world;
    this.root = root;
    this.store = new ExperimentStore(4);
    this.charts = new TimeSeriesCharts(root, pixelRatio);
    this.onReplay = onReplay; this.onNotice = onNotice; this.download = download;
    this.lastMetrics = null; this.lastVersion = -1;
    const ids = ['science-profile', 'science-seed', 'science-apply', 'science-save', 'science-label', 'science-export', 'science-status',
      'science-current-seed', 'science-timeline', 'science-diversity', 'science-lifespan', 'science-food', 'science-poison', 'science-predation',
      ...CHARTS.map(chart => chart.id),
      ...[0, 1, 2, 3].flatMap(i => [`min-gene-${i}`, `max-gene-${i}`]),
      ...[0, 1, 2, 3].flatMap(i => ['row', 'label', 'config', 'duration', 'pop', 'generation', 'diversity', 'replay', 'export'].map(field => `experiment-${field}-${i}`))];
    this.elements = Object.fromEntries(ids.map(id => [id, root.getElementById(id)]));
    this.abortController = new AbortController();
    const bind = (id, action) => this.elements[id].addEventListener('click', () => {
      try { action(); } catch (error) { this.message(error.message); }
    }, { signal: this.abortController.signal });
    this.elements['science-label'].value = 'Expérience';
    this.elements['science-profile'].value = 'arena-p0-m1';
    bind('science-apply', () => {
      const seedText = this.elements['science-seed'].value;
      if (!seedText.trim()) throw new Error('Entrez une graine entière.');
      const base = configurationOf(world); base.seed = Number(seedText);
      const profile = comparisonProfiles(base).find(item => item.id === this.elements['science-profile'].value);
      if (!profile) throw new Error('Profil scientifique inconnu.');
      restartExperiment(world, profile.configuration);
      this.onReplay(); this.update(true);
      this.message(`Profil ${profile.label} relancé avec la graine ${world.seed}. Pensez à enregistrer la trace avant de redémarrer.`);
    });
    bind('science-save', () => {
      const record = this.store.save(world, this.elements['science-label'].value);
      this.renderRecords();
      this.message(`${record.id} conservée en mémoire. Quatre traces maximum ; la plus ancienne est remplacée à la cinquième.`);
    });
    bind('science-export', () => this.exportRecord(snapshotExperiment(world, this.elements['science-label'].value, 'live')));
    for (let index = 0; index < 4; index++) {
      bind(`experiment-replay-${index}`, () => {
        const record = this.store.records[index];
        if (!record?.replayable) throw new Error('Cette configuration utilise un générateur ou des extensions non sérialisables.');
        restartExperiment(world, record.finalConfiguration);
        this.onReplay(); this.update(true);
        this.message(`Paramètres finaux de ${record.id} remis au départ. Les interventions manuelles ne sont pas rejouées.`);
      });
      bind(`experiment-export-${index}`, () => {
        const record = this.store.records[index]; if (record) this.exportRecord(record);
      });
    }
    this.update(true); this.renderRecords();
  }

  text(id, value) { const text = String(value); if (this.elements[id].textContent !== text) this.elements[id].textContent = text; }
  message(text) { this.text('science-status', text); this.onNotice(text); }
  exportRecord(record) { this.download(experimentCSV(record), `evolution-arena-${record.id}.csv`, this.root); this.message(`CSV ${record.id} préparé avec paramètres, historique et limites de reproduction.`); }

  update(force = false) {
    const metrics = this.world.metrics;
    this.charts.update(metrics, force);
    if (!force && this.lastMetrics === metrics && this.lastVersion === metrics.totalSamples) return;
    if (this.lastMetrics !== metrics) this.elements['science-seed'].value = String(this.world.seed);
    this.lastMetrics = metrics; this.lastVersion = metrics.totalSamples;
    const sample = metrics.history.at(-1);
    this.text('science-current-seed', this.world.seed);
    this.text('science-timeline', `${metrics.history.length}/${metrics.maxSamples} points · dernier échantillon ${sample.time.toFixed(1)} s · ${sample.mode} · prédateurs ${sample.predationEnabled ? 'actifs' : 'inactifs'} · mutation ${(sample.settings.mutationRate * 100).toFixed(1)} % · ${metrics.droppedSamples} retirés · ${sample.interventions} intervention(s)`);
    this.text('science-diversity', sample.diversity === null ? '— (population vide)' : sample.diversity.toFixed(5));
    this.text('science-lifespan', sample.completedLives ? `${sample.meanLifespan.toFixed(2)} s (${sample.completedLives} décès)` : '— (aucune vie terminée)');
    this.text('science-food', sample.foodConsumed); this.text('science-poison', sample.poisonConsumed); this.text('science-predation', sample.predationDeaths);
    for (let index = 0; index < 4; index++) {
      this.text(`min-gene-${index}`, sample.geneMin[index] === null ? '—' : sample.geneMin[index].toFixed(2));
      this.text(`max-gene-${index}`, sample.geneMax[index] === null ? '—' : sample.geneMax[index].toFixed(2));
    }
  }

  renderRecords() {
    for (let index = 0; index < 4; index++) {
      const record = this.store.records[index]; this.elements[`experiment-row-${index}`].hidden = !record;
      if (!record) continue;
      const config = record.finalConfiguration;
      this.text(`experiment-label-${index}`, `${record.id} · ${record.label} · graine ${config.seed}`);
      this.text(`experiment-config-${index}`, `${config.evolution.mode} · prédateurs ${config.predation.enabled ? 'oui' : 'non'} · mutation ${config.evolution.mutationRate} · ${record.current.interventions} interventions · ${record.droppedSamples} points perdus`);
      this.text(`experiment-duration-${index}`, `${record.current.time.toFixed(1)} s`);
      this.text(`experiment-pop-${index}`, record.current.population);
      this.text(`experiment-generation-${index}`, record.current.maxGeneration);
      this.text(`experiment-diversity-${index}`, record.current.diversity === null ? '—' : record.current.diversity.toFixed(5));
      this.elements[`experiment-replay-${index}`].disabled = !record.replayable;
    }
  }

  dispose() { this.abortController.abort(); }
}
