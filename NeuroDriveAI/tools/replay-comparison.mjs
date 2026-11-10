import '../tests/support/p5.mjs';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,dirname,relative,sep} from 'node:path';
import {validateComparisonReport} from '../src/experiments/Statistics.js';
import {importNetwork} from '../src/ai/NetworkSerialization.js';
import {Genome} from '../src/evolution/Genome.js';
import {replayGenome} from '../src/experiments/Comparison.js';
import {createOvalTrack} from '../src/track/Track.js';
const input=resolve(process.argv[2]),horizon=Number(process.argv[3]??60),output=resolve(process.argv[4]);
if(!Number.isFinite(horizon)||horizon<=0||horizon>120)throw new RangeError('Invalid replay horizon');
if(existsSync(output))throw new Error('Existing replay report preserved');
const report=validateComparisonReport(readFileSync(input,'utf8')),root=dirname(input);
const runs=report.runs.map(run=>{
  const path=resolve(root,run.championPath);if(!path.startsWith(root+sep))throw new Error('Champion path outside report directory');
  const genome=Genome.fromNetwork(importNetwork(readFileSync(path,'utf8')));
  const result=replayGenome(genome,createOvalTrack(),{...run.config,maxDuration:horizon},report.protocol.dt);
  const record={strategy:run.strategy,seed:run.seed,horizon,...result};console.log(JSON.stringify(record));return record;
});
writeFileSync(output,JSON.stringify({format:'NeuroDriveAI.long-replay',version:1,source:relative(dirname(output),input),
  note:'Exploratory post-hoc frozen-network replay; not used to tune training or rank the main comparison.',runs},null,2));
