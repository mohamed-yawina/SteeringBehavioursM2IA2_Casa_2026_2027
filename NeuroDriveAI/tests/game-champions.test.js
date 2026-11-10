import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {ChampionRegistry,BUILTIN_CHAMPIONS} from '../src/game/ChampionRegistry.js';import {GameManager} from '../src/game/GameManager.js';
import {evaluateMission} from '../src/game/GameplayBalance.js';import {exportNetwork} from '../src/ai/NetworkSerialization.js';import {NeuralNetwork} from '../src/ai/NeuralNetwork.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const classic=()=>read('docs/experiments/essai-2026/champion.json');
test('champion registry loads all eight shipped examples including legacy JSON',async()=>{
 const registry=new ChampionRegistry(),load=async path=>({ok:true,text:async()=>read(path)});
 for(const c of BUILTIN_CHAMPIONS){const result=await registry.loadBuiltin(c.id,load);assert.equal(result.id,c.id);assert.deepEqual(result.network.sizes,[8,12,2]);}
 assert.equal(registry.list().length,8);assert.equal(registry.get('classic-2026').training,null);assert.deepEqual(registry.get('desert-2028').training.trackIds,['desert']);
});
test('champion import is atomic, bounded and independently reconstructs immutable weights',()=>{
 const r=new ChampionRegistry(),a=r.importJSON(classic(),'Premier'),b=r.get(a.id);assert.notEqual(a.network,b.network);assert.notEqual(a.network.parameters,b.network.parameters);assert.equal(exportNetwork(a.network),exportNetwork(b.network));assert.throws(()=>a.network.parameters[0].weights[0][0]=99);
 const count=r.list().length;assert.throws(()=>r.importJSON('bad'));assert.throws(()=>r.importJSON(exportNetwork(new NeuralNetwork({sizes:[7,12,2]}))));assert.equal(r.list().length,count);assert.throws(()=>r.get('missing'));
 for(let i=1;i<24;i++)r.importJSON(classic());assert.throws(()=>r.importJSON(classic()));assert.equal(r.list().length,24);
});
test('builtin failures and concurrent imports preserve catalog identity',async()=>{
 const r=new ChampionRegistry();await assert.rejects(()=>r.loadBuiltin('missing'));await assert.rejects(()=>r.loadBuiltin('oval-2026',async()=>({ok:false})));assert.equal(r.list().length,0);
 const loader=async path=>({ok:true,text:async()=>read(path)});await Promise.all([r.loadBuiltin('oval-2026',loader),r.loadBuiltin('oval-2026',loader)]);assert.equal(r.list().length,1);
});
test('GameManager Human vs AI and AI vs AI reuse chosen identities without evolution',()=>{
 const g=new GameManager(),a=g.champions.importJSON(classic(),'A'),b=g.champions.importJSON(classic(),'B');
 const h=g.startRace('human-ai',{championA:a.id,countdown:0,maxDuration:1});assert.equal(h.entrants[0].control,'human');assert.equal(h.entrants[1].championId,a.id);assert.equal(h.entrants[1].name,'A');g.step(.1,{throttle:1});g.pause();const elapsed=h.elapsed;g.step(.1);assert.equal(h.elapsed,elapsed);g.resume();g.step(.1);assert.ok(h.elapsed>elapsed);
 const r=g.startRace('ai-ai',{championA:a.id,championB:b.id,countdown:0,maxDuration:1});while(!r.result)g.step(.1);assert.ok(r.result.ranking.every(e=>e.weightsUnchanged));assert.notEqual(r.entrants[0].simulation.neuralController.network,r.entrants[1].simulation.neuralController.network);
});
test('AI mission successes record the AI profile and never fabricate human completion',()=>{
 const g=new GameManager(),c=g.champions.importJSON(classic());const m=g.startMission('first-steps',{championId:c.id,countdown:0});while(!m.result)g.step(1/120);assert.equal(m.result.outcome,'victory');assert.equal(g.progress.list()[0].ai.completed,true);assert.equal(g.progress.list()[0].human.completed,false);assert.equal(g.progress.isAvailable('first-lap'),true);
});
test('headless balancing replay is exactly reproducible and preserves every weight',()=>{
 const options={missionId:'first-steps',championId:'classic',source:'test',seed:2026,json:classic()},a=evaluateMission(options),b=evaluateMission(options);assert.deepEqual(a,b);assert.equal(a.weightsUnchanged,true);assert.equal(a.outcome,'victory');
});
test('published balancing data contains 275 finite cases, five seeds, all missions and independent feasibility',()=>{
 const r=JSON.parse(read('docs/experiments/etape-7/resultats.json'));assert.equal(r.protocol.retraining,false);assert.equal(r.protocol.objectivesUnchanged,true);assert.equal(r.protocol.seeds.length,5);assert.equal(r.runs.length,275);assert.equal(r.summary.length,15);assert.equal(r.feasibility.length,5);
 for(const result of r.runs){assert.equal(result.weightsUnchanged,true);for(const field of ['elapsed','checkpoints','laps','progress','score','stars'])assert.ok(Number.isFinite(result[field]));assert.ok(result.progress>=0&&result.progress<=1);}
 assert.ok(r.feasibility.every(f=>f.outcome==='victory'&&f.humanValidated===false));assert.equal(read('docs/experiments/etape-7/evaluations.csv').trim().split(/\r?\n/).length,276);assert.equal(read('docs/experiments/etape-7/summary.csv').trim().split(/\r?\n/).length,16);
 for(const row of r.summary){const cases=r.runs.filter(x=>x.missionId===row.missionId&&x.source===row.source);assert.equal(row.count,cases.length);assert.equal(row.successes,cases.filter(x=>x.outcome==='victory').length);}
});
test('measured mission outcome exactly replays for an example champion',()=>{
 const r=JSON.parse(read('docs/experiments/etape-7/resultats.json')),saved=r.runs.find(x=>x.missionId==='desert-challenge'&&x.championId==='step6-desert-2028');
 const actual=evaluateMission({missionId:saved.missionId,championId:saved.championId,source:saved.source,seed:saved.seed,json:read('docs/experiments/etape-6/champions/desert-2028.json')});assert.deepEqual(actual,saved);
});
