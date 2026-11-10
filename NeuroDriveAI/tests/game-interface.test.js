import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {GamePanel} from '../src/view/GamePanel.js';import {gameDOM} from './support/game-dom.mjs';
const controls=()=>({keyboard:{clear(){}},clock:{reset(){}}});
async function setup(loadOverride){const d=gameDOM(),old=globalThis.window;globalThis.window=d.win;const {keyboard,clock}=controls(),panel=new GamePanel(keyboard,clock,{root:d.root,storage:d.memory,load:loadOverride??d.load});await panel.ready;return {...d,panel,cleanup(){globalThis.window=old;}};}
test('gameplay UI exposes home, locked missions, champion selection, victory and saved AI progression',async()=>{
 const d=await setup();try{
  assert.equal(d.panel.manager.mode,'home');assert.equal(d.nodes.get('#lab-screen').hidden,true);assert.equal(d.nodes.get('#game-champion-a').children.length,8);
  await d.nodes.get('#go-career').emit('click');assert.equal(d.nodes.get('#career-setup').hidden,false);assert.equal(d.nodes.get('#game-mission').children.filter(o=>!o.disabled).length,1);
  d.nodes.get('#game-mission-control').value='ai';d.nodes.get('#game-champion-a').value='classic-2026';await d.nodes.get('#game-start').emit('click');
  while(!d.panel.manager.current.result)d.panel.step(1/120,{});d.panel.render(60);assert.match(d.nodes.get('#game-verdict').textContent,/VICTOIRE/);assert.match(d.nodes.get('#game-results').textContent,/finished/);assert.equal(d.nodes.get('#game-mission').children.filter(o=>!o.disabled).length,2);assert.ok(d.memory.value);assert.equal(d.panel.manager.progress.list()[0].human.completed,false);
  await d.nodes.get('#game-restart').emit('click');assert.equal(d.panel.manager.race.elapsed,0);await d.nodes.get('#game-abandon').emit('click');d.panel.render();assert.match(d.nodes.get('#game-verdict').textContent,/DÉFAITE/);
 }finally{d.cleanup();}
});
test('competition UI switches Human vs AI / AI vs AI, pauses, ranks and declares ties',async()=>{
 const d=await setup();try{
  await d.nodes.get('#go-human-ai').emit('click');d.nodes.get('#game-race-duration').value='1';await d.nodes.get('#game-start').emit('click');assert.equal(d.panel.manager.race.entrants[0].control,'human');
  await d.nodes.get('#game-pause').emit('click');const countdown=d.panel.manager.race.countdownLeft;d.panel.step(.1);assert.equal(d.panel.manager.race.countdownLeft,countdown);await d.nodes.get('#game-resume').emit('click');d.panel.step(.1);assert.ok(d.panel.manager.race.countdownLeft<countdown);
  await d.nodes.get('#game-retire').emit('click');assert.equal(d.panel.manager.race.entrants[0].status,'abandoned');assert.equal(d.panel.manager.race.entrants[1].status,'running');
  await d.nodes.get('#go-ai-ai').emit('click');d.nodes.get('#game-champion-a').value='classic-2026';d.nodes.get('#game-champion-b').value='classic-2026';d.nodes.get('#game-race-duration').value='20';await d.nodes.get('#game-start').emit('click');while(!d.panel.manager.race.result)d.panel.step(1/120);d.panel.render();assert.match(d.nodes.get('#game-verdict').textContent,/ÉGALITÉ/);assert.ok(d.panel.manager.race.result.ranking.every(e=>e.weightsUnchanged));
  await d.nodes.get('#go-lab').emit('click');assert.equal(d.panel.isSelected,false);assert.equal(d.nodes.get('#lab-screen').hidden,false);assert.equal(d.nodes.get('#game-screen').hidden,true);
 }finally{d.cleanup();}
});
test('gameplay imports JSON and rejects invalid text/files without replacing selected champions',async()=>{
 const d=await setup();try{
  const count=d.panel.manager.champions.list().length;d.nodes.get('#game-champion-json').value='bad';await d.nodes.get('#game-import-champion').emit('click');assert.match(d.nodes.get('#game-status').textContent,/Erreur/);assert.equal(d.panel.manager.champions.list().length,count);
  d.nodes.get('#game-champion-json').value=readFileSync(new URL('../docs/experiments/essai-2026/champion.json',import.meta.url),'utf8');d.nodes.get('#game-champion-name').value='Mon IA';await d.nodes.get('#game-import-champion').emit('click');assert.equal(d.panel.manager.champions.list().length,count+1);assert.equal(d.nodes.get('#game-champion-a').value,'import-1');
  d.nodes.get('#game-champion-file').files=[{size:1e9,text:async()=>''}];await d.nodes.get('#game-champion-file').emit('change');assert.match(d.nodes.get('#game-status').textContent,/volumineux/);assert.equal(d.nodes.get('#game-champion-a').value,'import-1');
 }finally{d.cleanup();}
});
test('missing shipped champions degrade to manual play with an explicit message',async()=>{
 const d=await setup(async()=>({ok:false}));try{assert.match(d.nodes.get('#game-status').textContent,/indisponible/);d.panel.enter('career');d.panel.start();assert.equal(d.panel.manager.race.entrants[0].control,'human');}finally{d.cleanup();}
});
test('real application entry isolates gameplay clock/rendering from the preserved laboratory',async()=>{
 const d=gameDOM(),old={document:globalThis.document,window:globalThis.window,fetch:globalThis.fetch,raf:globalThis.requestAnimationFrame};let frame,now=performance.now();
 globalThis.document=d.root;globalThis.window=d.win;globalThis.fetch=d.load;globalThis.requestAnimationFrame=fn=>{frame=fn;};
 const advance=()=>{now+=100;frame(now);};
 try{
  await import('../src/main.js');advance();assert.equal(d.nodes.get('#championship-home').hidden,false);assert.equal(d.draws.get('#simulation-canvas')??0,0);
  await d.nodes.get('#go-lab').emit('click');advance();assert.match(d.nodes.get('#hud').textContent,/Manuel/);await d.nodes.get('#pause').emit('click');await d.win.emit('keydown',{code:'ArrowUp',target:{tagName:'BODY'},preventDefault(){}});advance();assert.doesNotMatch(d.nodes.get('#hud').textContent,/Vitesse : 0.0/);
  await d.nodes.get('#go-home').emit('click');const frozen=d.nodes.get('#hud').textContent;advance();advance();assert.equal(d.nodes.get('#hud').textContent,frozen);
  await d.nodes.get('#go-career').emit('click');await d.nodes.get('#game-start').emit('click');advance();assert.ok((d.draws.get('#game-canvas')??0)>0);assert.match(d.nodes.get('#game-hud').textContent,/Départ dans/);await d.win.emit('blur');advance();assert.match(d.nodes.get('#game-hud').textContent,/pause/);
 }finally{Object.assign(globalThis,{document:old.document,window:old.window,fetch:old.fetch,requestAnimationFrame:old.raf});}
});
