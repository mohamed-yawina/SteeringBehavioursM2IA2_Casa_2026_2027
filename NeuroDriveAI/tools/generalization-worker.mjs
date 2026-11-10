import '../tests/support/p5.mjs';import {parentPort,workerData} from 'node:worker_threads';import {runGeneralizationTrial} from '../src/experiments/Generalization.js';
try{parentPort.postMessage({type:'result',result:runGeneralizationTrial(workerData,event=>parentPort.postMessage({type:'progress',event}))});}
catch(error){parentPort.postMessage({type:'error',error:error.stack??String(error)});}
