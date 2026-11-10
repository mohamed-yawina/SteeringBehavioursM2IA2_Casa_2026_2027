import {EvolutionEngine} from '../evolution/EvolutionEngine.js';
import {createRegisteredTrack,TRACKS} from '../track/TrackRegistry.js';
import {importChampion} from '../ai/ChampionSerialization.js';
import {TransferSession} from './TransferSession.js';
export const MULTI_TRAIN_IDS=Object.freeze(['oval','desert','mountain']);
export const HELD_OUT_IDS=Object.freeze(['neon','championship']);
export function runGeneralizationTrial({seed,trainingIds,populationSize=20,generations=6,horizon=30},progress=()=>{}){
 if(!Array.isArray(trainingIds)||!trainingIds.length||new Set(trainingIds).size!==trainingIds.length||!Number.isInteger(generations)||generations<1||generations>100)throw new RangeError('Invalid generalization protocol');
 const tracks=trainingIds.map(createRegisteredTrack);
 const engine=new EvolutionEngine({seed,populationSize,eliteCount:0,selection:'roulette',mutationRate:.1,mutationAmplitude:.2,
  adaptiveMutation:false,fitness:'normalized',maxDuration:horizon,stagnationTime:4},tracks[0],tracks);
 engine.start();let current=0;
 while(engine.history.length<generations){engine.step(1/120);if(engine.history.length>current){current=engine.history.length;progress({seed,trainingIds,generation:current,fitness:engine.history.at(-1).maxFitness});}}
 const championJSON=engine.exportBest(),champion=importChampion(championJSON);
 const evaluations=TRACKS.map(info=>new TransferSession(champion.network,createRegisteredTrack(info.id),{horizon,training:champion.training}).run());
 return {condition:trainingIds.length===1?'mono:'+trainingIds[0]:'multi:'+trainingIds.join('+'),seed,trainingIds,generations,populationSize,horizon,
  allocatedIndividualCircuitSteps:populationSize*generations*trainingIds.length*horizon*120,
  activeIndividualCircuitSteps:engine.history.reduce((n,s)=>n+s.integrationSteps,0),
  normalizedFitness:engine.best.fitness,history:engine.history,bestTrainingResults:engine.best.result.perTrack,
  evaluations,championJSON};
}
