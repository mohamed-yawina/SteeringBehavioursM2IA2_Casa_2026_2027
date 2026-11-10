import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { importNetwork } from '../src/ai/NetworkSerialization.js';
import { Simulation } from '../src/simulation/Simulation.js';

test('saved experimental champion replays the reported valid checkpoint/lap result', () => {
  const report=JSON.parse(readFileSync(new URL('../docs/experiments/essai-2026/resultats.json',import.meta.url),'utf8'));
  const network=importNetwork(readFileSync(new URL('../docs/experiments/essai-2026/champion.json',import.meta.url),'utf8'));
  const sim=new Simulation();sim.setNetwork(network);sim.setMode('autonomous');
  for(let step=0;step<Math.round(report.config.maxDuration/report.dt);step++)sim.step(report.dt);
  assert.equal(sim.checkpoints.validated,report.summary.bestCheckpoints);
  assert.equal(sim.checkpoints.laps,report.summary.bestLaps);
  assert.ok(sim.car.distanceTravelled>1000);
  assert.equal(report.generations.length,6);
});
