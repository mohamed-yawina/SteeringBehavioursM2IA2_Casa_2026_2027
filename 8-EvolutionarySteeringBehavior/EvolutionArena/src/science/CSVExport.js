import { GENE_LIMITS } from '../core/DNA.js';
import { finiteTree } from './Experiments.js';

export function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' && !Number.isFinite(value)) throw new RangeError('Valeur CSV non finie.');
  // Les nombres négatifs restent numériques ; seuls les textes sont protégés
  // contre une interprétation comme formule dans les tableurs.
  let text = String(value);
  if (typeof value === 'string' && /^[\s]*[=+@-]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function makeCSV(headers, rows) {
  return '\uFEFF' + [headers, ...rows].map(row => row.map(csvCell).join(',')).join('\r\n') + '\r\n';
}

export function experimentCSV(record) {
  finiteTree(record);
  const metadata = ['schema', 'model_version', 'runtime', 'diversity_definition', 'experiment_id', 'label', 'seed', 'initial_configuration_json', 'final_configuration_json',
    'fixed_step_s', 'sample_interval_s', 'history_limit', 'total_regular_and_event_samples', 'terminal_photo_added', 'dropped_samples', 'retained_start_s', 'limitations_json'];
  const fields = ['sample_index', 'sample_type', 'time_s', 'population', 'births', 'deaths', 'max_generation', 'mean_energy', 'mean_age_s',
    'completed_lives', 'mean_lifespan_dead_s', 'food_consumed', 'poison_consumed', 'active_predators', 'attacks',
    'captures', 'predation_deaths', 'diversity', 'interventions', 'evolution_json', 'predation_json', 'environment_json'];
  const geneFields = GENE_LIMITS.flatMap(g => ['mean', 'min', 'max', 'sd', 'variance'].map(stat => `${g.name}_${stat}`));
  const meta = [record.schema, record.modelVersion, record.runtime, record.diversityDefinition, record.id, record.label, record.initialConfiguration.seed,
    JSON.stringify(record.initialConfiguration), JSON.stringify(record.finalConfiguration), record.fixedStep,
    record.sampleIntervalSeconds, record.historyLimit, record.totalSamples, record.terminalPhotoAdded,
    record.droppedSamples, record.startTimeRetained, JSON.stringify(record.limitations)];
  const rows = record.history.map(sample => {
    const row = [sample.sampleIndex, sample.sampleType, sample.time, sample.population, sample.births, sample.deaths, sample.maxGeneration,
      sample.population ? sample.meanEnergy : null, sample.population ? sample.meanAge : null,
      sample.completedLives, sample.completedLives ? sample.meanLifespan : null, sample.foodConsumed, sample.poisonConsumed,
      sample.activePredators, sample.attacks, sample.captures, sample.predationDeaths, sample.diversity,
      sample.interventions, JSON.stringify(sample.settings), JSON.stringify(sample.predation), JSON.stringify(sample.environment)];
    for (let i = 0; i < 4; i++) row.push(sample.population ? sample.meanGenes[i] : null,
      sample.geneMin[i], sample.geneMax[i], sample.geneStd[i], sample.population ? sample.geneVariance[i] : null);
    return [...meta, ...row];
  });
  return makeCSV([...metadata, ...fields, ...geneFields], rows);
}

export function downloadCSV(text, filename, root = document, browser = window) {
  const url = browser.URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  const link = root.createElement('a');
  try {
    link.href = url; link.download = filename;
    root.body.append(link); link.click();
  } finally {
    link.remove();
    browser.setTimeout(() => browser.URL.revokeObjectURL(url), 0);
  }
}
