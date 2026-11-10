import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {RaceManager} from '../src/game/RaceManager.js';import {rankEntrants} from '../src/game/RaceResults.js';
import {importChampion} from '../src/ai/ChampionSerialization.js';import {exportNetwork} from '../src/ai/NetworkSerialization.js';
import {createFeasibilityDriver} from '../src/diagnostics/FeasibilityDriver.js';import {createRegisteredTrack} from '../src/track/TrackRegistry.js';import {vec} from '../src/math/vector.js';
const human={id:'player',name:'Joueur',control:'human'};
const champion=()=>importChampion(readFileSync(new URL('../docs/experiments/etape-5/comparaison/champions/C-2028.json',import.meta.url),'utf8')).network;
const ai=id=>({id,name:id,control:'ai',network:champion()});
function run(race,commands=()=>({})){race.start();for(let i=0;i<(race.maxDuration+race.countdown+1)*120&&!race.result;i++)race.step(1/120,commands());assert.ok(race.result);return race.result;}
test('race rejects invalid entrants, goals, tracks, bounds and nonfinite commands atomically',()=>{
 for(const patch of [{entrants:[]},{entrants:new Array(2)},{entrants:[human,human]},{entrants:[human,{...human,id:'other'}]},{maxDuration:Infinity},{countdown:-1},{goal:{type:'proximity',target:1}},{trackId:'unknown'}])assert.throws(()=>new RaceManager({entrants:[human],...patch}));
 const r=new RaceManager({entrants:[human],countdown:0});r.start();assert.throws(()=>r.step(NaN));assert.throws(()=>r.step(.01,{player:{throttle:NaN}}));assert.equal(r.elapsed,0);
});
test('common countdown never moves either car and pause stops both clocks',()=>{
 const r=new RaceManager({entrants:[human,ai('ai-a')],countdown:3});r.start();
 for(let i=0;i<180;i++)r.step(1/120,{player:{throttle:1}});assert.equal(r.elapsed,0);assert.equal(r.entrants[0].simulation.car.distanceTravelled,0);assert.equal(r.entrants[1].simulation.car.distanceTravelled,0);
 const countdown=r.countdownLeft;r.pause();for(let i=0;i<30;i++)r.step(1/120);assert.equal(r.countdownLeft,countdown);r.resume();
 for(let i=0;i<181;i++)r.step(1/120,{player:{throttle:1}});assert.equal(r.phase,'running');assert.ok(r.elapsed>0);assert.equal(r.entrants[0].simulation.elapsed,r.entrants[1].simulation.elapsed);
});
test('Human vs AI shares exact starting physics and independent car/checkpoint state',()=>{
 const r=new RaceManager({entrants:[human,ai('ai-a')],countdown:0}),[a,b]=r.entrants.map(e=>e.simulation);
 assert.notEqual(a.car,b.car);assert.notEqual(a.checkpoints,b.checkpoints);assert.deepEqual(a.car.position,b.car.position);assert.equal(a.car.orientation,b.car.orientation);assert.equal(a.car.maxSpeed,b.car.maxSpeed);assert.ok(Object.isFrozen(r.track));
 r.start();r.step(.1,{player:{throttle:1}});assert.ok(a.car.distanceTravelled>0);assert.equal(a.mode,'manual');assert.equal(b.mode,'autonomous');
});
test('AI vs AI identical champions draw with separate immutable networks',()=>{
 const r=new RaceManager({entrants:[ai('ai-a'),ai('ai-b')],countdown:0,maxDuration:30});const a=r.entrants[0].simulation.neuralController.network,b=r.entrants[1].simulation.neuralController.network;assert.notEqual(a,b);assert.notEqual(a.parameters,b.parameters);
 const before=exportNetwork(a),result=run(r);assert.equal(result.tie,true);assert.deepEqual(result.winnerIds,['ai-a','ai-b']);assert.equal(result.ranking[0].rank,1);assert.equal(result.ranking[1].rank,1);assert.equal(result.ranking[0].checkpoints,12);assert.ok(result.ranking.every(e=>e.weightsUnchanged));assert.equal(exportNetwork(a),before);
});
test('Human vs AI finishes AI independently while human continues to common timeout',()=>{
 const r=new RaceManager({entrants:[human,ai('ai-a')],countdown:0,maxDuration:20}),result=run(r);
 assert.deepEqual(result.winnerIds,['ai-a']);assert.equal(result.ranking[0].status,'finished');assert.equal(result.ranking[1].status,'timeout');assert.ok(result.ranking[0].finishTime<result.elapsed);assert.ok(Math.abs(result.elapsed-20)<1e-8);assert.equal(result.ranking[1].checkpoints,0);
});
test('collisions are independent, permanently freeze progress and cannot grant victory',()=>{
 const r=new RaceManager({entrants:[human,ai('ai-a')],countdown:0,maxDuration:20});r.start();
 const s=r.entrants[0].simulation,w=r.track.walls[r.track.inner.length+2],mid=w.a.copy().add(w.b).mult(.5);s.car.velocity=mid.copy().sub(s.car.position).normalize().mult(20000);s.car.maxSpeed=20000;s.car.orientation=s.car.velocity.heading();
 r.step(.1,{player:{throttle:1}});assert.equal(r.entrants[0].status,'collision');assert.equal(r.entrants[1].status,'running');const snapshot=r.metrics()[0];
 while(!r.result)r.step(1/120,{player:{throttle:1}});const after=r.metrics()[0];assert.equal(after.checkpoints,snapshot.checkpoints);assert.equal(after.distance,snapshot.distance);assert.equal(after.elapsed,snapshot.elapsed);assert.deepEqual(r.result.winnerIds,['ai-a']);
});
test('timeout does not invent a collision and idle cars receive no checkpoints or winner',()=>{
 const r=new RaceManager({entrants:[human],countdown:0,maxDuration:1}),result=run(r);assert.equal(result.ranking[0].status,'timeout');assert.equal(result.ranking[0].crashed,false);assert.equal(result.ranking[0].progress,0);assert.deepEqual(result.winnerIds,[]);assert.equal(result.ranking[0].averageSpeed,0);
});
test('a collision in the goal-crossing tick is conservatively a defeat',()=>{
 const r=new RaceManager({entrants:[human],countdown:0,goal:{type:'checkpoints',target:1}}),s=r.entrants[0].simulation,c=r.track.checkpoints[1],mid=c.a.copy().add(c.b).mult(.5),n=c.normal.copy(),tangent=vec(-n.y,n.x),wall=mid.copy().add(n.copy().mult(30));
 // Isolated fixture places a real swept wall just beyond an ordered gate.
 s.track={...r.track,walls:[{a:wall.copy().add(tangent.copy().mult(60)),b:wall.copy().sub(tangent.copy().mult(60))}]};
 s.car.position=mid.copy().sub(n.copy().mult(20));s.car.velocity=n.copy().mult(2000);s.car.orientation=s.car.velocity.heading();s.car.maxSpeed=10000;s.car.sensors.scan(s.car.position,s.car.orientation,s.track.walls);
 r.start();r.step(.05,{player:{throttle:1}});assert.equal(s.checkpoints.validated,1);assert.equal(r.result.ranking[0].status,'collision');assert.deepEqual(r.result.winnerIds,[]);
});
test('abandonment is idempotent, freezes the entrant and never invents a finish',()=>{
 const r=new RaceManager({entrants:[ai('ai-a'),ai('ai-b')],countdown:0});r.start();r.step(.1);r.abandon('ai-a');const stopped=r.metrics()[0];r.step(.1);assert.equal(r.metrics()[0].distance,stopped.distance);r.abandonAll();const result=r.result;r.abandonAll();r.step(.1);assert.equal(r.result,result);assert.deepEqual(result.winnerIds,[]);assert.throws(()=>r.abandon('missing'));
});
test('ranking uses legal completion, time, ordered gates and explicit DNF states; ties retain rank',()=>{
 const row=(id,status,checkpoints,finishTime=null)=>({id,status,checkpoints,finishTime});
 const result=rankEntrants([row('slow','finished',12,20),row('fast','finished',12,10),row('crashed','collision',11),row('idle','timeout',0),row('abandoned','abandoned',11),row('also-fast','finished',12,10)]);
 assert.deepEqual(result.map(r=>r.id),['also-fast','fast','slow','crashed','abandoned','idle']);assert.deepEqual(result.map(r=>r.rank),[1,1,3,4,5,6]);
 assert.throws(()=>rankEntrants([{id:'bad',status:'finished',checkpoints:12,finishTime:NaN}]));
});
test('reset reproduces seeds, starting state and complete AI trajectories',()=>{
 const r=new RaceManager({entrants:[ai('ai-a'),ai('ai-b')],countdown:0,maxDuration:20}),a=run(r);r.reset();assert.equal(r.elapsed,0);assert.equal(r.result,null);assert.equal(r.phase,'ready');const b=run(r);assert.deepEqual(a,b);
});
test('a physical lap requires every checkpoint before race completion',()=>{
 const track=createRegisteredTrack('oval'),driver=createFeasibilityDriver(track),r=new RaceManager({entrants:[human],countdown:0,maxDuration:90});r.start();
 while(!r.result){r.step(1/120,{player:driver(r.entrants[0].simulation.car)});if(r.entrants[0].simulation.checkpoints.validated<12)assert.equal(r.result,null);}
 assert.equal(r.result.ranking[0].laps,1);assert.equal(r.result.ranking[0].checkpoints,12);assert.equal(r.result.ranking[0].status,'finished');
});
test('skipped, wrong-way and premature finish crossings cannot finish a race',()=>{
 const r=new RaceManager({entrants:[human],countdown:0,maxDuration:1}),m=r.entrants[0].simulation.checkpoints;
 const cross=(i,sign=1)=>{const c=r.track.checkpoints[i],mid=c.a.copy().add(c.b).mult(.5),d=c.normal.copy().mult(sign*2);m.process(mid.copy().sub(d),mid.copy().add(d));};
 cross(0);cross(2);cross(1,-1);assert.equal(m.validated,0);const result=run(r);assert.deepEqual(result.winnerIds,[]);assert.equal(result.ranking[0].laps,0);
});
test('long competition play/reset over 20000 real steps remains finite with frozen genomes',()=>{
 const r=new RaceManager({entrants:[ai('ai-a'),ai('ai-b')],countdown:0,maxDuration:20});r.start();let completed=0;
 for(let step=0;step<20000;step++){r.step(1/120);for(const e of r.metrics())assert.ok(Number.isFinite(e.averageSpeed)&&Number.isFinite(e.distance));if(r.result){completed++;assert.ok(r.result.ranking.every(e=>e.weightsUnchanged));r.reset();r.start();}}
 assert.ok(completed>10);
});
