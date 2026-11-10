import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {NetworkView} from '../src/view/NetworkView.js';import {Renderer} from '../src/view/Renderer.js';import {TutorialDialog} from '../src/view/TutorialDialog.js';import {TelemetryView,telemetrySnapshot} from '../src/view/TelemetryView.js';
import {NeuralNetwork} from '../src/ai/NeuralNetwork.js';import {exportNetwork} from '../src/ai/NetworkSerialization.js';import {Simulation} from '../src/simulation/Simulation.js';import {TRACKS,createRegisteredTrack} from '../src/track/TrackRegistry.js';import {interfaceDOM} from './support/interface-dom.mjs';
function context(){const calls={arcs:0,strokes:0,text:[]},ctx={};for(const method of ['setTransform','fillRect','beginPath','moveTo','lineTo','fill','save','restore','translate','rotate','scale','closePath'])ctx[method]=()=>{};ctx.stroke=()=>calls.strokes++;ctx.arc=()=>calls.arcs++;ctx.fillText=value=>calls.text.push(String(value));return {calls,ctx};}
const canvas=ctx=>({clientWidth:500,clientHeight:380,width:0,height:0,getContext:()=>ctx});
test('network graph displays 8/12/2 nodes and 120 signed connections without editing parameters',()=>{
 const {calls,ctx}=context(),old=globalThis.window;globalThis.window={devicePixelRatio:1};try{const n=new NeuralNetwork({seed:2}),before=exportNetwork(n),view=new NetworkView(canvas(ctx)),d=n.forward(Array(8).fill(.5));view.draw(n,d,{now:0});assert.equal(calls.arcs,22);assert.equal(calls.strokes,120);assert.equal(exportNetwork(n),before);assert.ok(calls.text.some(t=>t==='Entrées (8)'));assert.ok(calls.text.some(t=>t==='Sorties (2)'));}finally{globalThis.window=old;}
});
test('paused graph skips repeated draws; live activations are capped at 15 Hz and layout stays cached',()=>{
 const {ctx}=context(),old=globalThis.window;globalThis.window={devicePixelRatio:1};try{const n=new NeuralNetwork(),view=new NetworkView(canvas(ctx)),d=n.forward(Array(8).fill(.4));view.draw(n,d,{now:0});for(let i=1;i<=1000;i++)view.draw(n,d,{now:i});assert.equal(view.renderCount,1);for(let frame=1;frame<=600;frame++)view.draw(n,n.forward(Array(8).fill(frame%100/100)),{now:1000+frame*1000/60});assert.ok(view.renderCount<=152);assert.equal(view.layoutBuilds,1);}finally{globalThis.window=old;}
});
test('network graph handles invalid diagnostic values and redraws resize/style changes safely',()=>{
 const {ctx,calls}=context(),old=globalThis.window;globalThis.window={devicePixelRatio:1};try{const n=new NeuralNetwork(),c=canvas(ctx),view=new NetworkView(c),d={activations:[Array(8).fill(NaN),Array(12).fill(Infinity),[0,-.5]]};view.draw(n,d,{now:0});assert.ok(calls.text.every(t=>!t.includes('NaN')&&!t.includes('Infinity')));view.effectsEnabled=false;assert.equal(view.draw(n,d,{now:1}),true);assert.equal(view.layoutBuilds,1);c.clientWidth=600;view.draw(n,d,{now:2});assert.equal(view.layoutBuilds,2);}finally{globalThis.window=old;}
});
test('renderer effects and bounded traces never mutate physical track/car state across all five circuits',()=>{
 const old=globalThis.window;globalThis.window={devicePixelRatio:1};try{
  for(const {id}of TRACKS){const sim=new Simulation(createRegisteredTrack(id)),view=new Renderer(canvas(context().ctx)),before=JSON.stringify({track:sim.track,position:sim.car.position,velocity:sim.car.velocity,checkpoints:sim.checkpoints});view.effectsEnabled=false;view.trailsEnabled=true;view.draw(sim,true);assert.equal(JSON.stringify({track:sim.track,position:sim.car.position,velocity:sim.car.velocity,checkpoints:sim.checkpoints}),before);}
  const sim=new Simulation(),view=new Renderer(canvas(context().ctx));view.trailsEnabled=true;for(let i=0;i<1000;i++){sim.car.position.x=i/100;sim.car.distanceTravelled=i/100;view.draw(sim,false);}assert.equal(view.trails.get(sim.car).points.length,180);view.trailsEnabled=false;const length=view.trails.get(sim.car).points.length;view.draw(sim,false);assert.equal(view.trails.get(sim.car).points.length,length);
 }finally{globalThis.window=old;}
});
test('telemetry uses only real available fields and remains finite with extreme/invalid metrics',()=>{
 const sim=new Simulation();assert.equal(telemetrySnapshot(),null);sim.step(.1,{throttle:1});const s=telemetrySnapshot({simulation:sim});assert.equal(s.speed,sim.car.speed);assert.equal(s.time,sim.elapsed);assert.equal(s.generation,null);assert.equal(s.fitness,null);
 const max=2**1023,individuals=[{fitness:max,simulation:sim},{fitness:max,simulation:sim}],engine={leader:individuals[0],generation:3,elapsed:.3,population:{individuals,activeCount:2}};
 const training=telemetrySnapshot({simulation:sim,mode:'training',engine});assert.equal(training.fitness,max);assert.ok(Number.isFinite(training.meanFitness));assert.equal(training.generation,3);
 sim.car.velocity.x=NaN;sim.elapsed=Infinity;const invalid=telemetrySnapshot({simulation:sim});assert.equal(invalid.speed,0);assert.equal(invalid.time,0);assert.ok(Object.values(invalid).every(v=>typeof v!=='number'||Number.isFinite(v)));
});
test('telemetry writes only changed values and hides training metrics outside training',()=>{
 const d=interfaceDOM(),view=new TelemetryView(d.root),sim=new Simulation(),snapshot=telemetrySnapshot({simulation:sim});view.render(snapshot);const writes=view.writes;for(let i=0;i<5000;i++)view.render(snapshot);assert.equal(view.writes,writes);assert.equal(d.nodes.get('#metric-generation').closest().hidden,true);assert.equal(d.nodes.get('#metric-speed').textContent,'0.0 px/s');view.render(null);assert.equal(d.nodes.get('#telemetry-hud').hidden,true);
});
test('fallback tutorial inerts background, restores focus and supports reverse Tab',async()=>{
 const d=interfaceDOM(),dialog=d.nodes.get('#tutorial-dialog');dialog.showModal=undefined;dialog.close=undefined;const modal=new TutorialDialog(dialog,{root:d.root});modal.open(d.nodes.get('#tutorial-open'));assert.equal(d.nodes.get('#main-content').inert,true);let stopped=false;await dialog.emit('keydown',{key:'Tab',shiftKey:true,preventDefault(){stopped=true;}});assert.equal(stopped,true);modal.close();assert.equal(d.nodes.get('#main-content').inert,undefined);assert.equal(d.root.activeElement,d.nodes.get('#tutorial-open'));assert.equal(modal.opened,false);
});
test('palette contrast, keyboard focus, reduced-motion and responsive layouts have explicit safeguards',()=>{
 const css=readFileSync(new URL('../ui-theme.css',import.meta.url),'utf8');
 const luminance=hex=>{const rgb=hex.match(/[a-f\d]{2}/gi).map(x=>parseInt(x,16)/255).map(x=>x<=.04045?x/12.92:((x+.055)/1.055)**2.4);return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];};
 for(const [a,b]of [['e6eefb','101c2e'],['afc0d7','101c2e'],['07121e','67e8f9']]){const x=luminance(a),y=luminance(b);assert.ok((Math.max(x,y)+.05)/(Math.min(x,y)+.05)>=4.5);}
 assert.match(css,/focus-visible/);assert.match(css,/prefers-reduced-motion/);assert.match(css,/@media\(max-width:650px\)/);assert.match(css,/\.effects-off/);assert.equal(css.includes('animation:infinite'),false);
 const stack=[];for(const ch of css.replace(/'[^']*'|"[^"]*"/g,'')){if('({['.includes(ch))stack.push(ch);else if(')}]'.includes(ch))assert.equal(stack.pop(),{')':'(',']':'[','}':'{'}[ch]);}assert.equal(stack.length,0);
});
