export const STRATEGIES=Object.freeze({
  A:Object.freeze({selection:'roulette',eliteCount:0,adaptiveMutation:false}),
  B:Object.freeze({selection:'tournament',eliteCount:0,adaptiveMutation:false}),
  C:Object.freeze({selection:'tournament',eliteCount:2,adaptiveMutation:false}),
  D:Object.freeze({selection:'tournament',eliteCount:2,adaptiveMutation:true})
});
export function strategyConfig(name,common,seed) {
  if(!Object.hasOwn(STRATEGIES,name))throw new RangeError('Unknown comparison strategy');
  return {...common,seed,...STRATEGIES[name],eliteCount:Math.min(STRATEGIES[name].eliteCount,common.populationSize),immigrantFraction:0};
}
export function strategyLabel(config) {
  if(config.immigrantFraction>0)return 'Personnalisée (immigration)';
  if(config.selection==='roulette' && config.eliteCount===0 && !config.adaptiveMutation)return 'A';
  if(config.selection==='tournament' && config.eliteCount===0 && !config.adaptiveMutation)return 'B';
  if(config.selection==='tournament' && config.eliteCount>0)return config.adaptiveMutation?'D':'C';
  return 'Personnalisée';
}
