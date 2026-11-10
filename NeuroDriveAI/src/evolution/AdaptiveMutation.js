export function validateAdaptiveConfig(c) {
  if (typeof c.adaptiveMutation !== 'boolean') throw new RangeError('adaptiveMutation must be boolean');
  for (const [key,min,max] of [['minMutationRate',0,1],['maxMutationRate',0,1],['diversityThreshold',0,5],['immigrantFraction',0,.2]]) {
    if (!Number.isFinite(c[key]) || c[key] < min || c[key] > max) throw new RangeError(`Invalid ${key}`);
  }
  if (c.minMutationRate > c.maxMutationRate || (c.adaptiveMutation && (c.mutationRate < c.minMutationRate || c.mutationRate > c.maxMutationRate))) throw new RangeError('Invalid adaptive rate interval');
  if (!Number.isInteger(c.mutationPatience) || c.mutationPatience < 1 || c.mutationPatience > 100) throw new RangeError('Invalid mutationPatience');
}

export class AdaptiveMutation {
  constructor(config) { validateAdaptiveConfig(config); this.config=config; this.best=0; this.seen=false; this.stagnantGenerations=0; }
  observe(statistics) {
    const {maxFitness,diversity}=statistics;
    if (!Number.isFinite(maxFitness) || maxFitness<0 || !Number.isFinite(diversity) || diversity<0) throw new RangeError('Invalid adaptation statistics');
    const c=this.config;
    const improved=!this.seen || maxFitness>this.best+Math.max(1e-9,Math.abs(this.best)*.01);
    this.stagnantGenerations=improved?0:this.stagnantGenerations+1;
    if(improved)this.best=maxFitness;
    this.seen=true;
    const lowDiversity=diversity<c.diversityThreshold;
    const pressure=!improved && (lowDiversity || this.stagnantGenerations>=c.mutationPatience);
    const level=Math.max(1,this.stagnantGenerations-c.mutationPatience+1);
    const rate=!c.adaptiveMutation || !pressure ? c.mutationRate
      : Math.min(c.maxMutationRate,Math.max(c.minMutationRate,c.mutationRate,.01)*(1+.5*level));
    const immigrants=lowDiversity && this.stagnantGenerations>=c.mutationPatience
      ? Math.min(c.populationSize-c.eliteCount,Math.floor(c.populationSize*c.immigrantFraction)) : 0;
    return Object.freeze({rate,amplitude:c.mutationAmplitude,improved,lowDiversity,stagnantGenerations:this.stagnantGenerations,immigrants});
  }
}
