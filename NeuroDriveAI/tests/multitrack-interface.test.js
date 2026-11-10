import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {TrackPanel} from '../src/view/TrackPanel.js';import {TransferPanel} from '../src/view/TransferPanel.js';import {TrainingPanel} from '../src/view/TrainingPanel.js';import {GeneralizationPanel} from '../src/view/GeneralizationPanel.js';
import {Simulation} from '../src/simulation/Simulation.js';import {NeuralNetwork} from '../src/ai/NeuralNetwork.js';import {exportNetwork} from '../src/ai/NetworkSerialization.js';import {readGeneralizationReport} from '../src/experiments/GeneralizationReport.js';

class Element{
 constructor(value=''){this.value=value;this.checked=false;this.textContent='';this.handlers={};this.children=[];}
 addEventListener(name,fn){(this.handlers[name]??=[]).push(fn);}emit(name){for(const fn of this.handlers[name]??[])fn({currentTarget:this});}
 replaceChildren(){this.children=[];}append(node){this.children.push(node);}focus(){}select(){}
}
function fixture(){const nodes=new Map();const root={querySelector:id=>nodes.get(id)};const add=(id,value='')=>{const e=new Element(value);nodes.set(id,e);return e;};return {nodes,root,add};}
const reportText=()=>readFileSync(new URL('../docs/experiments/etape-6/resultats.json',import.meta.url),'utf8');
test('track panel selects all five tracks and resets sensors/checkpoints/physical state',()=>{
 const {root,add,nodes}=fixture(),select=add('#track-select','oval');add('#track-info');add('#drive-mode','autonomous');
 const s=new Simulation(),training={engine:{pause(){this.paused=true;}}},keyboard={clear(){}},clock={reset(){}};new TrackPanel(s,training,keyboard,clock,root);
 for(const id of ['desert','mountain','neon','championship','oval']){s.elapsed=2;select.value=id;select.emit('change');assert.equal(s.track.id,id);assert.equal(s.elapsed,0);assert.equal(s.checkpoints.nextIndex,1);assert.equal(s.mode,'manual');assert.ok(s.car.sensors.readings.every(r=>Number.isFinite(r.distance)));}
 assert.equal(training.engine.paused,true);assert.match(nodes.get('#track-info').textContent,/validation humaine/);
});
test('transfer panel imports legacy networks, freezes weights and reports unknown provenance',()=>{
 const {root,add,nodes}=fixture();add('#drive-mode','manual');const start=add('#transfer-start');add('#transfer-results');const input=add('#network-json',exportNetwork(new NeuralNetwork({seed:4})));
 const s=new Simulation(),p=new TransferPanel(s,{}, {clear(){}},{reset(){}},root);start.emit('click');assert.equal(p.isSelected,true);const before=exportNetwork(p.session.simulation.neuralController.network);
 p.step(1/120);p.paused=true;const elapsed=p.session.simulation.elapsed;p.step(1/120);assert.equal(p.session.simulation.elapsed,elapsed);p.render();assert.match(nodes.get('#transfer-results').textContent,/inconnu/);assert.equal(exportNetwork(p.session.simulation.neuralController.network),before);
 const current=p.session;input.value='bad';start.emit('click');assert.equal(p.session,current);assert.match(nodes.get('#transfer-results').textContent,/Erreur/);p.reset();assert.equal(p.session.simulation.elapsed,0);
});
test('training panel switches mono/multi, applies track set and preserves all strategy parameters',()=>{
 const {root,add,nodes}=fixture();
 for(const id of ['#train-start','#train-reset','#train-pause','#train-resume','#export-best','#import-best','#use-best','#training-status','#training-stats','#training-history','#training-per-track','#network-json'])add(id);
 const values={'#drive-mode':'multi-training','#training-population':'2','#training-seed':'13','#training-selection':'tournament','#training-fitness':'optimized','#training-mutation':'.1','#training-amplitude':'.2','#training-elites':'1','#training-duration':'.1','#training-stagnation':'.1','#training-tournament':'3','#training-speed':'1'};for(const [id,v]of Object.entries(values))add(id,v);
 for(const id of ['oval','desert','mountain','neon','championship'])add('#train-track-'+id).checked=['oval','desert','mountain'].includes(id);
 const s=new Simulation(),p=new TrainingPanel(s,{clear(){}},{reset(){}},root);p.initialize(true);assert.equal(p.engine.trainingTrackIds.length,3);assert.equal(p.engine.config.selection,'tournament');assert.equal(p.engine.config.eliteCount,1);assert.equal(p.engine.config.fitness,'normalized');p.step(.1);p.render();assert.match(nodes.get('#training-per-track').textContent,/mountain/);
 p.setPaused(true);assert.equal(p.paused,true);p.setPaused(false);assert.equal(nodes.get('#drive-mode').value,'multi-training');
 for(const id of ['desert','mountain'])nodes.get('#train-track-'+id).checked=false;assert.throws(()=>p.initialize(true));
 nodes.get('#drive-mode').value='training';p.initialize(false);assert.deepEqual(p.engine.trainingTrackIds,['oval']);assert.equal(p.engine.config.fitness,'optimized');
});
test('generalization report recalculates summaries and rejects forged transfer/budget values',()=>{
 const data=JSON.parse(reportText());data.summary=[];const result=readGeneralizationReport(JSON.stringify(data));assert.equal(result.summary.length,30);
 const corrupt=patch=>{const d=JSON.parse(reportText());patch(d);assert.throws(()=>readGeneralizationReport(JSON.stringify(d)));};
 corrupt(d=>d.runs[0].evaluations[0].weightsUnchanged=false);corrupt(d=>d.runs[0].evaluations[0].normalizedProgress=2);corrupt(d=>d.runs[0].allocatedIndividualCircuitSteps++);corrupt(d=>d.runs.push(d.runs[0]));corrupt(d=>d.runs.pop());
});
test('generalization panel loads, filters and retains valid results after invalid import',()=>{
 const {root,add,nodes}=fixture();for(const id of ['#generalization-summary','#generalization-status','#generalization-condition','#generalization-json','#generalization-import','#generalization-load'])add(id);
 const old=globalThis.document;globalThis.document={createElement:()=>new Element()};
 try{const p=new GeneralizationPanel(root);assert.ok(p.show(reportText()));assert.equal(nodes.get('#generalization-condition').children.length,6);assert.match(nodes.get('#generalization-summary').textContent,/championship/);
  nodes.get('#generalization-condition').value='multi:oval+desert+mountain';nodes.get('#generalization-condition').emit('change');const saved=nodes.get('#generalization-summary').textContent;assert.equal(p.show('{}'),null);assert.equal(nodes.get('#generalization-summary').textContent,saved);
 }finally{globalThis.document=old;}
});
test('HTML contains distinct main/preview canvases and all requested driving modes',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8'),main=readFileSync(new URL('../src/main.js',import.meta.url),'utf8');
 for(const mode of ['manual','autonomous','training','multi-training','transfer'])assert.ok(html.includes('value="'+mode+'"'));
 assert.match(html,/id="simulation-canvas"/);assert.match(html,/id="track-preview"/);assert.match(main,/#simulation-canvas/);assert.match(html,/generalization-load/);
});
