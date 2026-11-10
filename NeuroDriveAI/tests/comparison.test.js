import test from 'node:test';import assert from 'node:assert/strict';
import { readFileSync,mkdtempSync,rmSync } from 'node:fs';import { tmpdir } from 'node:os';import { join } from 'node:path';import { spawnSync } from 'node:child_process';
import { summarize,csv,validateComparisonReport,summarizeStrategies,summaryRows } from '../src/experiments/Statistics.js';
import { runComparisonTrial } from '../src/experiments/Comparison.js';
import { createOvalTrack } from '../src/track/Track.js';import { createValidationTrack } from '../src/track/TrackVariants.js';
const common={populationSize:2,maxDuration:.1,stagnationTime:.1,fitness:'optimized'};
const trial=(strategy='A',seed=1)=>runComparisonTrial({common,seed,strategy,generations:2});
const reportFor=runs=>({format:'NeuroDriveAI.comparison',version:1,protocol:{seeds:[1],strategies:runs.map(r=>r.strategy),generations:2,dt:1/120,common:{...runs[0].config}},runs});

test('summary computes mean, median, sample deviation, extrema and explicit empty values',()=>{
 assert.deepEqual(summarize([1,2,3]),{count:3,mean:2,median:2,standardDeviation:1,min:1,max:3});
 assert.equal(summarize([0,2]).median,1);assert.equal(summarize([7]).standardDeviation,0);assert.equal(summarize([]).mean,null);
 assert.ok(Number.isFinite(summarize([Number.MAX_VALUE,Number.MAX_VALUE]).mean));assert.throws(()=>summarize([NaN]));
});
test('CSV quotes commas, quotes and newlines, preserves null censorship, rejects nonfinite numbers',()=>{
 assert.equal(csv([{a:'x,y',b:'a"b',c:null}],['a','b','c']),'a,b,c\n"x,y","a""b",\n');
 assert.ok(csv([{a:'x\ny'}],['a']).includes('"x\ny"'));assert.throws(()=>csv([{a:Infinity}],['a']));
});
test('four strategies share initial population, dimensions, horizons and exact allocated budgets',()=>{
 const runs=['A','B','C','D'].map(s=>trial(s));assert.equal(new Set(runs.map(r=>r.initialPopulationFingerprint)).size,1);
 assert.ok(runs.every(r=>r.allocatedIndividualSteps===48&&r.activeIndividualSteps<=48));
 assert.deepEqual(runs.map(r=>[r.config.selection,r.config.eliteCount,r.config.adaptiveMutation]),[['roulette',0,false],['tournament',0,false],['tournament',2,false],['tournament',2,true]]);
});
test('trial reproduction includes histories, champion, actual budgets and holdout replay',()=>{
 assert.deepEqual(trial('D',9),trial('D',9));assert.throws(()=>runComparisonTrial({common,seed:1,strategy:'X',generations:2}));
 assert.throws(()=>runComparisonTrial({common,seed:1,strategy:'A',generations:0}));
});
test('validation variant preserves main circuit and strict directed checkpoint geometry',()=>{
 const main=createOvalTrack(),before=JSON.stringify(main),variant=createValidationTrack();
 assert.equal(JSON.stringify(main),before);assert.equal(variant.checkpoints.length,12);assert.equal(variant.walls.length,192);
 assert.notEqual(variant.outer[0].x,main.outer[0].x);
 for(const cp of variant.checkpoints)assert.ok(Math.abs(cp.normal.dot(cp.b.copy().sub(cp.a)))<1e-8);
});
test('comparison import validates paired conditions and recalculates forged aggregates',()=>{
 const runs=['A','B','C','D'].map(s=>trial(s)),report=reportFor(runs);report.summary=[{mean:999}];
 const valid=validateComparisonReport(JSON.stringify(report));assert.equal(valid.summary.length,4);
 assert.deepEqual(valid.summary,summarizeStrategies(runs));
 const changed=edit=>{const r=structuredClone(report);edit(r);assert.throws(()=>validateComparisonReport(JSON.stringify(r)));};
 changed(r=>r.runs.pop());changed(r=>r.runs[0].allocatedIndividualSteps++);changed(r=>r.runs[0].config.maxDuration=1);
 changed(r=>r.runs[0].maxFitness=null);changed(r=>r.runs[1]=r.runs[0]);
});
test('success proportions use seeds as units and censor unsuccessful generation times',()=>{
 const a=trial(),b=trial('A',2);a.firstSuccessGeneration=1;a.validation.laps=1;
 const s=summarizeStrategies([a,b])[0];assert.equal(s.successRate,.5);assert.equal(s.validationSuccessRate,.5);
 assert.equal(s.firstSuccessGeneration.count,1);assert.equal(s.firstSuccessGeneration.mean,1);
 assert.equal(summaryRows({runs:[a,b],summary:[s]})[0].totalLaps,a.totalLaps+b.totalLaps);
});
test('headless CLI exports valid JSON, per-run/per-generation CSV and replayable champions',()=>{
 const directory=mkdtempSync(join(tmpdir(),'neurodrive-comparison-'));
 try{
  const p=spawnSync(process.execPath,['tools/compare.mjs','--seeds','1','--strategies','A,B,C,D','--generations','1','--population','2','--duration','.1','--stagnation','.1','--workers','2','--output',directory],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:30000});
  assert.equal(p.status,0,p.stderr);const report=validateComparisonReport(readFileSync(join(directory,'resultats.json'),'utf8'));assert.equal(report.runs.length,4);
  assert.equal(readFileSync(join(directory,'runs.csv'),'utf8').trim().split('\n').length,5);
  assert.equal(readFileSync(join(directory,'generations.csv'),'utf8').trim().split('\n').length,5);
  assert.equal(readFileSync(join(directory,'statistics.csv'),'utf8').trim().split('\n').length,41);
  assert.equal(JSON.parse(readFileSync(join(directory,'champions','D-1.json'),'utf8')).version,1);
  const second=join(directory,'sequential');
  const again=spawnSync(process.execPath,['tools/compare.mjs','--seeds','1','--strategies','A,B,C,D','--generations','1','--population','2','--duration','.1','--stagnation','.1','--workers','1','--output',second],{cwd:new URL('../',import.meta.url),encoding:'utf8',timeout:30000});
  assert.equal(again.status,0,again.stderr);
  assert.equal(readFileSync(join(directory,'resultats.json'),'utf8'),readFileSync(join(second,'resultats.json'),'utf8'));
 }finally{assert.ok(directory.startsWith(join(tmpdir(),'neurodrive-comparison-')));rmSync(directory,{recursive:true,force:true});}
});
