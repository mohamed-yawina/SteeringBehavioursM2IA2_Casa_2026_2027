import { NeuralNetwork } from '../ai/NeuralNetwork.js';
import { exportNetwork, importNetwork } from '../ai/NetworkSerialization.js';
import { Track, createOvalTrack } from '../track/Track.js';
import { Random } from './Random.js';
import { Genome } from './Genome.js';
import { Population } from './Population.js';
import { selectParent } from './Selection.js';
import { crossover } from './Crossover.js';
import { mutate } from './Mutation.js';
import { generationStatistics } from './EvolutionStatistics.js';
import { AdaptiveMutation, validateAdaptiveConfig } from './AdaptiveMutation.js';
import {MultiCircuitPopulation} from './MultiCircuitPopulation.js';
import {exportChampion,importChampion} from '../ai/ChampionSerialization.js';

export function validateConfig(options = {}) {
  const c = { populationSize: 50, seed: 2026, selection: 'tournament', tournamentSize: 5,
    mutationRate: .1, mutationAmplitude: .2, eliteCount: 2, maxDuration: 20,
    stagnationTime: 4, fitness: 'improved', adaptiveMutation:false,minMutationRate:.02,maxMutationRate:.3,
    mutationPatience:2,diversityThreshold:.25,immigrantFraction:0,...options };
  const integer = (key,min,max) => { if (!Number.isInteger(c[key]) || c[key] < min || c[key] > max) throw new RangeError(`Invalid ${key}`); };
  const number = (key,min,max) => { if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max) throw new RangeError(`Invalid ${key}`); };
  integer('populationSize',1,200); integer('seed',0,0xffffffff); integer('tournamentSize',1,100);
  integer('eliteCount',0,c.populationSize); number('mutationRate',0,1); number('mutationAmplitude',0,5);
  number('maxDuration',.1,120); number('stagnationTime',.1,120);
  if (!['roulette','tournament'].includes(c.selection) || !['reference','improved','optimized','normalized'].includes(c.fitness)) throw new RangeError('Invalid strategy/fitness');
  validateAdaptiveConfig(c);
  return Object.freeze(c);
}
function freezeData(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) { Object.values(value).forEach(freezeData); Object.freeze(value); }
  return value;
}
export class EvolutionEngine {
  constructor(options = {}, track = createOvalTrack(), evaluationTracks=null) {
    this.config = validateConfig(evaluationTracks===null?options:{...options,fitness:'normalized'});
    this.track = freezeData(new Track(track)); // detached, immutable evaluation conditions
    this.evaluationTracks=evaluationTracks===null?null:Object.freeze(evaluationTracks.map(t=>freezeData(new Track(t))));
    if(this.evaluationTracks&&(!this.evaluationTracks.length||new Set(this.evaluationTracks.map(t=>t.id)).size!==this.evaluationTracks.length))throw new RangeError('Unique nonempty evaluation track set required');
    this.trainingTrackIds=Object.freeze(this.evaluationTracks?.map(t=>t.id)??[this.track.id]);
    this.reset();
  }
  createPopulation(genomes,generation){return this.evaluationTracks||this.config.fitness==='normalized'
    ?new MultiCircuitPopulation(genomes,this.evaluationTracks??[this.track],generation,this.config)
    :new Population(genomes,this.track,generation,this.config);}
  reset() {
    this.random = new Random(this.config.seed); this.generation = 1; this.elapsed = 0;
    this.history = []; this.best = null; this.lastResults = []; this.phase = 'evaluating';
    this.running = false; this.paused = false;
    this.mutationPolicy=new AdaptiveMutation(this.config);this.currentMutationRate=this.config.mutationRate;
    this.adaptation=null;this.immigrants=0;
    const genomes = Array.from({ length: this.config.populationSize }, () => Genome.fromNetwork(new NeuralNetwork({ seed: this.random.uint32() })));
    this.population = this.createPopulation(genomes, this.generation);
  }
  start() { this.running = true; this.paused = false; }
  pause() { this.paused = true; }
  resume() { this.start(); }
  get leader() {
    return this.population.individuals.reduce((best,i) => !best || i.fitness > best.fitness ? i : best, null);
  }
  completeGeneration() {
    if(this.phase!=='evaluating')throw new Error('Generation already finalized');
    if (this.population.activeCount) throw new Error('Active cars must be finalized before reproduction');
    const ranked = [...this.population.individuals].sort((a,b) => b.fitness - a.fitness);
    if (!ranked.length) throw new RangeError('Empty population');
    this.lastResults = Object.freeze(ranked.map(i => Object.freeze({ ...i.result, fitness: i.fitness, genome: i.genome.copy() })));
    const champion = ranked[0];
    if (!this.best || this.best.fitness === null || champion.fitness > this.best.fitness) {
      this.best = Object.freeze({ genome: champion.genome.copy(), fitness: champion.fitness,
        generation: this.generation, result: champion.result, source: 'evaluated',training:Object.freeze({version:1,trackIds:this.trainingTrackIds,seed:this.config.seed,generation:this.generation,fitness:this.config.fitness}) });
    }
    const statistics=generationStatistics(ranked, this.generation, this.elapsed);
    this.adaptation=this.mutationPolicy.observe(statistics);
    this.history.push(Object.freeze({...statistics,mutationRate:this.currentMutationRate,
      nextMutationRate:this.adaptation.rate,stagnantGenerations:this.adaptation.stagnantGenerations,
      lowDiversity:this.adaptation.lowDiversity,immigrants:this.immigrants,immigrantsNext:this.adaptation.immigrants,
      integrationSteps:this.population.integrationSteps}));
    this.phase = 'completed'; // keep results and final positions visible for one tick
  }
  nextGeneration() {
    if (this.phase !== 'completed') throw new Error('Generation not evaluated');
    const ranked = [...this.population.individuals].sort((a,b) => b.fitness - a.fitness);
    if (!ranked.length) throw new RangeError('Empty population');
    const genomes = ranked.slice(0,this.config.eliteCount).map(i => i.genome.copy());
    const rate=this.adaptation?.rate??this.config.mutationRate;
    const immigrants=this.adaptation?.immigrants??0;
    while (genomes.length < this.config.populationSize-immigrants) {
      const a = selectParent(ranked,this.random,this.config.selection,this.config.tournamentSize);
      const b = selectParent(ranked,this.random,this.config.selection,this.config.tournamentSize);
      genomes.push(mutate(crossover(a.genome,b.genome,this.random),this.random,rate,this.config.mutationAmplitude));
    }
    for(let i=0;i<immigrants;i++)genomes.push(Genome.fromNetwork(new NeuralNetwork({seed:this.random.uint32()})));
    this.currentMutationRate=rate;this.immigrants=immigrants;
    this.generation++; this.elapsed = 0;
    this.population = this.createPopulation(genomes,this.generation);
    this.phase = 'evaluating';
  }
  step(dt) {
    if (!Number.isFinite(dt) || dt <= 0 || dt > .1) throw new RangeError('Invalid evolution dt');
    if (!this.running || this.paused) return;
    if (this.phase === 'completed') this.nextGeneration();
    this.population.step(Math.min(dt, this.config.maxDuration - this.elapsed));
    this.elapsed = Math.min(this.config.maxDuration, this.elapsed + dt);
    if (this.elapsed >= this.config.maxDuration - 1e-9) {
      this.population.individuals.forEach(i => this.population.finish(i,'timeout'));
    }
    if (this.population.activeCount === 0) this.completeGeneration();
  }
  exportBest() {
    if (!this.best) throw new Error('No evaluated or imported champion');
    return exportChampion(this.best.genome.toNetwork(),this.best.training??null);
  }
  importBest(json) {
    const champion=importChampion(json),genome = Genome.fromNetwork(champion.network);
    this.best = Object.freeze({ genome: genome.copy(), fitness: null, generation: null, result: null, source: 'imported',training:champion.training });
  }
}
