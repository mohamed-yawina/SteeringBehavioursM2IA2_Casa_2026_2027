import { EvolutionEngine } from '../evolution/EvolutionEngine.js';
import { Population } from '../evolution/Population.js';
import { createOvalTrack } from '../track/Track.js';
import { createValidationTrack } from '../track/TrackVariants.js';
import { strategyConfig } from './Strategies.js';

export function replayGenome(genome,track,config,dt) {
  const population=new Population([genome],track,1,config);
  for(let n=0;n<Math.ceil(config.maxDuration/dt)+1 && population.activeCount;n++)population.step(dt);
  const individual=population.individuals[0];
  if(individual.active)population.finish(individual,'timeout');
  return {...individual.result,fitness:individual.fitness};
}
function fingerprint(value) {
  let hash=2166136261;
  for(const character of JSON.stringify(value)){hash^=character.charCodeAt(0);hash=Math.imul(hash,16777619);}
  return (hash>>>0).toString(16).padStart(8,'0');
}
export function runComparisonTrial({common,seed,strategy,generations,dt=1/120},onGeneration=()=>{}) {
  if(!Number.isInteger(generations)||generations<1||generations>100||!Number.isFinite(dt)||dt<=0||dt>.1)throw new RangeError('Invalid experimental budget');
  const engine=new EvolutionEngine(strategyConfig(strategy,common,seed));
  const frames=Math.round(engine.config.maxDuration/dt);
  if(Math.abs(frames*dt-engine.config.maxDuration)>1e-8)throw new RangeError('Horizon must be an integer number of fixed steps');
  const initialPopulationFingerprint=fingerprint(engine.population.individuals.map(i=>i.genome.values));
  engine.start();let unusedGenerationTicks=0;
  for(let generation=1;generation<=generations;generation++){
    let ticks=0;
    while(engine.history.length<generation){engine.step(dt);if(++ticks>frames)throw new Error('Exceeded common generation budget');}
    unusedGenerationTicks+=frames-ticks;
    onGeneration({strategy,seed,...engine.history.at(-1)});
  }
  const history=engine.history;
  const validation=replayGenome(engine.best.genome,createValidationTrack(),engine.config,dt);
  const trainingReplay=replayGenome(engine.best.genome,createOvalTrack(),engine.config,dt);
  const first=history.find(s=>s.laps>0);
  return {strategy,seed,config:engine.config,initialPopulationFingerprint,
    maxFitness:Math.max(...history.map(s=>s.maxFitness)),meanFitness:history.at(-1).meanFitness,
    maxCheckpoints:Math.max(...history.map(s=>s.bestCheckpoints)),totalLaps:history.reduce((n,s)=>n+s.laps,0),
    collisions:history.reduce((n,s)=>n+s.collisions,0),diversity:history.at(-1).diversity,
    firstSuccessGeneration:first?.generation??null,allocatedIndividualSteps:frames*generations*engine.config.populationSize,
    activeIndividualSteps:history.reduce((n,s)=>n+s.integrationSteps,0),unusedGenerationTicks,
    trainingReplay,validation,history,championJSON:engine.exportBest()};
}
