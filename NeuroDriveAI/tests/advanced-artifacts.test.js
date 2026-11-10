import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';
import {Simulation} from '../src/simulation/Simulation.js';import {importNetwork} from '../src/ai/NetworkSerialization.js';
import {Genome} from '../src/evolution/Genome.js';import {replayGenome} from '../src/experiments/Comparison.js';
import {createOvalTrack} from '../src/track/Track.js';import {createValidationTrack} from '../src/track/TrackVariants.js';
import {validateComparisonReport,summarizeStrategies} from '../src/experiments/Statistics.js';
const load=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const folder='docs/experiments/etape-5/comparaison/';

test('initial audit reproduces the old champion lap at 12.60 s with protected success rules',()=>{
 const audit=JSON.parse(load('docs/experiments/etape-5/audit-initial.json'));
 for(const [path,hash]of Object.entries(audit.protectedSources))assert.equal(createHash('sha256').update(load(path)).digest('hex'),hash,path);
 const s=new Simulation();s.setNetwork(importNetwork(load('docs/experiments/essai-2026/champion.json')));s.setMode('autonomous');let first=null;
 for(let i=0;i<2400;i++){s.step(1/120);if(first===null&&s.checkpoints.laps>0)first=s.elapsed;}
 assert.ok(Math.abs(first-12.6)<1e-8);assert.equal(first,audit.firstLap);
});
test('delivered A-D report has five paired seeds, equal budgets and consistent finite JSON/CSV',()=>{
 const report=validateComparisonReport(load(folder+'resultats.json'));assert.equal(report.runs.length,20);
 assert.deepEqual(report.summary,summarizeStrategies(report.runs));
 for(const seed of report.protocol.seeds){const group=report.runs.filter(r=>r.seed===seed);assert.equal(group.length,4);assert.equal(new Set(group.map(r=>r.initialPopulationFingerprint)).size,1);}
 assert.ok(report.runs.every(r=>r.allocatedIndividualSteps===960000&&r.history.length===8));
 assert.equal(load(folder+'runs.csv').trim().split('\n').length,21);assert.equal(load(folder+'generations.csv').trim().split('\n').length,161);
 const finite=value=>{if(typeof value==='number')assert.ok(Number.isFinite(value));if(value&&typeof value==='object')Object.values(value).forEach(finite);};finite(report);
  const long=JSON.parse(load('docs/experiments/etape-5/robustesse-60s.json'));assert.equal(long.runs.length,20);assert.ok(long.runs.every(r=>r.horizon===60));finite(long);
});
test('best observed individual replays exactly on principal and affine validation tracks without retraining',()=>{
 const report=validateComparisonReport(load(folder+'resultats.json')),run=report.runs.reduce((a,b)=>b.maxFitness>a.maxFitness?b:a);
 for(const r of report.runs)assert.deepEqual(importNetwork(load(folder+r.championPath)).sizes,[8,12,2]);
 const genome=Genome.fromNetwork(importNetwork(load(folder+run.championPath)));
 assert.deepEqual(replayGenome(genome,createOvalTrack(),run.config,report.protocol.dt),run.trainingReplay);
 assert.deepEqual(replayGenome(genome,createValidationTrack(),run.config,report.protocol.dt),run.validation);
});
