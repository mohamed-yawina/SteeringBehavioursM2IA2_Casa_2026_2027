const definitions = [
  {id:'first-steps',name:'FIRST STEPS',description:'Franchir trois checkpoints dans l’ordre.',trackId:'oval',objective:{type:'checkpoints',target:3},maxDuration:45,reward:100},
  {id:'first-lap',name:'FIRST LAP',description:'Terminer un tour légal sur Training Oval.',trackId:'oval',objective:{type:'laps',target:1},maxDuration:90,reward:200},
  {id:'desert-challenge',name:'DESERT CHALLENGE',description:'Terminer un tour légal sur Desert Circuit.',trackId:'desert',objective:{type:'laps',target:1},maxDuration:90,reward:300},
  {id:'mountain-explorer',name:'MOUNTAIN EXPLORER',description:'Valider 50 % des checkpoints de Mountain Pass (9 sur 18).',trackId:'mountain',objective:{type:'progress',target:.5},maxDuration:120,reward:400},
  {id:'evolution-champion',name:'EVOLUTION CHAMPION',description:'Terminer un tour légal sur Evolution Championship.',trackId:'championship',objective:{type:'laps',target:1},maxDuration:120,reward:500}
];
export const MISSIONS=Object.freeze(definitions.map(m=>Object.freeze({...m,objective:Object.freeze(m.objective),defeatConditions:Object.freeze(['collision','timeout','abandoned'])})));
export function getMission(id){const mission=MISSIONS.find(m=>m.id===id);if(!mission)throw new RangeError('Mission inconnue');return mission;}
export function missionGoal(mission,track){
  if(mission.trackId!==track.id)throw new RangeError('Circuit incompatible avec la mission');
  const {type,target}=mission.objective;
  return Object.freeze({type:'checkpoints',target:type==='laps'?target*track.checkpoints.length:type==='progress'?Math.ceil(target*track.checkpoints.length):target});
}
export function missionReward(mission,success,elapsed,goalProgress=0){
  if(!Number.isFinite(elapsed)||elapsed<0||elapsed>mission.maxDuration+1e-8||!Number.isFinite(goalProgress))throw new RangeError('Résultat de mission invalide');
  if(!success)return {score:Math.floor(99*Math.max(0,Math.min(1,goalProgress))),stars:0};
  return {score:mission.reward+Math.floor(1000*Math.max(0,1-elapsed/mission.maxDuration)),stars:elapsed<=mission.maxDuration*.5?3:elapsed<=mission.maxDuration*.75?2:1};
}
