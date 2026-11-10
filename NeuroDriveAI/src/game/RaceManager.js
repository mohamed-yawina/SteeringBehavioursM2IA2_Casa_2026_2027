import {Simulation} from '../simulation/Simulation.js';
import {Track} from '../track/Track.js';
import {createRegisteredTrack} from '../track/TrackRegistry.js';
import {exportNetwork,importNetwork} from '../ai/NetworkSerialization.js';
import {rankEntrants,raceResults} from './RaceResults.js';

function freezeData(data){if(data&&typeof data==='object'&&!Object.isFrozen(data)){Object.values(data).forEach(freezeData);Object.freeze(data);}return data;}
export class RaceManager{
  constructor({trackId='oval',entrants,goal={type:'laps',target:1},maxDuration=90,countdown=3}={}){
    const track=createRegisteredTrack(trackId);
    if(!Number.isFinite(maxDuration)||maxDuration<1||maxDuration>300||!Number.isFinite(countdown)||countdown<0||countdown>10)throw new RangeError('Durée de course invalide');
    if(!goal||!['laps','checkpoints'].includes(goal.type)||!Number.isInteger(goal.target)||goal.target<1||goal.target>100)throw new RangeError('Objectif de course invalide');
    if(!Array.isArray(entrants)||entrants.length<1||entrants.length>2||Array.from(entrants).some(e=>!e||typeof e.id!=='string'||!/^[a-z][a-z0-9-]{0,31}$/.test(e.id)||typeof e.name!=='string'||!e.name.trim()||e.name.length>80||!['human','ai'].includes(e.control))||new Set(entrants.map(e=>e.id)).size!==entrants.length||entrants.filter(e=>e.control==='human').length>1)throw new RangeError('Concurrents invalides');
    this.track=freezeData(new Track(track));this.goal=Object.freeze({...goal});this.maxDuration=maxDuration;this.countdown=countdown;
    this.requiredCheckpoints=goal.type==='laps'?goal.target*track.checkpoints.length:goal.target;
    this.definitions=Object.freeze(entrants.map(e=>Object.freeze({id:e.id,name:e.name.trim(),control:e.control,championId:e.championId??null,networkJSON:e.control==='ai'?exportNetwork(e.network):null})));
    this.reset();
  }
  reset(){
    this.entrants=this.definitions.map(def=>{
      const simulation=new Simulation(this.track);
      if(def.control==='ai'){simulation.setNetwork(importNetwork(def.networkJSON));simulation.setMode('autonomous');}
      return {...def,simulation,status:'running',finishTime:null,stoppedAt:null};
    });
    this.elapsed=0;this.countdownLeft=this.countdown;this.phase='ready';this.paused=false;this.result=null;
  }
  start(){if(this.phase!=='ready')throw new Error('Course déjà démarrée');this.phase=this.countdown>0?'countdown':'running';}
  pause(){this.paused=true;}
  resume(){if(this.phase==='ready')this.start();this.paused=false;}
  stopEntrant(entrant,status){
    if(entrant.status!=='running')return;
    entrant.status=status;entrant.stoppedAt=this.elapsed;if(status==='finished')entrant.finishTime=this.elapsed;
    entrant.simulation.car.active=false;
  }
  finalize(){if(this.phase==='finished')return;this.phase='finished';this.result=raceResults(this);}
  abandon(id){const entrant=this.entrants.find(e=>e.id===id);if(!entrant)throw new RangeError('Concurrent inconnu');if(this.phase==='finished')return;this.stopEntrant(entrant,'abandoned');if(this.entrants.every(e=>e.status!=='running'))this.finalize();}
  abandonAll(){for(const e of this.entrants)this.abandon(e.id);}
  step(dt,commands={}){
    if(!Number.isFinite(dt)||dt<=0||dt>.1)throw new RangeError('Pas de course invalide');
    if(!commands||typeof commands!=='object')throw new TypeError('Commandes invalides');
    for(const e of this.entrants.filter(e=>e.control==='human')){const command=commands[e.id]??{};if(typeof command!=='object'||['throttle','brake','steer'].some(key=>command[key]!==undefined&&!Number.isFinite(command[key])))throw new TypeError('Commande humaine non finie');}
    if(this.paused||this.phase==='ready'||this.phase==='finished')return;
    if(this.phase==='countdown'){this.countdownLeft=Math.max(0,this.countdownLeft-dt);if(this.countdownLeft<1e-9){this.countdownLeft=0;this.phase='running';}return;}
    const accepted=Math.min(dt,this.maxDuration-this.elapsed);this.elapsed=Math.min(this.maxDuration,this.elapsed+accepted);
    // Every still-running entrant receives the SAME accepted dt before classification.
    for(const e of this.entrants){
      if(e.status!=='running')continue;
      const sim=e.simulation;sim.step(accepted,e.control==='human'?(commands[e.id]??{}):{});
      // Conservative game rule: collision has priority over victory in the same tick.
      if(sim.car.crashed)this.stopEntrant(e,'collision');
      else if(sim.checkpoints.validated>=this.requiredCheckpoints)this.stopEntrant(e,'finished');
      else if(this.elapsed>=this.maxDuration-1e-9)this.stopEntrant(e,'timeout');
    }
    if(this.entrants.every(e=>e.status!=='running'))this.finalize();
  }
  metrics(){return this.entrants.map(e=>{
    const s=e.simulation,drivingTime=e.stoppedAt??this.elapsed;
    return {id:e.id,name:e.name,control:e.control,championId:e.championId,status:e.status,finishTime:e.finishTime,elapsed:drivingTime,
      checkpoints:s.checkpoints.validated,laps:s.checkpoints.laps,progress:Math.min(1,s.checkpoints.validated/this.requiredCheckpoints),
      trackProgress:Math.min(1,s.checkpoints.validated/this.track.checkpoints.length),crashed:s.car.crashed,distance:s.car.distanceTravelled,
      averageSpeed:drivingTime>0?s.car.distanceTravelled/drivingTime:0,
      weightsUnchanged:e.control==='human'||exportNetwork(s.neuralController.network)===e.networkJSON};
  });}
  get standings(){return this.result?.ranking??rankEntrants(this.metrics());}
}
