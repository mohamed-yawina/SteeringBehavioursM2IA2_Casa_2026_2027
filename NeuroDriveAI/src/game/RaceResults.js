const STATUS_ORDER=Object.freeze({finished:0,timeout:1,collision:2,abandoned:3,running:4});
function sportingOrder(a,b){
  if(a.status==='finished'||b.status==='finished'){
    if(a.status!==b.status)return a.status==='finished'?-1:1;
    return Math.abs(a.finishTime-b.finishTime)<=1e-9?0:a.finishTime-b.finishTime;
  }
  return b.checkpoints-a.checkpoints||(STATUS_ORDER[a.status]-STATUS_ORDER[b.status]);
}
export function rankEntrants(entrants){
  if(!Array.isArray(entrants)||!entrants.length||Array.from(entrants).some(e=>!e||typeof e.id!=='string'||!Object.hasOwn(STATUS_ORDER,e.status)||!Number.isInteger(e.checkpoints)||e.checkpoints<0||e.status==='finished'&&(!Number.isFinite(e.finishTime)||e.finishTime<0))||new Set(entrants.map(e=>e.id)).size!==entrants.length)throw new RangeError('Classement invalide');
  const sorted=[...entrants].sort((a,b)=>sportingOrder(a,b)||(a.id<b.id?-1:a.id>b.id?1:0));let rank=1;
  return Object.freeze(sorted.map((r,index)=>{if(index&&sportingOrder(sorted[index-1],r)!==0)rank=index+1;return Object.freeze({...r,rank});}));
}
export function raceResults(race){
  const ranking=rankEntrants(race.metrics()),winners=ranking.filter(r=>r.rank===1&&r.status==='finished').map(r=>r.id);
  return Object.freeze({trackId:race.track.id,elapsed:race.elapsed,maxDuration:race.maxDuration,goal:race.goal,ranking,
    winnerIds:Object.freeze(winners),tie:winners.length>1,reason:race.elapsed>=race.maxDuration-1e-9?'timeout':ranking.every(r=>r.status==='finished')?'completed':'eliminated'});
}
