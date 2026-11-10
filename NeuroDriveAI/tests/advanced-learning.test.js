import test from 'node:test';import assert from 'node:assert/strict';
import { optimizedFitness,referenceFitness,improvedFitness } from '../src/evolution/Fitness.js';
import { AdaptiveMutation } from '../src/evolution/AdaptiveMutation.js';
import { EvolutionEngine,validateConfig } from '../src/evolution/EvolutionEngine.js';
import { Population } from '../src/evolution/Population.js';import { Genome } from '../src/evolution/Genome.js';
import { geneticDiversity } from '../src/evolution/EvolutionStatistics.js';
const policy=(extra={})=>new AdaptiveMutation(validateConfig({adaptiveMutation:true,...extra}));
const finish=e=>{const target=e.history.length+1;while(e.history.length<target)e.step(1/120);};

test('optimized fitness exact lap bonus, completion speed and strong collision penalty',()=>{
 const r={checkpoints:12,laps:1,fraction:0,firstLapTime:12,elapsed:20};
 assert.equal(optimizedFitness(r,20),5280);assert.equal(optimizedFitness({...r,crashed:true},20),2112);
 assert.equal(optimizedFitness({...r,reason:'stagnation'},20),3168);
 assert.ok(optimizedFitness(r,20)>optimizedFitness({checkpoints:11,laps:0,fraction:.999,elapsed:5},20));
});
test('incomplete progress has no early-death advantage and idle has no reward',()=>{
 const r={checkpoints:3,laps:0,fraction:.4};assert.equal(optimizedFitness({...r,elapsed:1},20),optimizedFitness({...r,elapsed:19},20));
 assert.equal(optimizedFitness({checkpoints:0,laps:0,fraction:0,elapsed:20,distance:1e9},20),0);
 assert.equal(optimizedFitness({checkpoints:1e9,laps:Infinity,fraction:NaN,elapsed:Infinity},20),1e8);
 assert.throws(()=>optimizedFitness({},NaN));
});
test('optimized score is state-based: repeated evaluation never accumulates reward',()=>{
 const r={checkpoints:1,laps:0,fraction:.5,elapsed:5};const value=optimizedFitness(r,20);
 for(let i=0;i<10000;i++)assert.equal(optimizedFitness(r,20),value);
 assert.equal(referenceFitness({checkpoints:2}),4);assert.equal(improvedFitness({checkpoints:2,elapsed:0},20),200);
});
test('adaptation increases after patience, clips, and returns to base after improvement',()=>{
 const p=policy();assert.equal(p.observe({maxFitness:100,diversity:.3}).rate,.1);
 assert.equal(p.observe({maxFitness:100,diversity:.3}).rate,.1);
 assert.ok(p.observe({maxFitness:100,diversity:.3}).rate>.1);
 for(let i=0;i<100;i++){const a=p.observe({maxFitness:100,diversity:.3});assert.ok(a.rate>=.02&&a.rate<=.3);}
 assert.equal(p.observe({maxFitness:200,diversity:.1}).rate,.1);
 assert.equal(p.stagnantGenerations,0);
});
test('small cumulative improvements can cross the significant-improvement threshold',()=>{
 const p=policy();p.observe({maxFitness:100,diversity:.4});p.observe({maxFitness:100.5,diversity:.4});
 assert.equal(p.observe({maxFitness:101.1,diversity:.4}).stagnantGenerations,0);
});
test('low diversity can raise mutation before patience; disabled policy preserves base',()=>{
 const p=policy({mutationPatience:10});p.observe({maxFitness:1,diversity:0});assert.ok(p.observe({maxFitness:1,diversity:0}).rate>.1);
 const off=new AdaptiveMutation(validateConfig({mutationRate:1}));for(let i=0;i<10;i++)assert.equal(off.observe({maxFitness:0,diversity:0}).rate,1);
});
test('adaptive parameter bounds and invalid observations fail explicitly',()=>{
 for(const c of [{minMutationRate:.4},{adaptiveMutation:true,mutationRate:.4},{maxMutationRate:NaN},{immigrantFraction:.3},{mutationPatience:0},{adaptiveMutation:'true'}])assert.throws(()=>validateConfig(c));
 assert.throws(()=>policy().observe({maxFitness:NaN,diversity:0}));assert.throws(()=>policy().observe({maxFitness:1,diversity:Infinity}));
});
test('diversity is reproducible RMS standard deviation and detects identical genotypes',()=>{
 const a={genome:new Genome(Array(134).fill(-1))},b={genome:new Genome(Array(134).fill(1))};
 assert.equal(geneticDiversity([a,a]),0);assert.equal(geneticDiversity([a,b]),1);assert.equal(geneticDiversity([b,a]),1);
});
test('immigration is bounded and cannot replace elite slots',()=>{
 const p=policy({populationSize:10,eliteCount:9,immigrantFraction:.2});
 p.observe({maxFitness:0,diversity:0});p.observe({maxFitness:0,diversity:0});
 assert.equal(p.observe({maxFitness:0,diversity:0}).immigrants,1);
});
test('actual immigrant injection creates independent random genomes after elites',()=>{
 const e=new EvolutionEngine({populationSize:10,eliteCount:2,maxDuration:.1,stagnationTime:.1,mutationRate:0,immigrantFraction:.2});
 const zero=new Genome(Array(134).fill(0));e.population=new Population(Array.from({length:10},()=>zero.copy()),e.track,1,e.config);e.start();
 for(let i=0;i<3;i++)finish(e);assert.equal(e.adaptation.immigrants,2);e.nextGeneration();
 assert.equal(e.immigrants,2);assert.deepEqual(e.population.individuals[0].genome.values,zero.values);
 assert.deepEqual(e.population.individuals[1].genome.values,zero.values);
 assert.notDeepEqual(e.population.individuals.at(-1).genome.values,zero.values);
 assert.notEqual(e.population.individuals.at(-1).genome,e.population.individuals.at(-2).genome);
});
test('adaptive generations are reproducible and reset returns to base parameters',()=>{
 const c={populationSize:3,eliteCount:1,maxDuration:.1,stagnationTime:.1,adaptiveMutation:true};
 const a=new EvolutionEngine(c),b=new EvolutionEngine(c);a.start();b.start();
 for(let g=0;g<8;g++){finish(a);finish(b);assert.deepEqual(a.history,b.history);assert.equal(a.exportBest(),b.exportBest());}
 a.reset();assert.equal(a.currentMutationRate,.1);assert.equal(a.adaptation,null);
});
test('5,000 adaptive ticks with optional immigration stay finite across many generations',()=>{
 const e=new EvolutionEngine({populationSize:5,eliteCount:1,maxDuration:.1,stagnationTime:.1,adaptiveMutation:true,immigrantFraction:.2,diversityThreshold:5,mutationPatience:1});e.start();
 for(let i=0;i<5000;i++){e.step(1/120);assert.ok(Number.isFinite(e.currentMutationRate));assert.ok(e.currentMutationRate>=.02&&e.currentMutationRate<=.3);}
 assert.ok(e.history.length>100);assert.ok(e.history.every(s=>Number.isFinite(s.diversity)&&Number.isFinite(s.maxFitness)));
});
test('a generation cannot be finalized twice to duplicate rewards or statistics',()=>{
 const e=new EvolutionEngine({populationSize:2,eliteCount:1,maxDuration:.1,stagnationTime:.1});e.start();finish(e);
 const count=e.history.length,best=e.best;
 assert.throws(()=>e.completeGeneration(),/already finalized/);
 assert.equal(e.history.length,count);assert.equal(e.best,best);
});
