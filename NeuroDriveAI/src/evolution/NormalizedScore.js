export function normalizedTrackScore(result,checkpointCount){
 if(!Number.isInteger(checkpointCount)||checkpointCount<2)throw new RangeError('Invalid checkpoint count');
 const valid=n=>Number.isFinite(n)?Math.max(0,n):0;
 const progress=Math.min(1,(valid(result.checkpoints)+Math.min(.999,valid(result.fraction)))/checkpointCount);
 const completion=valid(result.laps)>=1?1:0;
 return (.6*progress+.4*completion)*(result.crashed ? .5 : result.reason==='stagnation' ? .75 : 1);
}
export function aggregateScores(scores){
 if(!Array.isArray(scores)||!scores.length||Array.from(scores).some(s=>!Number.isFinite(s)||s<0||s>1))throw new RangeError('Invalid normalized scores');
 return .5*scores.reduce((s,n)=>s+n,0)/scores.length+.5*Math.min(...scores);
}
