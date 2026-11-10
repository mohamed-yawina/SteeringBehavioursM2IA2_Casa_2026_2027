import test from 'node:test';
import assert from 'node:assert/strict';
import { EvolutionEngine, validateConfig } from '../src/evolution/EvolutionEngine.js';
import { Genome } from '../src/evolution/Genome.js';
import { Population } from '../src/evolution/Population.js';
import { sectorFraction } from '../src/evolution/Fitness.js';
import { createOvalTrack } from '../src/track/Track.js';
import { NeuralNetwork } from '../src/ai/NeuralNetwork.js';
import { importNetwork, exportNetwork } from '../src/ai/NetworkSerialization.js';
const fast={populationSize:4,eliteCount:1,maxDuration:.2,stagnationTime:.1,seed:101};
function runGeneration(engine){const count=engine.history.length;let steps=0;while(engine.history.length===count){engine.step(1/120);if(++steps>20000)throw Error('Generation never ended');}}

test('population initializes independent cars/networks/ids with identical immutable conditions', () => {
  const track=createOvalTrack(),e=new EvolutionEngine(fast,track),cars=e.population.individuals;
  assert.equal(cars.length,4);assert.equal(new Set(cars.map(i=>i.id)).size,4);
  assert.deepEqual(cars[0].simulation.car.position,cars[1].simulation.car.position);
  assert.notEqual(cars[0].simulation.car,cars[1].simulation.car);
  assert.notEqual(cars[0].simulation.neuralController.network,cars[1].simulation.neuralController.network);
  assert.notEqual(e.track,track);assert.ok(Object.isFrozen(e.track.walls[0].a));assert.ok(Object.isFrozen(e.config));
  track.start.position.x+=100;assert.notEqual(e.track.start.position.x,track.start.position.x);
});
test('invalid/empty/sparse populations and invalid configurations fail explicitly', () => {
  assert.throws(()=>new Population([],createOvalTrack(),1,validateConfig(fast)));
  assert.throws(()=>new Population(Array(2),createOvalTrack(),1,validateConfig(fast)));
  for(const options of [{populationSize:0},{populationSize:1,eliteCount:2},{mutationRate:NaN},{maxDuration:Infinity},{selection:'other'}])assert.throws(()=>new EvolutionEngine(options));
});
test('all timed-out active cars have recorded results before generation transition', () => {
  const e=new EvolutionEngine({...fast,maxDuration:.1,stagnationTime:10});e.start();runGeneration(e);
  assert.equal(e.generation,1);assert.equal(e.phase,'completed');assert.equal(e.lastResults.length,4);
  assert.ok(e.lastResults.every(r=>r.reason==='timeout'&&r.elapsed>0&&Number.isFinite(r.fitness)));
  assert.equal(e.population.activeCount,0);e.step(1/120);assert.equal(e.generation,2);assert.equal(e.population.individuals.length,4);
});
test('stagnant cars terminate without fake collision and retain zero progress/results', () => {
  const e=new EvolutionEngine(fast),zero=Genome.fromNetwork(new NeuralNetwork({parameters:[
    {weights:Array.from({length:12},()=>Array(8).fill(0)),biases:Array(12).fill(0)},
    {weights:Array.from({length:2},()=>Array(12).fill(0)),biases:[0,0]}]}));
  e.population=new Population(Array.from({length:4},()=>zero.copy()),e.track,1,e.config);
  e.start();runGeneration(e);assert.ok(e.lastResults.every(r=>r.reason==='stagnation'&&!r.crashed&&r.progression===0&&r.fitness===0));
});
test('zero-fitness generations reproduce successfully with roulette and tournament', () => {
  for(const selection of ['roulette','tournament']){
    const e=new EvolutionEngine({...fast,selection});e.start();runGeneration(e);
    e.population.individuals.forEach(i=>{i.fitness=0;});e.nextGeneration();assert.equal(e.population.individuals.length,4);
    assert.ok(e.population.individuals.every(i=>i.genome.values.every(Number.isFinite)));
  }
});
test('elite copies are exact, independent and bypass mutation; zero/all elite cases work', () => {
  const e=new EvolutionEngine({...fast,mutationRate:1,mutationAmplitude:5,eliteCount:2});e.start();runGeneration(e);
  const ranked=[...e.population.individuals].sort((a,b)=>b.fitness-a.fitness),before=ranked.slice(0,2).map(i=>i.genome);
  e.nextGeneration();before.forEach((g,i)=>{assert.deepEqual(e.population.individuals[i].genome.values,g.values);assert.notEqual(e.population.individuals[i].genome.values,g.values);});
  for(const eliteCount of [0,4]){const x=new EvolutionEngine({...fast,eliteCount});x.start();runGeneration(x);x.nextGeneration();assert.equal(x.population.individuals.length,4);}
});
test('pause/resume freezes evaluation and RNG, reset reproduces initial population', () => {
  const e=new EvolutionEngine(fast),before=e.population.individuals.map(i=>i.genome.values);e.start();e.step(1/120);e.pause();
  const elapsed=e.elapsed,state=e.random.state;e.step(1/120);assert.equal(e.elapsed,elapsed);assert.equal(e.random.state,state);
  e.resume();e.step(1/120);assert.ok(e.elapsed>elapsed);e.reset();assert.deepEqual(e.population.individuals.map(i=>i.genome.values),before);assert.equal(e.running,false);
});
test('same seed/config reproduces multiple generation statistics, genomes and champions', () => {
  const a=new EvolutionEngine(fast),b=new EvolutionEngine(fast);a.start();b.start();
  for(let g=0;g<5;g++){runGeneration(a);runGeneration(b);assert.deepEqual(a.history,b.history);assert.equal(a.exportBest(),b.exportBest());
    assert.deepEqual(a.population.individuals.map(i=>i.genome.values),b.population.individuals.map(i=>i.genome.values));}
});
test('archive export is existing v1 JSON; invalid import is atomic and imported scores unknown', () => {
  const e=new EvolutionEngine(fast);assert.throws(()=>e.exportBest());e.start();runGeneration(e);
  const json=e.exportBest(),network=importNetwork(json);assert.deepEqual(network.sizes,[8,12,2]);
  const before=e.best;assert.throws(()=>e.importBest('{}'));assert.equal(e.best,before);
  e.importBest(json);assert.equal(e.best.fitness,null);assert.equal(e.best.source,'imported');assert.equal(e.exportBest(),json);
  assert.throws(()=>e.importBest(exportNetwork(new NeuralNetwork({sizes:[8,2]}))));
});
test('sector progress starts at zero, is bounded, and does not award skipped checkpoints', () => {
  const e=new EvolutionEngine(fast),s=e.population.individuals[0].simulation;assert.equal(sectorFraction(s),0);
  s.car.position=s.track.checkpoints[3].a.copy();assert.ok(sectorFraction(s)<=.999);assert.equal(s.checkpoints.validated,0);
});
test('20,000 evolution ticks across many generations stay finite and record every elimination', () => {
  const e=new EvolutionEngine({populationSize:2,eliteCount:1,maxDuration:.2,stagnationTime:.1});e.start();
  for(let i=0;i<20000;i++){
    e.step(1/120);assert.ok(Number.isFinite(e.elapsed));
    for(const p of e.population.individuals){assert.ok(Number.isFinite(p.fitness));assert.ok(p.genome.values.every(Number.isFinite));}
  }
  assert.ok(e.history.length>100);assert.equal(e.history.length,e.generation-(e.phase==='completed'?0:1));
  assert.ok(e.history.every(s=>s.population===2&&Number.isFinite(s.meanFitness)&&Number.isFinite(s.diversity)));
});

test('small cumulative progress refreshes stagnation, but oscillation cannot accumulate rewards', () => {
  const e=new EvolutionEngine({...fast,stagnationTime:.1,maxDuration:10}),i=e.population.individuals[0],s=i.simulation;
  const a=s.track.start.position,b=s.track.checkpoints[1];
  const goal={x:(b.a.x+b.b.x)/2,y:(b.a.y+b.b.y)/2};let fraction=0;
  // Isolate evaluation bookkeeping from locomotion with a deterministic trajectory fixture.
  s.step=dt=>{s.elapsed+=dt;s.car.position.set(a.x+(goal.x-a.x)*fraction,a.y+(goal.y-a.y)*fraction);};
  for(let n=1;n<=20;n++){fraction=n*.003;e.population.step(.01);}
  assert.equal(i.active,true);assert.ok(i.lastProgressAt>.1);
  const maximum=i.progression;
  for(let n=0;n<20;n++){fraction=n%2?.03:0;e.population.step(.01);}
  assert.equal(i.termination,'stagnation');assert.equal(i.progression,maximum);assert.equal(i.checkpoints,0);
});
test('actual wall collision finalizes one result with correct crash and distance values', () => {
  const e=new EvolutionEngine(fast),i=e.population.individuals[0];
  i.simulation.car.velocity.set(10000,0);i.simulation.car.maxSpeed=20000;
  e.population.step(.01);assert.equal(i.active,false);assert.equal(i.termination,'collision');
  assert.equal(i.result.crashed,true);assert.ok(i.result.elapsed>0);assert.equal(i.result.distance,i.simulation.car.distanceTravelled);
  const result=i.result;e.population.finish(i,'timeout');assert.equal(i.result,result);
});
