import test from 'node:test';
import assert from 'node:assert/strict';
import { NeuralNetwork } from '../src/ai/NeuralNetwork.js';
import { Genome, GENE_COUNT } from '../src/evolution/Genome.js';
import { Random } from '../src/evolution/Random.js';
import { referenceFitness, improvedFitness } from '../src/evolution/Fitness.js';
import { selectParent } from '../src/evolution/Selection.js';
import { crossover } from '../src/evolution/Crossover.js';
import { mutate } from '../src/evolution/Mutation.js';
import { geneticDiversity, generationStatistics } from '../src/evolution/EvolutionStatistics.js';
const genes = n => new Genome(Array(GENE_COUNT).fill(n));

test('genome extraction/reconstruction preserves all 134 parameters and exact outputs', () => {
  const net = new NeuralNetwork({seed:42}), genome = Genome.fromNetwork(net), copy = genome.toNetwork();
  assert.equal(genome.values.length,134); assert.deepEqual(copy.parameters,net.parameters);
  assert.deepEqual(copy.forward([0,.1,.2,.3,.4,.5,.6,1]),net.forward([0,.1,.2,.3,.4,.5,.6,1]));
});
test('genomes, copies and reconstructed networks have independent immutable storage', () => {
  const source = Array(134).fill(0), a = new Genome(source), b = a.copy(); source[0]=2;
  assert.equal(a.values[0],0); assert.notEqual(a,b); assert.notEqual(a.values,b.values);
  const n1=a.toNetwork(),n2=b.toNetwork(); assert.notEqual(n1.parameters[0].weights[0],n2.parameters[0].weights[0]);
  assert.throws(()=>{b.values[0]=1;});
});
test('genome validates dimensions, finite bounds, seeds and tanh architecture', () => {
  for(const v of [[],Array(134),Array(134).fill(NaN),Array(134).fill(Infinity),Array(134).fill(5.1)]) assert.throws(()=>new Genome(v));
  assert.throws(()=>new Genome(Array(134).fill(0),-1));
  for(const net of [new NeuralNetwork({sizes:[8,2]}),new NeuralNetwork({activation:'sigmoid'})]) assert.throws(()=>Genome.fromNetwork(net));
});
test('reference fitness is TP9 exponential with a finite overflow cap', () => {
  assert.deepEqual([0,1,2,10].map(checkpoints=>referenceFitness({checkpoints})),[1,2,4,1024]);
  assert.ok(Number.isFinite(referenceFitness({checkpoints:1e10}))); assert.equal(referenceFitness({checkpoints:NaN}),1);
});
test('improved fitness exact formula accounts for progress, laps, time, collision and stagnation', () => {
  const r={checkpoints:2,fraction:.4,laps:1,elapsed:5,crashed:false};
  assert.equal(improvedFitness(r,20),(200+20+500)/1.25);
  assert.equal(improvedFitness({...r,crashed:true},20),improvedFitness(r,20)*.75);
  assert.equal(improvedFitness({...r,reason:'stagnation'},20),improvedFitness(r,20)*.5);
  assert.ok(improvedFitness({...r,elapsed:10},20)<improvedFitness(r,20));
});
test('stationary distance/survival do not earn improved fitness; invalid numeric metrics remain finite', () => {
  assert.equal(improvedFitness({checkpoints:0,fraction:0,laps:0,elapsed:20,distance:1e9},20),0);
  assert.equal(improvedFitness({checkpoints:NaN,fraction:Infinity,laps:-1,elapsed:Infinity},20),0);
  assert.throws(()=>improvedFitness({},0));
});
test('roulette handles r=0, zero mass, identical fitness, singletons and extreme values', () => {
  const pool=[{fitness:0,id:0},{fitness:1,id:1},{fitness:3,id:2}];
  assert.equal(selectParent(pool,{next:()=>0},'roulette').id,1);
  assert.equal(selectParent(pool,{next:()=>.99},'roulette').id,2);
  assert.equal(selectParent([{fitness:0}],new Random(2),'roulette').fitness,0);
  const extreme=[{fitness:Number.MAX_VALUE},{fitness:Number.MAX_VALUE},{fitness:Infinity},{fitness:NaN}];
  for(let i=0;i<100;i++)assert.ok(extreme.includes(selectParent(extreme,new Random(i),'roulette')));
  const equal=Array.from({length:3},(_,id)=>({fitness:0,id}));
  assert.equal(selectParent(equal,{next:()=>.6},'roulette').id,1);
});
test('roulette empirical proportions match 1:3 fitness with seeded reproducibility', () => {
  const random=new Random(9),pool=[{fitness:1,id:0},{fitness:3,id:1}];let n=0;
  for(let i=0;i<10000;i++)n+=selectParent(pool,random,'roulette').id;
  assert.ok(n>7300&&n<7700);
});
test('tournament selects best sampled candidate with replacement, including small/zero pools', () => {
  const pool=[{fitness:1},{fitness:10},{fitness:2}],draws=[0,.8,.5];
  assert.equal(selectParent(pool,{next:()=>draws.shift()},'tournament',3),pool[1]);
  assert.equal(selectParent([{fitness:0}],new Random(2),'tournament',5).fitness,0);
  assert.throws(()=>selectParent([],new Random(1)));assert.throws(()=>selectParent(pool,new Random(1),'other'));
});
test('uniform crossover preserves architecture and picks only independent parental genes', () => {
  const a=genes(-1),b=genes(1),c=crossover(a,b,new Random(7));
  assert.ok(c.values.includes(-1)&&c.values.includes(1));assert.ok(c.values.every(v=>v===-1||v===1));
  assert.notEqual(c.values,a.values);assert.deepEqual(c.toNetwork().sizes,[8,12,2]);
  assert.deepEqual(c.values,crossover(a,b,new Random(7)).values);
});
test('mutation zero probability/amplitude preserves parents; full mutation respects finite bounds', () => {
  const a=genes(4.99);
  assert.deepEqual(mutate(a,new Random(1),0,5).values,a.values);
  assert.deepEqual(mutate(a,new Random(1),1,0).values,a.values);
  const changed=mutate(a,new Random(7),1,5);assert.notDeepEqual(changed.values,a.values);
  assert.ok(changed.values.every(v=>Number.isFinite(v)&&Math.abs(v)<=5));assert.ok(a.values.every(v=>v===4.99));
  assert.deepEqual(changed.values,mutate(a,new Random(7),1,5).values);
  for(const [rate,amp] of [[-1,.2],[NaN,.2],[1,Infinity],[1,6]])assert.throws(()=>mutate(a,new Random(1),rate,amp));
});
test('random generators are independent, repeatable and produce finite normal deviates', () => {
  const a=new Random(0),b=new Random(0);for(let i=0;i<1000;i++){assert.equal(a.next(),b.next());assert.ok(Number.isFinite(a.normal()));b.normal();}
  assert.throws(()=>new Random(-1));assert.throws(()=>new Random(2**32));
});
test('statistics record all outcomes, finite means and genotype diversity', () => {
  const a={fitness:Number.MAX_VALUE,genome:genes(0),checkpoints:1,result:{laps:0,crashed:true},termination:'collision'};
  const b={fitness:Number.MAX_VALUE,genome:genes(2),checkpoints:0,result:{laps:1,crashed:false},termination:'timeout'};
  const s=generationStatistics([a,b],1,2);assert.ok(Number.isFinite(s.meanFitness));assert.equal(s.progressingCars,1);
  assert.equal(s.collisions,1);assert.equal(s.laps,1);assert.equal(s.timeouts,1);assert.equal(s.diversity,1);
  assert.equal(geneticDiversity([a,a]),0);assert.throws(()=>generationStatistics([],1,0));
});
