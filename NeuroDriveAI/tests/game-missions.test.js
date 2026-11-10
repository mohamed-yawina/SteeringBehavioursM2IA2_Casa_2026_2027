import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {MISSIONS,getMission,missionGoal,missionReward} from '../src/game/MissionDefinitions.js';import {MissionManager} from '../src/game/MissionManager.js';
import {MissionProgress,validateProgress,SAVE_KEY} from '../src/game/MissionProgress.js';import {GameManager} from '../src/game/GameManager.js';
import {createRegisteredTrack} from '../src/track/TrackRegistry.js';import {createFeasibilityDriver} from '../src/diagnostics/FeasibilityDriver.js';
const human={id:'player',name:'Joueur',control:'human'};
const storage=()=>({value:null,getItem(){return this.value;},setItem(key,value){assert.equal(key,SAVE_KEY);this.value=value;}});
const win=(id,control='human',elapsed=10)=>{const d=getMission(id);return {missionId:id,trackId:d.trackId,control,elapsed,progress:1,outcome:'victory',reason:'finished',weightsUnchanged:true,...missionReward(d,true,elapsed,1)};};
test('five immutable mission definitions preserve requested objectives and explicit defeat rules',()=>{
 assert.equal(MISSIONS.length,5);assert.equal(new Set(MISSIONS.map(m=>m.id)).size,5);assert.equal(MISSIONS[0].objective.target,3);assert.equal(MISSIONS[3].objective.target,.5);assert.ok(MISSIONS.every(m=>Object.isFrozen(m)&&m.maxDuration>=45&&m.reward>0));assert.throws(()=>getMission('missing'));
 assert.deepEqual(missionGoal(MISSIONS[3],createRegisteredTrack('mountain')),{type:'checkpoints',target:9});assert.throws(()=>missionGoal(MISSIONS[0],createRegisteredTrack('desert')));
});
for(const definition of MISSIONS){
 test(definition.id+': physically realizable using legal manual commands and strict crossings',()=>{
  const driver=createFeasibilityDriver(createRegisteredTrack(definition.trackId)),session=new MissionManager(definition.id,human,{countdown:0});session.start();
  while(!session.result)session.step(1/120,{player:driver(session.race.entrants[0].simulation.car)});
  assert.equal(session.result.outcome,'victory');assert.equal(session.result.reason,'finished');assert.ok(session.result.elapsed<definition.maxDuration);assert.equal(session.result.progress,1);assert.equal(session.result.weightsUnchanged,true);
  if(definition.id==='mountain-explorer'){assert.equal(session.result.checkpoints,9);assert.equal(session.result.laps,0);}
 });
}
test('mission rewards are bounded, time-based and failures cannot earn success stars',()=>{
 const m=MISSIONS[0];assert.deepEqual(missionReward(m,true,m.maxDuration,1),{score:100,stars:1});assert.equal(missionReward(m,true,m.maxDuration*.75,1).stars,2);assert.equal(missionReward(m,true,m.maxDuration*.5,1).stars,3);assert.equal(missionReward(m,false,20,.5).stars,0);assert.equal(missionReward(m,false,20,0).score,0);assert.throws(()=>missionReward(m,true,Infinity,1));
});
test('mission abandonment and timeout are defeats; resetting clears terminal state',()=>{
 const m=new MissionManager('first-steps',human,{countdown:0});m.start();m.step(.1);m.abandon();assert.equal(m.result.reason,'abandoned');assert.equal(m.result.stars,0);const result=m.result;m.abandon();assert.equal(m.result,result);m.reset();assert.equal(m.result,null);assert.equal(m.race.elapsed,0);m.start();for(let i=0;i<450;i++)m.step(.1);assert.equal(m.result.reason,'timeout');assert.equal(m.result.score,0);
});
test('career unlocks sequentially, separates human/AI results and awards rewards once',()=>{
 const p=new MissionProgress();assert.deepEqual(p.list().map(m=>m.available),[true,false,false,false,false]);p.record(win('first-steps','ai'));assert.equal(p.isAvailable('first-lap'),true);assert.equal(p.list()[0].human.completed,false);assert.equal(p.list()[0].ai.completed,true);assert.equal(p.rewardTotal,100);
 p.record(win('first-steps','human',15));p.record(win('first-steps','human',20));assert.equal(p.rewardTotal,100);assert.equal(p.list()[0].human.bestTime,15);assert.equal(p.list()[0].human.attempts,2);assert.equal(p.stars,3);
 for(const m of MISSIONS.slice(1))p.record(win(m.id));assert.equal(p.rewardTotal,1500);assert.equal(p.stars,15);
});
test('validated local save roundtrip is small and omits genomes and trajectories',()=>{
 const s=storage(),p=new MissionProgress(s);p.record(win('first-steps'));const restored=new MissionProgress(s);assert.deepEqual(restored.list(),p.list());assert.ok(s.value.length<2000);assert.equal(s.value.includes('parameters'),false);assert.equal(validateProgress(s.value).version,1);
});
test('corrupt, oversized, future, nonfinite and inconsistent saves are rejected safely',()=>{
 const s=storage(),p=new MissionProgress(s);p.record(win('first-steps'));const valid=JSON.parse(s.value);
 const corrupt=patch=>{const d=structuredClone(valid);patch(d);assert.throws(()=>validateProgress(JSON.stringify(d)));};
 corrupt(d=>d.version=2);corrupt(d=>d.missions[0].human.stars=9);corrupt(d=>d.missions[0].human.bestTime=Infinity);corrupt(d=>d.missions[1].human={...d.missions[0].human});corrupt(d=>d.missions[0].human.bestScore++);assert.throws(()=>validateProgress('x'.repeat(16001)));
 s.value='bad';const restored=new MissionProgress(s);assert.equal(restored.rewardTotal,0);assert.match(restored.warning,/ignorée/);
});
test('blocked storage never prevents progression in memory',()=>{
 const p=new MissionProgress({getItem(){throw new Error('blocked');},setItem(){throw new Error('quota');}});p.record(win('first-steps'));assert.equal(p.isAvailable('first-lap'),true);assert.match(p.warning,/mémoire/);
});
test('failed results preserve unlocks and cannot forge victory, locked missions or scores',()=>{
 const p=new MissionProgress();assert.throws(()=>p.record(win('first-lap')));const failed={...win('first-steps'),outcome:'defeat',reason:'collision',progress:1/3,...missionReward(MISSIONS[0],false,10,1/3)};p.record(failed);assert.equal(p.isAvailable('first-lap'),false);assert.equal(p.rewardTotal,0);assert.equal(p.list()[0].human.bestScore,33);assert.throws(()=>p.record({...win('first-steps'),progress:.5}));assert.throws(()=>p.record({...win('first-steps'),score:1e20}));
});
test('game manager records each mission once and lab switching pauses without awarding results',()=>{
 const game=new GameManager(),driver=createFeasibilityDriver(createRegisteredTrack('oval'));game.startMission('first-steps',{countdown:0});
 while(!game.session.result)game.step(1/120,driver(game.race.entrants[0].simulation.car));for(let i=0;i<10;i++)game.step(1/120);assert.equal(game.progress.list()[0].human.attempts,1);assert.equal(game.progress.isAvailable('first-lap'),true);
 game.startMission('first-lap',{countdown:0});game.step(.1,{throttle:1});const elapsed=game.race.elapsed;game.enter('lab');game.step(.1,{throttle:1});assert.equal(game.current,null);game.enter('career');assert.equal(game.race.elapsed,elapsed);assert.equal(game.race.paused,true);assert.equal(game.progress.list()[1].human.attempts,0);
 game.restart();assert.equal(game.progress.list()[1].human.attempts,1);assert.equal(game.race.elapsed,0);
});
test('invalid starts are atomic and cannot bypass mission locks',()=>{
 const g=new GameManager();g.startMission('first-steps',{countdown:0});const current=g.session;assert.throws(()=>g.startMission('evolution-champion'));assert.throws(()=>g.startRace('ai-ai',{championA:'missing',championB:'also-missing'}));assert.equal(g.session,current);assert.equal(current.result,null);assert.throws(()=>g.enter('future'));
});
