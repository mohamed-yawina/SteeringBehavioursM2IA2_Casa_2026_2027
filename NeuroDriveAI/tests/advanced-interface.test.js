import test from 'node:test';import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation/Simulation.js';import { TrainingPanel } from '../src/view/TrainingPanel.js';
import { ExperimentPanel } from '../src/view/ExperimentPanel.js';import { runComparisonTrial } from '../src/experiments/Comparison.js';
class Element{
 constructor(value=''){this.value=value;this.checked=false;this.textContent='';this.handlers=new Map();}
 addEventListener(name,fn){this.handlers.set(name,fn);}async emit(name){return this.handlers.get(name)?.({currentTarget:this});}
 blur(){}focus(){}select(){}
}
test('strategy presets and adaptive diagnostics respect immutable active-run settings',async()=>{
 const fields={'#training-population':'3','#training-seed':'5','#training-selection':'tournament','#training-fitness':'optimized',
 '#training-mutation':'.1','#training-amplitude':'.2','#training-elites':'2','#training-duration':'.1','#training-stagnation':'.1','#training-tournament':'5',
 '#training-min-rate':'.02','#training-max-rate':'.3','#training-patience':'2','#training-diversity':'.25','#training-immigrants':'.2','#training-strategy':'D'};
 const ids=['#train-start','#drive-mode','#training-status','#training-stats','#training-history','#train-reset','#train-pause','#train-resume',
 '#export-best','#import-best','#use-best','#network-seed','#network-status','#network-json','#training-adaptive','#training-diagnostics'];
 const nodes=new Map(ids.map(id=>[id,new Element()]));for(const [id,v]of Object.entries(fields))nodes.set(id,new Element(v));
 const panel=new TrainingPanel(new Simulation(),{clear(){}},{reset(){}},{querySelector:id=>nodes.get(id)});
 await nodes.get('#training-strategy').emit('change');assert.equal(nodes.get('#training-adaptive').checked,true);assert.equal(nodes.get('#training-immigrants').value,'0');
 await nodes.get('#train-start').emit('click');panel.step(1/120);panel.render();assert.match(nodes.get('#training-diagnostics').textContent,/Stratégie D.*Mutation actuelle/);
 assert.equal(panel.engine.config.adaptiveMutation,true);
 nodes.get('#training-strategy').value='A';await nodes.get('#training-strategy').emit('change');assert.equal(panel.engine.config.adaptiveMutation,true);
 await nodes.get('#train-reset').emit('click');assert.equal(panel.engine.config.adaptiveMutation,false);assert.equal(panel.engine.config.selection,'roulette');assert.equal(panel.engine.config.eliteCount,0);
});
test('comparison panel loads a paired report and rejects corrupt data without replacing displayed results',async()=>{
 const common={populationSize:2,maxDuration:.1,stagnationTime:.1,fitness:'optimized'};
 const run=runComparisonTrial({common,seed:1,strategy:'A',generations:1});
 const report={format:'NeuroDriveAI.comparison',version:1,protocol:{seeds:[1],strategies:['A'],generations:1,dt:1/120,common:run.config},runs:[run]};
 const nodes=new Map(['#comparison-summary','#comparison-json','#comparison-status','#comparison-import','#comparison-load'].map(id=>[id,new Element()]));
 const panel=new ExperimentPanel({querySelector:id=>nodes.get(id)},async()=>({ok:true,text:async()=>JSON.stringify(report)}));
 await nodes.get('#comparison-load').emit('click');assert.match(nodes.get('#comparison-status').textContent,/Rapport valide/);assert.match(nodes.get('#comparison-summary').textContent,/A \| 0\/1/);
 const before=nodes.get('#comparison-summary').textContent;assert.equal(panel.show('bad'),null);assert.equal(nodes.get('#comparison-summary').textContent,before);
 assert.match(nodes.get('#comparison-status').textContent,/Erreur/);
});
