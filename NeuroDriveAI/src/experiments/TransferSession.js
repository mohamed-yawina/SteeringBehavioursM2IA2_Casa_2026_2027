import {Simulation} from '../simulation/Simulation.js';import {sectorFraction,optimizedFitness} from '../evolution/Fitness.js';
import {exportNetwork} from '../ai/NetworkSerialization.js';import {normalizedTrackScore} from '../evolution/NormalizedScore.js';
export class TransferSession{
 constructor(network,track,{horizon=30,training=null}={}){
  if(!Number.isFinite(horizon)||horizon<=0||horizon>120)throw new RangeError('Invalid transfer horizon');
  this.simulation=new Simulation(track);this.simulation.setNetwork(network);this.simulation.setMode('autonomous');
  this.horizon=horizon;this.training=training;this.weights=exportNetwork(network);this.result=null;this.progression=0;this.fraction=0;this.firstLapTime=null;
 }
 step(dt){
  if(!Number.isFinite(dt)||dt<=0||dt>.1)throw new RangeError('Invalid transfer step');if(this.result)return;
  const s=this.simulation;s.step(Math.min(dt,this.horizon-s.elapsed));
  const f=sectorFraction(s),p=s.checkpoints.validated+f;if(p>this.progression){this.progression=p;this.fraction=f;}
  if(s.checkpoints.laps>0&&this.firstLapTime===null)this.firstLapTime=s.elapsed;
  if(s.car.crashed||s.elapsed>=this.horizon-1e-9){
   const record={trackId:s.track.id,trainingTrackIds:this.training?.trackIds??null,checkpoints:s.checkpoints.validated,laps:s.checkpoints.laps,
    elapsed:s.elapsed,firstLapTime:this.firstLapTime,crashed:s.car.crashed,reason:s.car.crashed?'collision':'timeout',fraction:this.fraction,
    normalizedProgress:Math.min(1,this.progression/s.track.checkpoints.length),weightsUnchanged:exportNetwork(s.neuralController.network)===this.weights};
   this.result=Object.freeze({...record,fitness:optimizedFitness(record,this.horizon),normalizedScore:normalizedTrackScore(record,s.track.checkpoints.length)});
   s.car.active=false;
  }
 }
 run(dt=1/120){if(!Number.isFinite(dt)||dt<=0||dt>.1)throw new RangeError('Invalid transfer step');for(let i=0;i<Math.ceil(this.horizon/dt)+1&&!this.result;i++)this.step(dt);return this.result;}
}
