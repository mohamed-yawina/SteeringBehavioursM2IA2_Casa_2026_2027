import '../tests/support/p5.mjs';
import {parentPort,workerData} from 'node:worker_threads';
import {evaluateMission} from '../src/game/GameplayBalance.js';
try{parentPort.postMessage({result:evaluateMission(workerData)});}catch(error){parentPort.postMessage({error:error.stack});}
