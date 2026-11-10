import {TRACKS} from '../track/TrackRegistry.js';
import {summarize} from './Statistics.js';

// Recalculate displayed statistics from measured episodes, never imported summaries.
export function readGeneralizationReport(text){
 const report=JSON.parse(text),p=report.protocol;
 if(report.format!=='NeuroDriveAI.generalization'||report.version!==1||!p||!Array.isArray(p.seeds)||!p.seeds.length||new Set(p.seeds).size!==p.seeds.length||!Array.isArray(report.runs)||!report.runs.length)throw new TypeError('Invalid generalization report');
 if(p.seeds.some(s=>!Number.isInteger(s)||s<0||s>0xffffffff)||!Number.isFinite(p.dt)||p.dt<=0||!Number.isFinite(p.allocatedBudgetPerRun)||p.allocatedBudgetPerRun<=0||!Array.isArray(p.multiTrainingTracks)||!Array.isArray(p.heldOutTracks)||p.heldOutTracks.some(id=>p.multiTrainingTracks.includes(id)))throw new TypeError('Invalid protocol or holdout split');
 const keys=new Set();
 for(const run of report.runs){
  const key=run.condition+':'+run.seed;
  if(keys.has(key)||!p.seeds.includes(run.seed)||!Array.isArray(run.trainingIds)||!run.trainingIds.length||run.trainingIds.some(id=>!TRACKS.some(t=>t.id===id))||new Set(run.trainingIds).size!==run.trainingIds.length)throw new TypeError('Invalid trial identity');
  keys.add(key);
  const expected=run.trainingIds.length===1?'mono:'+run.trainingIds[0]:'multi:'+run.trainingIds.join('+');
  if(run.condition!==expected||run.trainingIds.length>1&&run.trainingIds.some(id=>p.heldOutTracks.includes(id)))throw new TypeError('Invalid condition or test leakage');
  if(run.allocatedIndividualCircuitSteps!==p.allocatedBudgetPerRun||run.allocatedIndividualCircuitSteps!==run.populationSize*run.generations*run.trainingIds.length*run.horizon/p.dt||!Number.isFinite(run.activeIndividualCircuitSteps)||run.activeIndividualCircuitSteps<0||run.activeIndividualCircuitSteps>run.allocatedIndividualCircuitSteps)throw new TypeError('Incomparable budgets');
  if(!Array.isArray(run.evaluations)||run.evaluations.length!==TRACKS.length||new Set(run.evaluations.map(e=>e.trackId)).size!==TRACKS.length)throw new TypeError('Incomplete transfer matrix');
  for(const e of run.evaluations){
   if(!TRACKS.some(t=>t.id===e.trackId)||e.weightsUnchanged!==true||typeof e.crashed!=='boolean'||JSON.stringify(e.trainingTrackIds)!==JSON.stringify(run.trainingIds)||!Number.isInteger(e.laps)||e.laps<0)throw new TypeError('Invalid frozen transfer');
   for(const field of ['normalizedProgress','normalizedScore','elapsed','fitness','checkpoints'])if(!Number.isFinite(e[field])||e[field]<0)throw new TypeError('Invalid '+field);
   if(e.normalizedProgress>1||e.normalizedScore>1||e.elapsed>run.horizon+1e-8)throw new TypeError('Invalid evaluation range');
  }
 }
 const conditions=[...new Set(report.runs.map(r=>r.condition))];
 if(report.runs.length!==conditions.length*p.seeds.length)throw new TypeError('Incomplete paired seeds');
 const summary=conditions.flatMap(condition=>TRACKS.map(t=>{
  const runs=report.runs.filter(r=>r.condition===condition),episodes=runs.map(r=>r.evaluations.find(e=>e.trackId===t.id));
  return {condition,testTrack:t.id,count:episodes.length,successes:episodes.filter(e=>e.laps>0).length,progress:summarize(episodes.map(e=>e.normalizedProgress)),collisionRate:episodes.filter(e=>e.crashed).length/episodes.length,survival:summarize(episodes.map(e=>e.elapsed))};
 }));
 return {...report,summary};
}
