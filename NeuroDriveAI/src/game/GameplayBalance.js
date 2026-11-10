import {MissionManager} from './MissionManager.js';
import {importChampion} from '../ai/ChampionSerialization.js';
import {NeuralNetwork} from '../ai/NeuralNetwork.js';
// Headless evaluation only; this module does not train or alter any network.
export function evaluateMission({missionId,championId,source,seed,json,random=false}){
  const network=random?new NeuralNetwork({seed}):importChampion(json).network;
  const session=new MissionManager(missionId,{id:'player',name:championId,control:'ai',championId,network},{countdown:0});session.start();
  for(let i=0;i<=Math.ceil(session.definition.maxDuration*120)&&!session.result;i++)session.step(1/120);
  if(!session.result)throw new Error('Évaluation non finalisée');
  return {championId,source,seed,...session.result};
}
