import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {NeuralNetwork} from '../src/ai/NeuralNetwork.js';
import {exportNetwork,importNetwork} from '../src/ai/NetworkSerialization.js';
import {exportChampion,importChampion,validateTrainingMetadata} from '../src/ai/ChampionSerialization.js';
import {TransferSession} from '../src/experiments/TransferSession.js';
import {normalizedTrackScore,aggregateScores} from '../src/evolution/NormalizedScore.js';
import {EvolutionEngine} from '../src/evolution/EvolutionEngine.js';
import {createRegisteredTrack,TRACKS} from '../src/track/TrackRegistry.js';
import {MULTI_TRAIN_IDS,HELD_OUT_IDS,runGeneralizationTrial} from '../src/experiments/Generalization.js';

const config={populationSize:2,seed:17,eliteCount:1,maxDuration:.1,stagnationTime:.1,fitness:'normalized'};
function finish(e,n=1){e.start();for(let i=0;i<10000&&e.history.length<n;i++)e.step(1/120);assert.equal(e.history.length,n);}
test('paired seed creates identical starting genomes across every mono and multi condition',()=>{
 const tracks=TRACKS.map(t=>createRegisteredTrack(t.id)),initial=tracks.map(t=>new EvolutionEngine(config,t).population.individuals.map(i=>i.genome.values));
 for(const values of initial)assert.deepEqual(values,initial[0]);
 const multi=new EvolutionEngine(config,tracks[0],tracks.slice(0,3));assert.deepEqual(multi.population.individuals.map(i=>i.genome.values),initial[0]);
});
test('normalized progress is checkpoint-count independent and finite',()=>{
 assert.equal(normalizedTrackScore({checkpoints:6,fraction:0},12),normalizedTrackScore({checkpoints:10},20));
 assert.equal(normalizedTrackScore({checkpoints:12,laps:1},12),1);
 assert.equal(normalizedTrackScore({checkpoints:12,laps:1,crashed:true},12),.5);
 assert.equal(normalizedTrackScore({checkpoints:0,distance:1e20,elapsed:1e20},12),0);
 assert.equal(normalizedTrackScore({checkpoints:NaN,fraction:Infinity,laps:NaN},12),0);
 assert.equal(normalizedTrackScore({checkpoints:2},12),normalizedTrackScore({checkpoints:2},12));
 assert.throws(()=>normalizedTrackScore({},0));
});
test('aggregate combines equal mean and worst score, validates all values including holes',()=>{
 assert.equal(aggregateScores([1,0,1]),1/3);assert.equal(aggregateScores([.5,.5]),.5);
 for(const x of [[],[NaN],[Infinity],[-1],[2],new Array(2)])assert.throws(()=>aggregateScores(x));
});
test('champion serialization preserves provenance and legacy feedforward compatibility',()=>{
 const n=new NeuralNetwork({seed:4}),metadata={version:1,trackIds:['oval','desert'],seed:2026,generation:2,fitness:'normalized'};
 const json=exportChampion(n,metadata),loaded=importChampion(json);assert.deepEqual(loaded.training,metadata);
 assert.equal(exportNetwork(loaded.network),exportNetwork(n));assert.equal(exportNetwork(importNetwork(json)),exportNetwork(n));
 assert.equal(importChampion(exportNetwork(n)).training,null);assert.ok(Object.isFrozen(loaded.training.trackIds));
 metadata.trackIds[0]='neon';assert.equal(loaded.training.trackIds[0],'oval');
});
test('invalid champion metadata is rejected without inventing an origin',()=>{
 const base={version:1,trackIds:['oval'],seed:1,generation:1};
 for(const patch of [{version:2},{trackIds:[]},{trackIds:['oval','oval']},{trackIds:['../oops']},{seed:-1},{generation:0}])assert.throws(()=>validateTrainingMetadata({...base,...patch}));
 const data=JSON.parse(exportNetwork(new NeuralNetwork()));data.training={...base,seed:Infinity};assert.throws(()=>importChampion(JSON.stringify(data)));
});
test('historical step-4 champion loads unchanged and can transfer without invented provenance',()=>{
 const text=readFileSync(new URL('../docs/experiments/essai-2026/champion.json',import.meta.url),'utf8'),c=importChampion(text);
 assert.equal(c.training,null);const r=new TransferSession(c.network,createRegisteredTrack('neon'),{horizon:.1}).run();assert.equal(r.weightsUnchanged,true);assert.equal(r.trainingTrackIds,null);
});
test('explicit multi evaluation forces normalized scoring and invalid run steps fail',()=>{
 const t=createRegisteredTrack('oval'),e=new EvolutionEngine({...config,fitness:'reference'},t,[t,createRegisteredTrack('desert')]);assert.equal(e.config.fitness,'normalized');
 const session=new TransferSession(new NeuralNetwork(),t,{horizon:.1});for(const dt of [NaN,Infinity,0,-1])assert.throws(()=>session.run(dt));
});
test('transfer uses frozen weights, real simulation, no reproduction and bounded horizon',()=>{
 const n=new NeuralNetwork({seed:23}),before=exportNetwork(n),session=new TransferSession(n,createRegisteredTrack('desert'),{horizon:.2});
 const r=session.run();assert.equal(r.weightsUnchanged,true);assert.equal(exportNetwork(n),before);assert.equal(r.trainingTrackIds,null);assert.equal(r.trackId,'desert');assert.ok(r.elapsed<=.2+1e-9);
 assert.equal(session.simulation.mode,'autonomous');assert.equal(session.engine,undefined);assert.ok(Number.isFinite(r.fitness));assert.throws(()=>session.step(NaN));assert.throws(()=>new TransferSession(n,createRegisteredTrack('oval'),{horizon:0}));
});
test('mono training evaluates each selectable circuit and archives its id',()=>{
 for(const {id} of TRACKS){const e=new EvolutionEngine(config,createRegisteredTrack(id));finish(e);assert.deepEqual(e.trainingTrackIds,[id]);assert.equal(e.population.episodes.length,1);assert.equal(importChampion(e.exportBest()).training.trackIds[0],id);assert.equal(e.history.length,1);}
});
test('multi training evaluates every genome independently on every configured track',()=>{
 const tracks=MULTI_TRAIN_IDS.map(createRegisteredTrack),e=new EvolutionEngine(config,tracks[0],tracks);finish(e,3);
 assert.equal(e.population.episodes.length,3);assert.equal(e.best.result.perTrack.length,3);
 for(const i of e.population.individuals){assert.ok(i.fitness>=0&&i.fitness<=1);assert.equal(i.result.perTrack.length,3);}
 const a=e.population.episodes[0].individuals[0].simulation,b=e.population.episodes[1].individuals[0].simulation;assert.notEqual(a.car,b.car);assert.notEqual(a.neuralController.network,b.neuralController.network);
 assert.deepEqual(importChampion(e.exportBest()).training.trackIds,MULTI_TRAIN_IDS);
});
test('multi training rejects empty and repeated sets, isolates held-out tracks',()=>{
 const t=createRegisteredTrack('oval');assert.throws(()=>new EvolutionEngine(config,t,[]));assert.throws(()=>new EvolutionEngine(config,t,[t,t]));
 assert.ok(HELD_OUT_IDS.every(id=>!MULTI_TRAIN_IDS.includes(id)));
});
test('multi generations are reproducible, reset restores seeded initial conditions',()=>{
 const tracks=['oval','desert'].map(createRegisteredTrack),a=new EvolutionEngine(config,tracks[0],tracks),b=new EvolutionEngine(config,tracks[0],tracks);finish(a,4);finish(b,4);
 assert.deepEqual(a.history,b.history);assert.equal(a.exportBest(),b.exportBest());
 a.reset();b.reset();assert.deepEqual(a.population.individuals.map(i=>i.genome),b.population.individuals.map(i=>i.genome));assert.equal(a.history.length,0);
});
test('long multi simulation remains finite over 20000 synchronized steps',()=>{
 const tracks=['oval','desert','mountain'].map(createRegisteredTrack),e=new EvolutionEngine({...config,maxDuration:.5,stagnationTime:.5},tracks[0],tracks);e.start();
 for(let i=0;i<20000;i++)e.step(1/120);
 assert.ok(e.history.length>300);for(const h of e.history)for(const key of ['maxFitness','meanFitness','diversity'])assert.ok(Number.isFinite(h[key]));
 for(const p of e.population.episodes)for(const i of p.individuals)assert.ok(Number.isFinite(i.simulation.car.position.x));
});
test('short scientific trial is reproducible and preserves transfer weights',()=>{
 const options={seed:7,trainingIds:['oval','desert'],populationSize:1,generations:1,horizon:.1};
 const a=runGeneralizationTrial(options),b=runGeneralizationTrial(options);assert.deepEqual(a,b);assert.equal(a.evaluations.length,5);assert.ok(a.evaluations.every(e=>e.weightsUnchanged));
});
test('published protocol contains five seeds, equal budgets and all 150 frozen evaluations',()=>{
 const report=JSON.parse(readFileSync(new URL('../docs/experiments/etape-6/resultats.json',import.meta.url)));
 assert.equal(report.runs.length,30);assert.equal(report.protocol.seeds.length,5);assert.deepEqual(report.protocol.heldOutTracks,HELD_OUT_IDS);
 let count=0;for(const r of report.runs){assert.equal(r.allocatedIndividualCircuitSteps,432000);assert.ok(r.activeIndividualCircuitSteps<=r.allocatedIndividualCircuitSteps);assert.ok(r.evaluations.every(e=>e.weightsUnchanged));count+=r.evaluations.length;}
 assert.equal(count,150);assert.equal(report.summary.length,30);assert.ok(report.summary.every(s=>s.count===5));
 const csv=readFileSync(new URL('../docs/experiments/etape-6/evaluations.csv',import.meta.url),'utf8');assert.equal(csv.trim().split(/\r?\n/).length,151);assert.match(csv,/directTransfer/);
});
test('saved champion replay reproduces observed unknown-track result exactly',()=>{
 const report=JSON.parse(readFileSync(new URL('../docs/experiments/etape-6/resultats.json',import.meta.url))),r=report.runs.find(r=>r.condition==='mono:oval'&&r.seed===2026);
 const champion=importChampion(readFileSync(new URL('../docs/experiments/etape-6/'+r.championPath,import.meta.url),'utf8'));
 const actual=new TransferSession(champion.network,createRegisteredTrack('neon'),{horizon:30,training:champion.training}).run();assert.deepEqual(actual,r.evaluations.find(e=>e.trackId==='neon'));
});
