import test from 'node:test';
import assert from 'node:assert/strict';

test('full application supports training start/pause/resume/reset, archive export/import and autonomous reuse', async () => {
  class Element {
    constructor(value=''){this.value=value;this.checked=false;this.textContent='';this.handlers=new Map();}
    addEventListener(name,fn){if(!this.handlers.has(name))this.handlers.set(name,[]);this.handlers.get(name).push(fn);}
    removeEventListener(name,fn){this.handlers.set(name,(this.handlers.get(name)??[]).filter(f=>f!==fn));}
    emit(name,extra={}){for(const fn of this.handlers.get(name)??[])fn({currentTarget:this,target:{tagName:'BUTTON'},...extra});}
    setAttribute(name,value){this[name]=value;}blur(){}focus(){}select(){}
  }
  const context={};for(const m of ['setTransform','fillRect','translate','scale','moveTo','lineTo','closePath','beginPath','fill','arc','save','rotate','restore','fillText','stroke'])context[m]=()=>{};
  const canvas=()=>({clientWidth:1000,clientHeight:700,width:0,height:0,getContext:()=>context});
  const values={
    '#drive-mode':'manual','#training-population':'2','#training-seed':'17','#training-selection':'roulette',
    '#training-fitness':'improved','#training-mutation':'.1','#training-amplitude':'.2','#training-elites':'1',
    '#training-duration':'.1','#training-stagnation':'10','#training-tournament':'3','#training-speed':'1','#network-seed':'1'
  };
  const ids=['#hud','#event','#pause','#reset','#sensors','#neural-inputs','#neural-outputs','#network-status','#network-json',
    '#network-parameters','#new-network','#export-network','#import-network','#train-start','#train-reset','#train-pause',
    '#train-resume','#export-best','#import-best','#use-best','#training-status','#training-stats','#training-history','#network-inspection'];
  const nodes=new Map(ids.map(id=>[id,new Element()]));for(const [id,value]of Object.entries(values))nodes.set(id,new Element(value));
  nodes.set('canvas',canvas());nodes.set('#network-canvas',canvas());nodes.get('#sensors').checked=true;
  const doc=new Element();doc.querySelector=id=>nodes.get(id);doc.hidden=false;
  const win=new Element();win.devicePixelRatio=1;
  const old={document:globalThis.document,window:globalThis.window,raf:globalThis.requestAnimationFrame};let callback,now=performance.now();
  globalThis.document=doc;globalThis.window=win;globalThis.requestAnimationFrame=fn=>{callback=fn;};
  const frame=()=>{now+=100;const fn=callback;fn(now);};
  try{
    await import('../src/main.js');frame();assert.match(nodes.get('#hud').textContent,/Mode : Manuel/);
    nodes.get('#train-start').emit('click');frame();assert.equal(nodes.get('#drive-mode').value,'training');
    assert.equal(nodes.get('#export-network').disabled,true);
    nodes.get('#network-parameters').checked=true;
    assert.match(nodes.get('#hud').textContent,/Mode : Entraînement IA/);assert.match(nodes.get('#training-stats').textContent,/Population : 2/);
    nodes.get('#train-pause').emit('click');frame();assert.equal(nodes.get('#pause').textContent,'Reprendre');
    const frozen=nodes.get('#training-stats').textContent;frame();assert.equal(nodes.get('#training-stats').textContent,frozen);
    nodes.get('#train-resume').emit('click');frame();assert.equal(nodes.get('#pause').textContent,'Pause');
    nodes.get('#export-best').emit('click');const json=nodes.get('#network-json').value;assert.equal(JSON.parse(json).format,'NeuroDriveAI.feedforward');
    frame();assert.equal(nodes.get('#network-json').value,json);assert.ok(nodes.get('#network-inspection').textContent.length>0);
    nodes.get('#use-best').emit('click');frame();assert.equal(nodes.get('#drive-mode').value,'autonomous');assert.match(nodes.get('#hud').textContent,/Mode : Autonome/);
    nodes.get('#network-json').value=json;nodes.get('#import-best').emit('click');assert.match(nodes.get('#training-status').textContent,/importé/);
    nodes.get('#network-json').value='bad';nodes.get('#import-best').emit('click');assert.match(nodes.get('#training-status').textContent,/Erreur/);
    nodes.get('#training-population').value='0';nodes.get('#train-start').emit('click');assert.match(nodes.get('#training-status').textContent,/Erreur/);
    nodes.get('#training-population').value='2';nodes.get('#train-reset').emit('click');frame();assert.match(nodes.get('#training-stats').textContent,/Pause \/ prêt/);
    assert.match(nodes.get('#training-history').textContent,/Gén\./);
    nodes.get('#drive-mode').value='manual';nodes.get('#drive-mode').emit('change');nodes.get('#reset').emit('click');frame();assert.match(nodes.get('#hud').textContent,/Mode : Manuel/);
  }finally{globalThis.document=old.document;globalThis.window=old.window;globalThis.requestAnimationFrame=old.raf;}
});
