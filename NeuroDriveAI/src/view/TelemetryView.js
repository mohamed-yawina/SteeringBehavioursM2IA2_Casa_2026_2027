const finite=n=>Number.isFinite(n)?n:0;
const modes={manual:'Manuel',autonomous:'Autonome',training:'Entraînement IA','multi-training':'Entraînement multi-circuits',transfer:'Transfert direct',career:'Carrière','human-ai':'Human vs AI','ai-ai':'AI vs AI'};
export function telemetrySnapshot({simulation,mode='manual',engine=null,race=null,selectedIndex=0}={}){
  if(!simulation&&!race)return null;
  const entrant=race?.entrants[Math.min(Math.max(0,Math.trunc(finite(selectedIndex))),race.entrants.length-1)],sim=entrant?.simulation??simulation;
  const cp=sim.checkpoints,training=['training','multi-training'].includes(mode)&&engine;
  const individuals=engine?.population.individuals??[];
  const fitness=training?finite(engine.leader?.fitness):null;
  const mean=training&&individuals.length?Math.max(0,...individuals.map(i=>finite(i.fitness))):0;
  const meanFitness=training?(mean===0?0:mean*Math.min(1,individuals.reduce((s,i)=>s+finite(i.fitness)/mean,0)/individuals.length)):null;
  const episodes=engine?.population.episodes?.flatMap(p=>p.individuals)??individuals;
  const goal=race?.requiredCheckpoints??sim.track.checkpoints.length;
  return Object.freeze({mode:modes[mode]??mode,track:sim.track.id,identity:entrant?.name??(training?'Leader courant':'Voiture sélectionnée'),speed:finite(sim.car.speed),
    progress:Math.max(0,Math.min(1,finite(cp.validated)/goal)),checkpoints:cp.validated,laps:cp.laps,time:finite(race?.elapsed??(training?engine.elapsed:sim.elapsed)),
    collisions:race?race.entrants.filter(e=>e.simulation.car.crashed).length:training?episodes.filter(i=>i.simulation.car.crashed).length:Number(sim.car.crashed),
    generation:training?engine.generation:null,active:training?engine.population.activeCount:null,population:training?individuals.length:null,fitness,meanFitness,
    state:sim.car.crashed?'Collision':race?.paused?'Pause':!sim.car.active?'Terminée':'Active'});
}
export class TelemetryView{
  constructor(root=document){this.container=root.querySelector('#telemetry-hud');this.nodes=new Map();for(const key of ['mode','track','identity','speed','progress','checkpoints','laps','time','collisions','generation','active','fitness','meanFitness','state'])this.nodes.set(key,root.querySelector('#metric-'+key));this.writes=0;}
  render(snapshot){
    if(!this.container)return;this.container.hidden=!snapshot;if(!snapshot)return;
    for(const [key,node]of this.nodes){if(!node)continue;const raw=snapshot[key],card=node.closest?.('[data-telemetry-card]');if(card)card.hidden=raw===null;
      const value=raw===null?'—':key==='speed'?raw.toFixed(1)+' px/s':key==='time'?raw.toFixed(2)+' s':key==='progress'?Math.round(raw*100)+' %':key==='fitness'||key==='meanFitness'?raw.toFixed(2):key==='active'?`${raw} / ${snapshot.population}`:String(raw);
      if(node.textContent!==value){node.textContent=value;this.writes++;}
    }
  }
}
