import {getMission,missionGoal,missionReward} from './MissionDefinitions.js';
import {createRegisteredTrack} from '../track/TrackRegistry.js';
import {RaceManager} from './RaceManager.js';
export class MissionManager{
  constructor(id,entrant,{countdown=3}={}){
    this.definition=getMission(id);this.entrant=entrant;
    this.race=new RaceManager({trackId:this.definition.trackId,entrants:[entrant],goal:missionGoal(this.definition,createRegisteredTrack(this.definition.trackId)),maxDuration:this.definition.maxDuration,countdown});this.result=null;
  }
  start(){this.race.start();}
  updateResult(){if(this.result||!this.race.result)return;const r=this.race.result.ranking[0],success=r.status==='finished';this.result=Object.freeze({missionId:this.definition.id,control:r.control,trackId:this.definition.trackId,outcome:success?'victory':'defeat',reason:r.status,elapsed:r.elapsed,checkpoints:r.checkpoints,laps:r.laps,progress:r.progress,weightsUnchanged:r.weightsUnchanged,...missionReward(this.definition,success,r.elapsed,r.progress)});}
  step(dt,commands){this.race.step(dt,commands);this.updateResult();}
  abandon(){this.race.abandonAll();this.updateResult();}
  reset(){this.race.reset();this.result=null;}
}
