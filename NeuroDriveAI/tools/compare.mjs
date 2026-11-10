import { Worker } from 'node:worker_threads';
import { mkdirSync,writeFileSync,existsSync } from 'node:fs';
import { resolve,join } from 'node:path';
import { summarizeStrategies,csv,RUN_COLUMNS,summaryRows,statisticRows } from '../src/experiments/Statistics.js';
import '../tests/support/p5.mjs';
import { validateConfig } from '../src/evolution/EvolutionEngine.js';
import { strategyConfig } from '../src/experiments/Strategies.js';

const options={};
for(let i=2;i<process.argv.length;i+=2){const key=process.argv[i];if(!key.startsWith('--')||!process.argv[i+1])throw new Error('Expected --option value');if(Object.hasOwn(options,key))throw new Error(`Duplicate ${key}`);options[key]=process.argv[i+1];}
const allowed=['--seeds','--strategies','--generations','--population','--duration','--stagnation','--workers','--output','--fitness','--mutation-rate','--amplitude','--tournament','--min-rate','--max-rate','--patience','--diversity-threshold'];
for(const key of Object.keys(options))if(!allowed.includes(key))throw new Error(`Unknown ${key}`);
const tokens=(options['--seeds']??'2026,2027,2028,2029,2030').split(',').map(s=>s.trim());
if(tokens.some(s=>!/^\d+$/.test(s)))throw new Error('Invalid seed token');
const seeds=tokens.map(Number);
const strategies=(options['--strategies']??'A,B,C,D').split(',');
const generations=Number(options['--generations']??8),workers=Number(options['--workers']??4);
if(!seeds.length||new Set(seeds).size!==seeds.length||seeds.some(n=>!Number.isInteger(n)||n<0||n>0xffffffff))throw new Error('Invalid seeds');
if(!strategies.length||new Set(strategies).size!==strategies.length||strategies.some(s=>!['A','B','C','D'].includes(s)))throw new Error('Invalid strategies');
if(!Number.isInteger(workers)||workers<1||workers>16)throw new Error('Invalid worker count');
if(!Number.isInteger(generations)||generations<1||generations>100)throw new Error('Invalid generations');
const common={populationSize:Number(options['--population']??50),maxDuration:Number(options['--duration']??20),
  stagnationTime:Number(options['--stagnation']??4),fitness:options['--fitness']??'optimized',mutationRate:Number(options['--mutation-rate']??.1),mutationAmplitude:Number(options['--amplitude']??.2),
  tournamentSize:Number(options['--tournament']??5),minMutationRate:Number(options['--min-rate']??.02),maxMutationRate:Number(options['--max-rate']??.3),mutationPatience:Number(options['--patience']??2),diversityThreshold:Number(options['--diversity-threshold']??.25),immigrantFraction:0};
for(const strategy of strategies)validateConfig(strategyConfig(strategy,common,seeds[0]));
if(Math.abs(common.maxDuration*120-Math.round(common.maxDuration*120))>1e-8)throw new Error('Duration must contain whole simulation steps');
const output=resolve(options['--output']??'output/comparison');
if(existsSync(join(output,'resultats.json')))throw new Error('Choose a new output directory: existing report preserved');
mkdirSync(join(output,'champions'),{recursive:true});
const jobs=strategies.flatMap(strategy=>seeds.map(seed=>({common,seed,strategy,generations,dt:1/120})));
const runs=[];let next=0;
console.log(JSON.stringify({type:'protocol',seeds,strategies,generations,common,workers,output}));
async function processJob(job){
  return new Promise((res,rej)=>{
    const worker=new Worker(new URL('./comparison-worker.mjs',import.meta.url),{workerData:job});let gotResult=false;
    worker.on('message',message=>{
      if(message.type==='progress')console.log(JSON.stringify({type:'generation',strategy:job.strategy,seed:job.seed,generation:message.event.generation,laps:message.event.laps,maxCheckpoints:message.event.bestCheckpoints}));
      if(message.type==='error')rej(new Error(message.error));
      if(message.type==='result'){gotResult=true;res(message.result);}
    });
    worker.on('error',rej);worker.on('exit',code=>{if(code!==0||!gotResult)rej(new Error(`Worker exited: ${code}`));});
  });
}
async function consume(){while(next<jobs.length){const job=jobs[next++],result=await processJob(job);const filename=`${job.strategy}-${job.seed}.json`;
  writeFileSync(join(output,'champions',filename),result.championJSON);delete result.championJSON;result.championPath=`champions/${filename}`;
  runs.push(result);writeFileSync(join(output,`${job.strategy}-${job.seed}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify({type:'completed',strategy:job.strategy,seed:job.seed,laps:result.totalLaps,firstSuccessGeneration:result.firstSuccessGeneration}));}}
await Promise.all(Array.from({length:Math.min(workers,jobs.length)},consume));
runs.sort((a,b)=>a.strategy.localeCompare(b.strategy)||a.seed-b.seed);
const report={format:'NeuroDriveAI.comparison',version:1,node:process.version,protocol:{seeds,strategies,generations,dt:1/120,track:'oval',validationTrack:'oval-affine-v1',common,
  budget:'identical reserved individual-steps; inactive remainder is not reinvested; actual active steps reported separately'},runs,summary:summarizeStrategies(runs)};
writeFileSync(join(output,'resultats.json'),JSON.stringify(report,null,2));
writeFileSync(join(output,'runs.csv'),csv(runs,RUN_COLUMNS));
const histories=runs.flatMap(r=>r.history.map(s=>({strategy:r.strategy,seed:r.seed,...s})));
writeFileSync(join(output,'generations.csv'),csv(histories,['strategy','seed','generation','maxFitness','meanFitness','bestCheckpoints','laps','collisions','diversity','mutationRate','nextMutationRate','integrationSteps']));
const summary=summaryRows(report);
writeFileSync(join(output,'summary.csv'),csv(summary,Object.keys(summary[0])));
writeFileSync(join(output,'statistics.csv'),csv(statisticRows(report),['strategy','metric','count','mean','median','standardDeviation','min','max']));
console.log(JSON.stringify({type:'summary',strategies:summary}));
