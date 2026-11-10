import { strategyConfig } from './Strategies.js';
export function summarize(values) {
  if(!Array.isArray(values)||Array.from(values).some(v=>!Number.isFinite(v)))throw new TypeError('Statistics require finite numbers');
  if(!values.length)return {count:0,mean:null,median:null,standardDeviation:null,min:null,max:null};
  const sorted=[...values].sort((a,b)=>a-b),n=values.length,scale=Math.max(...values.map(Math.abs));
  const meanUnit=scale===0?0:values.reduce((s,v)=>s+v/scale,0)/n;
  const variance=scale===0||n===1?0:values.reduce((s,v)=>s+(v/scale-meanUnit)**2,0)/(n-1);
  const result={count:n,mean:scale*meanUnit,median:n%2?sorted[(n-1)/2]:sorted[n/2-1]/2+sorted[n/2]/2,
    standardDeviation:scale*Math.sqrt(variance),min:sorted[0],max:sorted.at(-1)};
  if(Object.values(result).some(v=>!Number.isFinite(v)))throw new RangeError('Unrepresentable statistics');
  return result;
}
export function summarizeStrategies(runs) {
  const metrics=['maxFitness','meanFitness','maxCheckpoints','totalLaps','collisions','diversity','activeIndividualSteps'];
  return [...new Set(runs.map(r=>r.strategy))].sort().map(strategy=>{
    const group=runs.filter(r=>r.strategy===strategy);
    return {strategy,seeds:group.map(r=>r.seed),runCount:group.length,successes:group.filter(r=>r.firstSuccessGeneration!==null).length,
      successRate:group.filter(r=>r.firstSuccessGeneration!==null).length/group.length,
      validationSuccessRate:group.filter(r=>r.validation.laps>0).length/group.length,
      metrics:Object.fromEntries(metrics.map(key=>[key,summarize(group.map(r=>r[key]))])),
      firstSuccessGeneration:summarize(group.map(r=>r.firstSuccessGeneration).filter(v=>v!==null))};
  });
}
export function csv(rows,columns) {
  const escape=value=>{if(value===null||value===undefined)return '';if(typeof value==='number'&&!Number.isFinite(value))throw new TypeError('CSV requires finite numbers');const s=String(value);return /[",\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;};
  return [columns.join(','),...rows.map(row=>columns.map(key=>escape(row[key])).join(','))].join('\n')+'\n';
}
export const RUN_COLUMNS=Object.freeze(['strategy','seed','maxFitness','meanFitness','maxCheckpoints','totalLaps','collisions','diversity','firstSuccessGeneration','allocatedIndividualSteps','activeIndividualSteps','unusedGenerationTicks']);
export function summaryRows(report) {
  return report.summary.map(s=>({strategy:s.strategy,runs:s.runCount,successRate:s.successRate,validationSuccessRate:s.validationSuccessRate,
    meanMaxFitness:s.metrics.maxFitness.mean,medianMaxFitness:s.metrics.maxFitness.median,sdMaxFitness:s.metrics.maxFitness.standardDeviation,
    meanFinalPopulationFitness:s.metrics.meanFitness.mean,
    meanCheckpoints:s.metrics.maxCheckpoints.mean,totalLaps:report.runs.filter(r=>r.strategy===s.strategy).reduce((n,r)=>n+r.totalLaps,0)}));
}
export function statisticRows(report) {
  return report.summary.flatMap(s=>{
    const runs=report.runs.filter(r=>r.strategy===s.strategy);
    const all={...s.metrics,firstSuccessGeneration:s.firstSuccessGeneration,
      successIndicator:summarize(runs.map(r=>r.firstSuccessGeneration===null?0:1)),
      validationSuccessIndicator:summarize(runs.map(r=>r.validation.laps>0?1:0))};
    return Object.entries(all).map(([metric,statistics])=>({strategy:s.strategy,metric,...statistics}));
  });
}
export function validateComparisonReport(text) {
  if(typeof text!=='string'||text.length>20_000_000)throw new RangeError('Invalid report size');
  const report=JSON.parse(text);
  if(report?.format!=='NeuroDriveAI.comparison'||report.version!==1||!Array.isArray(report.runs)||!report.runs.length)throw new TypeError('Invalid comparison report');
  const p=report.protocol;
  if(!p||!Array.isArray(p.seeds)||!p.seeds.length||new Set(p.seeds).size!==p.seeds.length||!Array.isArray(p.strategies)||!p.strategies.length||new Set(p.strategies).size!==p.strategies.length||!Number.isInteger(p.generations)||p.generations<1||!Number.isFinite(p.dt)||p.dt<=0||p.dt>.1||!Number.isInteger(p.common?.populationSize)||p.common.populationSize<1||!Number.isFinite(p.common.maxDuration)||p.common.maxDuration<=0)throw new TypeError('Invalid common protocol');
  const budget=p.common.populationSize*p.generations*Math.round(p.common.maxDuration/p.dt);
  for(const key of ['stagnationTime','mutationRate','mutationAmplitude','tournamentSize','minMutationRate','maxMutationRate','mutationPatience','diversityThreshold','immigrantFraction']){
    if(!Number.isFinite(p.common[key]))throw new TypeError(`Missing common condition: ${key}`);
  }
  if(!['reference','improved','optimized'].includes(p.common.fitness))throw new TypeError('Missing common fitness');
  if(report.runs.length!==p.seeds.length*p.strategies.length)throw new TypeError('Incomplete paired comparison');
  const keys=new Set();
  for(const r of report.runs){
    const key=`${r.strategy}:${r.seed}`;
    if(!['A','B','C','D'].includes(r.strategy)||!Number.isInteger(r.seed)||r.seed<0||r.seed>0xffffffff||keys.has(key))throw new TypeError('Invalid or duplicate trial');
    keys.add(key);
    if(!p.seeds.includes(r.seed)||!p.strategies.includes(r.strategy)||r.allocatedIndividualSteps!==budget||r.activeIndividualSteps>budget)throw new TypeError('Unequal or invalid budgets');
    const expected=strategyConfig(r.strategy,p.common,r.seed);
    for(const [field,value]of Object.entries(expected)){if(r.config?.[field]!==value)throw new TypeError(`Incomparable configuration: ${field}`);}
    for(const field of RUN_COLUMNS.filter(f=>!['strategy','seed','firstSuccessGeneration'].includes(f))){if(!Number.isFinite(r[field])||r[field]<0)throw new TypeError(`Invalid ${field}`);}
    if(r.firstSuccessGeneration!==null&&(!Number.isInteger(r.firstSuccessGeneration)||r.firstSuccessGeneration<1||r.firstSuccessGeneration>p.generations))throw new TypeError('Invalid first success');
    if(!Number.isFinite(r.validation?.laps)||r.validation.laps<0)throw new TypeError('Invalid validation result');
  }
  return {...report,summary:summarizeStrategies(report.runs)}; // never trust precomputed imported aggregates
}
