export const CHARTS = Object.freeze([
  { id: 'chart-population', label: 'Population', series: [{ label: 'Vivants', color: '#79e7fa', value: s => s.population }] },
  { id: 'chart-events', label: 'Naissances et décès cumulés', series: [
    { label: 'Naissances', color: '#80ecab', value: s => s.births }, { label: 'Décès', color: '#fb8290', value: s => s.deaths }] },
  { id: 'chart-energy', label: 'Énergie moyenne', min: 0, max: 1.5, series: [{ label: 'Énergie', color: '#eec684', value: s => s.population ? s.meanEnergy : null }] },
  { id: 'chart-generation', label: 'Génération maximale atteinte', series: [{ label: 'Génération', color: '#b99bff', value: s => s.maxGeneration }] },
  ...['Poids nourriture', 'Poids poison', 'Perception nourriture (px)', 'Perception poison (px)'].map((label, index) => ({
    id: `chart-gene-${index}`, label, min: index < 2 ? -2 : 0, max: index < 2 ? 2 : 100,
    series: [{ label, color: ['#80ecab', '#fb8290', '#79e7fa', '#b99bff'][index], value: s => s.population ? s.meanGenes[index] : null }],
  })),
  { id: 'chart-diversity', label: 'Diversité normalisée D', min: 0, max: 0.25,
    series: [{ label: 'D', color: '#79e7fa', value: s => s.diversity }] },
]);

export function chartCoordinates(history, definition, width, height) {
  const first = history[0]?.time ?? 0, last = history.at(-1)?.time ?? 1;
  let low = definition.min ?? 0, high = definition.max ?? 1;
  if (definition.max === undefined) for (const sample of history) for (const series of definition.series) {
    const value = series.value(sample); if (Number.isFinite(value)) high = Math.max(high, value);
  }
  if (high <= low) high = low + 1;
  const points = definition.series.map(series => history.map(sample => {
    const value = series.value(sample);
    if (value === null || !Number.isFinite(value)) return null;
    return { x: 45 + (sample.time - first) / Math.max(1, last - first) * (width - 62),
      y: 16 + (1 - (value - low) / (high - low)) * (height - 44) };
  }));
  return { first, last, low, high, points };
}

export class TimeSeriesCharts {
  constructor(root = document, pixelRatio = 1) {
    this.canvases = CHARTS.map(definition => root.getElementById(definition.id));
    this.pixelRatio = Math.min(2, Math.max(1, pixelRatio));
    this.lastSource = null;
    this.lastVersion = -1;
    this.lastWidths = [];
    this.drawCount = 0;
  }

  update(metrics, force = false) {
    const widths = this.canvases.map(canvas => Math.max(240, Math.floor(canvas.clientWidth || 480)));
    if (!force && this.lastSource === metrics && this.lastVersion === metrics.totalSamples
      && widths.every((width, index) => width === this.lastWidths[index])) return;
    this.lastSource = metrics; this.lastVersion = metrics.totalSamples; this.lastWidths = widths;
    for (let index = 0; index < CHARTS.length; index++) {
      const canvas = this.canvases[index], context = canvas.getContext?.('2d');
      if (!context) continue; // tests sans DOM graphique / navigateurs sans Canvas
      const width = widths[index], height = 190;
      canvas.width = Math.round(width * this.pixelRatio); canvas.height = Math.round(height * this.pixelRatio);
      context.setTransform(this.pixelRatio, 0, 0, this.pixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      this.draw(context, metrics.history, CHARTS[index], width, height);
      this.drawCount++;
    }
  }

  draw(context, history, definition, width, height) {
    const geometry = chartCoordinates(history, definition, width, height);
    context.strokeStyle = '#405575'; context.lineWidth = 1;
    context.beginPath(); context.moveTo(45, 16); context.lineTo(45, height - 28); context.lineTo(width - 17, height - 28); context.stroke();
    context.fillStyle = '#a5b6d0'; context.font = '10px system-ui';
    context.fillText(geometry.high.toFixed(geometry.high < 2 ? 2 : 0), 4, 23);
    context.fillText(String(geometry.low), 4, height - 28);
    context.fillText(`${geometry.first.toFixed(0)} s`, 45, height - 8);
    context.fillText(`${geometry.last.toFixed(0)} s`, width - 60, height - 8);
    for (let index = 0; index < definition.series.length; index++) {
      context.strokeStyle = definition.series[index].color; context.lineWidth = 2;
      context.setLineDash(index ? [5, 3] : []); context.beginPath();
      let started = false;
      for (const point of geometry.points[index]) {
        if (!point) { started = false; continue; }
        if (started) context.lineTo(point.x, point.y); else context.moveTo(point.x, point.y);
        started = true;
      }
      context.stroke();
      // Un seul point reste visible sans inventer une tendance.
      if (history.length === 1 && geometry.points[index][0]) {
        const point = geometry.points[index][0]; context.fillStyle = definition.series[index].color;
        context.fillRect(point.x - 2, point.y - 2, 4, 4);
      }
    }
    context.setLineDash([]);
    if (!history.length) { context.fillStyle = '#a5b6d0'; context.fillText('Aucun échantillon', 65, 80); }
  }
}
