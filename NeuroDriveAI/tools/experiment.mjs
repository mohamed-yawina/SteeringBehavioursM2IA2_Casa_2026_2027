import '../tests/support/p5.mjs';
import { EvolutionEngine } from '../src/evolution/EvolutionEngine.js';
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
const generations=Number(process.argv[2]??6),populationSize=Number(process.argv[3]??50);
if(!Number.isInteger(generations)||generations<1||generations>100)throw new RangeError('Generations must be 1..100');
const config={seed:2026,populationSize,eliteCount:Math.min(2,populationSize),maxDuration:12,stagnationTime:3,
  selection:'tournament',mutationRate:.1,mutationAmplitude:.2,fitness:'improved'};
const engine=new EvolutionEngine(config);engine.start();
console.log(JSON.stringify({type:'protocol',track:engine.track.id,dt:1/120,generations,config:engine.config}));
let previous=0,ticks=0;
while(engine.history.length<generations){
  engine.step(1/120);ticks++;
  if(engine.history.length>previous){console.log(JSON.stringify({type:'generation',...engine.history.at(-1)}));previous=engine.history.length;}
}
const summary={type:'summary',ticks,bestFitness:engine.best.fitness,bestGeneration:engine.best.generation,
  bestCheckpoints:engine.best.result.checkpoints,bestLaps:engine.best.result.laps,
  note:'Single seeded training-track trial, not proof of generalization or reliable driving.'};
console.log(JSON.stringify(summary));
if(process.argv[4]){
  const directory=resolve(process.argv[4]);mkdirSync(directory,{recursive:true});
  const report={format:'NeuroDriveAI.experiment',version:1,node:process.version,track:engine.track.id,dt:1/120,config:engine.config,generations:engine.history,summary};
  writeFileSync(join(directory,'resultats.json'),JSON.stringify(report,null,2));
  writeFileSync(join(directory,'champion.json'),engine.exportBest());
  console.log(JSON.stringify({type:'artifacts',directory,files:['resultats.json','champion.json']}));
}
