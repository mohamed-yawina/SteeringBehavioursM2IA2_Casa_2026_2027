import {Population} from './Population.js';import {normalizedTrackScore,aggregateScores} from './NormalizedScore.js';
export class MultiCircuitPopulation{
 constructor(genomes,tracks,generation,config){
  if(!Array.isArray(tracks)||!tracks.length||new Set(tracks.map(t=>t.id)).size!==tracks.length)throw new RangeError('Unique training tracks required');
  this.tracks=tracks;this.generation=generation;this.config=config;this.integrationSteps=0;
  this.episodes=tracks.map(track=>new Population(genomes,track,generation,{...config,fitness:'optimized'}));
  this.individuals=genomes.map((genome,index)=>({id:`${generation}:${index}`,generation,genome:genome.copy(),simulation:this.episodes[0].individuals[index].simulation,
   active:true,fitness:0,progression:0,checkpoints:0,fraction:0,result:null,termination:null,perTrack:[]}));
 }
 get activeCount(){return this.individuals.filter(i=>i.active).length;}
 update(index){
  const individual=this.individuals[index];
  individual.perTrack=this.episodes.map((population,k)=>{const episode=population.individuals[index],record=episode.result??population.record(episode);return {...record,trackId:this.tracks[k].id,score:normalizedTrackScore(record,this.tracks[k].checkpoints.length)};});
  individual.fitness=aggregateScores(individual.perTrack.map(r=>r.score));
  individual.active=this.episodes.some(p=>p.individuals[index].active);
  individual.checkpoints=individual.perTrack.reduce((n,r)=>n+r.checkpoints,0);
  individual.progression=individual.perTrack.reduce((n,r,k)=>n+Math.min(1,r.progression/this.tracks[k].checkpoints.length),0)/this.tracks.length;
  if(!individual.active&&!individual.result){
   individual.termination='multi-circuit';individual.result=Object.freeze({id:individual.id,generation:this.generation,checkpoints:individual.checkpoints,
    laps:individual.perTrack.reduce((n,r)=>n+r.laps,0),fraction:0,progression:individual.progression,
    elapsed:Math.max(...individual.perTrack.map(r=>r.elapsed)),crashed:individual.perTrack.some(r=>r.crashed),reason:'multi-circuit',
    distance:individual.perTrack.reduce((n,r)=>n+r.distance,0),perTrack:Object.freeze(individual.perTrack.map(r=>Object.freeze(r)))});
  }
 }
 step(dt){this.episodes.forEach(p=>p.step(dt));this.integrationSteps=this.episodes.reduce((n,p)=>n+p.integrationSteps,0);this.individuals.forEach((_,i)=>this.update(i));}
 finish(individual,reason){const index=this.individuals.indexOf(individual);if(index<0)throw new RangeError('Unknown individual');this.episodes.forEach(p=>p.finish(p.individuals[index],reason));this.update(index);}
}
