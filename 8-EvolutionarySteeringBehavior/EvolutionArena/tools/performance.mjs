import '../tests/helpers/runtime.js';
import { finiteCreature } from '../tests/helpers/runtime.js';
import { Simulation } from '../src/simulation/Simulation.js';
import { performance } from 'node:perf_hooks';
import { cpus } from 'node:os';
import { mkdirSync, writeFileSync } from 'node:fs';

const results = [];
for (const population of [36, 120, 300]) {
  const world = new Simulation({ seed: 2026, creatureCount: population, energyDrain: 0,
    poisonCount: 0, maxPoison: 0, poisonPerSecond: 0, evolution: { mode: 'off', maxPopulation: 300 },
    predation: { enabled: true, count: 3, minimumPrey: 300, energyDrain: 0 } });
  for (let i = 0; i < 600; i++) world.step(); // échauffement, population stable sans altérer les algorithmes
  globalThis.gc?.(); const before = process.memoryUsage().heapUsed;
  const blocks = []; const start = performance.now();
  for (let block = 0; block < 200; block++) {
    const begin = performance.now();
    for (let step = 0; step < 100; step++) world.step();
    blocks.push((performance.now() - begin) / 100);
    if (!world.creatures.every(finiteCreature) || !world.predators.every(finiteCreature)) throw new Error('Vecteur non fini.');
    if (world.creatures.length !== population) throw new Error('Population de mesure non constante.');
  }
  const totalMs = performance.now() - start; globalThis.gc?.(); const after = process.memoryUsage().heapUsed;
  blocks.sort((a, b) => a - b);
  results.push({ population, steps: 20000, simulatedSeconds: 20000 / 60, totalMs,
    meanUpdateMs: totalMs / 20000, p95BlockMeanUpdateMs: blocks[Math.floor(blocks.length * .95)],
    heapBeforeBytes: before, heapAfterBytes: after, heapDeltaBytes: after - before,
    historyLength: world.metrics.history.length, finalPopulation: world.creatures.length, finite: true });
}
const report = { date: new Date().toISOString(), node: process.version, cpu: cpus()[0].model,
  runtime: 'Node + doublure vectorielle, sans DOM ni rendu p5', gcExposed: typeof globalThis.gc === 'function',
  protocol: '600 pas échauffement, 20000 pas mesurés par taille ; reproduction off, drain=0, poison=0, trois prédateurs au repos ; 100 pas/bloc ; statistiques actives',
  limitations: 'Pas de FPS ni temps de rendu navigateur. Delta heap après GC, pas une preuve d’absence de fuite. p95 des moyennes de blocs, pas des pas individuels.', results };
mkdirSync(new URL('../output/performance/', import.meta.url), { recursive: true });
writeFileSync(new URL('../output/performance/final.json', import.meta.url), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
