import '../tests/support/p5.mjs';
import {Worker} from 'node:worker_threads';
import {readFileSync,readdirSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {MISSIONS} from '../src/game/MissionDefinitions.js';
import {MissionManager} from '../src/game/MissionManager.js';
import {createRegisteredTrack} from '../src/track/TrackRegistry.js';
import {createFeasibilityDriver} from '../src/diagnostics/FeasibilityDriver.js';
import {summarize,csv} from '../src/experiments/Statistics.js';

const args={};for(let i=2;i<process.argv.length;i+=2){if(!['--output','--workers','--seeds'].includes(process.argv[i])||!process.argv[i+1])throw new Error('Expected --output/--workers/--seeds value');args[process.argv[i]]=process.argv[i+1];}
const output=resolve(args['--output']??'output/gameplay-balance'),workers=Number(args['--workers']??4),seeds=(args['--seeds']??'2026,2027,2028,2029,2030').split(',').map(Number);
if(!Number.isInteger(workers)||workers<1||workers>16||!seeds.length||new Set(seeds).size!==seeds.length||seeds.some(s=>!Number.isInteger(s)||s<2026||s>2030))throw new Error('Invalid balancing protocol');
if(existsSync(join(output,'resultats.json')))throw new Error('Choose a new output directory');mkdirSync(output,{recursive:true});
const folders=[['step6','docs/experiments/etape-6/champions'],['step5','docs/experiments/etape-5/comparaison/champions']];
const champions=folders.flatMap(([source,path])=>readdirSync(path).sort().filter(name=>name.endsWith('.json')).flatMap(name=>{
 const seed=Number(name.match(/-(\d+)\.json$/)?.[1]);return seeds.includes(seed)?[{championId:source+'-'+name.slice(0,-5),source,seed,json:readFileSync(join(path,name),'utf8')}]:[];
}));
const candidates=[...champions,...seeds.map(seed=>({championId:'random-'+seed,source:'random',seed,random:true}))];
const jobs=MISSIONS.flatMap(m=>candidates.map(c=>({...c,missionId:m.id})));let next=0;const runs=[];
console.log(JSON.stringify({type:'protocol',seeds,champions:champions.length,random:seeds.length,evaluations:jobs.length,dt:1/120,missions:MISSIONS.map(m=>({id:m.id,limit:m.maxDuration}))}));
const evaluate=job=>new Promise((resolveJob,reject)=>{
 let received=false;const worker=new Worker(new URL('./gameplay-balance-worker.mjs',import.meta.url),{workerData:job});
 worker.on('message',message=>{received=true;if(message.error)reject(new Error(message.error));else resolveJob(message.result);});worker.on('error',reject);worker.on('exit',code=>{if(code||!received)reject(new Error('Evaluation worker failed'));});
});
async function consume(){while(next<jobs.length){const run=await evaluate(jobs[next++]);runs.push(run);if(runs.length%25===0)console.log(JSON.stringify({type:'progress',completed:runs.length,total:jobs.length}));}}
await Promise.all(Array.from({length:Math.min(workers,jobs.length)},consume));runs.sort((a,b)=>a.missionId.localeCompare(b.missionId)||a.championId.localeCompare(b.championId));
const feasibility=MISSIONS.map(m=>{
 const track=createRegisteredTrack(m.trackId),driver=createFeasibilityDriver(track),session=new MissionManager(m.id,{id:'player',name:'Diagnostic physique',control:'human'},{countdown:0});session.start();
 for(let i=0;i<=m.maxDuration*120&&!session.result;i++)session.step(1/120,{player:driver(session.race.entrants[0].simulation.car)});
 if(!session.result)throw new Error('Reference evaluation unfinished');return {...session.result,referenceSpeed:55,humanValidated:false};
});
const summary=MISSIONS.flatMap(m=>['step6','step5','random'].map(source=>{const group=runs.filter(r=>r.missionId===m.id&&r.source===source),successes=group.filter(r=>r.outcome==='victory');return {missionId:m.id,source,count:group.length,successes:successes.length,successRate:successes.length/group.length,completionTime:summarize(successes.map(r=>r.elapsed)),progress:summarize(group.map(r=>r.progress)),collisions:group.filter(r=>r.reason==='collision').length};}));
const report={format:'NeuroDriveAI.gameplay-balance',version:1,node:process.version,protocol:{seeds,dt:1/120,countdown:0,champions:champions.length,randomNetworks:seeds.length,retraining:false,objectivesUnchanged:true,missions:MISSIONS.map(m=>({id:m.id,trackId:m.trackId,objective:m.objective,maxDuration:m.maxDuration}))},runs,feasibility,summary};
writeFileSync(join(output,'resultats.json'),JSON.stringify(report,null,2));writeFileSync(join(output,'evaluations.csv'),csv(runs,Object.keys(runs[0])));
const flat=summary.map(s=>({missionId:s.missionId,source:s.source,count:s.count,successes:s.successes,successRate:s.successRate,meanTime:s.completionTime.mean,medianTime:s.completionTime.median,meanProgress:s.progress.mean,collisions:s.collisions}));
writeFileSync(join(output,'summary.csv'),csv(flat,Object.keys(flat[0])));console.log(JSON.stringify({type:'summary',summary:flat,feasibility}));
