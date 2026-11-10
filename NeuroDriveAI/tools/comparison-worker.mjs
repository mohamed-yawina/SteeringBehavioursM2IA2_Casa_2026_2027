import '../tests/support/p5.mjs';
import { parentPort,workerData } from 'node:worker_threads';
import { runComparisonTrial } from '../src/experiments/Comparison.js';
try {
  const result=runComparisonTrial(workerData,event=>parentPort.postMessage({type:'progress',event}));
  parentPort.postMessage({type:'result',result});
}catch(error){parentPort.postMessage({type:'error',error:error.stack??String(error)});}
