import {createHash} from 'node:crypto';
﻿import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Load only the Vector module from the original local Browserify bundle.
// No library is copied, rewritten, or replaced by a vector approximation.
export function load(seed = 2027, {historical = true, dom = false} = {}) {
  const warnings=[], graphics=[];
  const scope=vm.createContext({console:{warn:(...a)=>warnings.push(a.join(' ')),log(){}}});
  const source=readFileSync(new URL('../libraries/p5.min.js',import.meta.url),'utf8');
  const markers=[...source.matchAll(/(\d+):\[function\(e,t,r\)\{/g)];
  const anchor=source.indexOf('p5.Vector.prototype.mult:');
  const entry=markers.filter(m=>m.index<anchor).at(-1);
  const next=markers.find(m=>m.index>entry?.index);
  if(anchor<0||!entry||!next)throw Error('Unsupported local p5 bundle: review Vector extraction');
  const bundled=vm.runInContext('('+source.slice(entry.index+entry[1].length+1,next.index-1)+')',scope);
  function P5(){}
  P5._friendlyError=(...args)=>warnings.push(args.join(' '));
  bundled[0](name=>{
    if(name.includes('core/main'))return {__esModule:true,default:P5};
    if(name.includes('constants'))return {TWO_PI:Math.PI*2};
    if(name.startsWith('core-js/'))return {}; // Native Node implements these polyfills.
    throw Error('Unexpected p5 Vector dependency: '+name);
  },{exports:{}},{});
  let state=seed>>>0,randomCalls=0;
  const random=(a=1,b)=>{
    randomCalls++;state=(Math.imul(state,1664525)+1013904223)>>>0;
    const u=state/4294967296;
    return b===undefined?u*a:Math.min(a,b)+u*Math.abs(b-a);
  };
  Object.assign(scope,{p5:P5,createVector:(x,y)=>new P5.Vector(x,y),
    width:1200,height:800,windowWidth:1200,windowHeight:800,mouseX:300,mouseY:100,
    frameRate(){},randomSeed(value){state=value>>>0;},constrain:(v,a,b)=>Math.min(b,Math.max(a,v)),
    drawingContext:{setLineDash(){}},text(){},
    random,min:Math.min,map:(v,a,b,c,d)=>c+(v-a)/(b-a)*(d-c),createCanvas(){}});
  for(const name of ['push','pop','fill','stroke','strokeWeight','noStroke','noFill',
    'translate','rotate','triangle','line','circle','ellipse','rect','background'])
    scope[name]=(...args)=>graphics.push({name,args});
  const elements=new Map();
  const element=()=>({value:'',checked:false,disabled:false,textContent:'',children:[],
    replaceChildren(){this.children=[];},append(child){this.children.push(child);}});
  if(dom)scope.document={activeElement:{matches:()=>false},createElement:element,
    getElementById(id){if(!elements.has(id))elements.set(id,element());return elements.get(id);}};
  const frozen = historical ? JSON.parse(readFileSync(new URL('./historical-sources.json',import.meta.url),'utf8')) : null;
  const scripts=historical?['obstacle.js','vehicle.js','sketch.js']:['vehicle.js','obstacle.js','target.js','lab-scenarios.js','lab-controller.js','lab-renderer.js','lab-ui.js','sketch.js'];
  for(const file of scripts) {
    const code=historical?frozen.sources[file]:readFileSync(new URL('../'+file,import.meta.url),'utf8');
    if(historical && createHash('sha256').update(code).digest('hex')!==frozen.sha256[file])
      throw Error('Historical source checksum mismatch: '+file);
    vm.runInContext(code,scope,{filename:(historical?'historical/':'')+file});
  }
  scope.__seededRandom=()=>random();
  vm.runInContext('Math.random=__seededRandom',scope);
  const classes=vm.runInContext('({Vehicle,Obstacle,Target})',scope);
  const labs=historical?{}:vm.runInContext('({LabController,LabRenderer,LabUI,LabScenarios,LabDefaults})',scope);
  const env={scope,...classes,...labs,elements,Vector:P5.Vector,warnings,graphics,randomCalls:()=>randomCalls};
  env.setVehicles=values=>{scope.__vehicles=values;vm.runInContext('vehicules=__vehicles',scope);};
  return env;
}
export const xy=v=>[v.x,v.y];
export function vehicle(env,pos=[100,100],vel=[1,0]){
  const v=new env.Vehicle(...pos);v.vel.set(...vel);return v;
}
export function obstacles(env,points){return points.map(p=>new env.Obstacle(...p,'green'));}

// Observe REAL branches without implementing another detector.
// Debug's first circles are Q30/Q15; the avoidance drawVector origin is C,
// and its raw vector ends at the sample actually selected by avoid().
export function observeAvoid(env,v,list,method=v.avoid){
  if(typeof v.copyAvoidDiagnostics==='function'){
    const force=method.call(v,list),d=v.copyAvoidDiagnostics();
    return {force,observation:{origin:xy(v.pos),q30:d.q30?xy(d.q30):null,q15:d.q15?xy(d.q15):null,
      selectedIndex:d.selectedIndex??-1,selectedCenter:d.center?xy(d.center):null,
      detected:d.detected,selectedSample:d.detected&&d.sample?xy(d.sample):null}};
  }
  const originalDebug=env.Vehicle.debug, originalDraw=v.drawVector;
  const originalClosest=v.getObstacleLePlusProche, vectors=[];
  let selected;
  env.graphics.length=0;
  env.Vehicle.debug=true;
  v.drawVector=(origin,vector,color)=>vectors.push({origin:xy(origin),vector:xy(vector),color});
  v.getObstacleLePlusProche=function(values){
    selected=originalClosest.call(this,values);return selected;
  };
  try{
    const force=method.call(v,list);
    const circles=env.graphics.filter(g=>g.name==='circle');
    const detectionVector=vectors[2];
    return {force, observation:{
      origin:xy(v.pos),q30:circles[0].args.slice(0,2),q15:circles[1].args.slice(0,2),
      selectedIndex:list.indexOf(selected),selectedCenter:selected?xy(selected.pos):null,
      detected:!!detectionVector,
      selectedSample:detectionVector?detectionVector.origin.map((n,i)=>n+detectionVector.vector[i]):null
    }};
  }finally{
    env.Vehicle.debug=originalDebug;v.drawVector=originalDraw;v.getObstacleLePlusProche=originalClosest;
  }
}

export const weights={arrive:.2,avoid:3,separate:.2,boundaries:3};
export function runTrajectory(kind, {historical=true} = {}){
  const env=load(2027,{historical}),V=env.Vector;
  const main=vehicle(env,kind==='boundaries'?[10,100]:[100,100]);
  const agents=kind==='separate'?[main,vehicle(env,[110,104],[.5,0]),vehicle(env,[95,110],[0,.5])]:[main];
  const neighbors=kind==='full'?[main,vehicle(env,[110,104])]:agents;
  env.setVehicles(neighbors);
  const list=obstacles(env,[[130,105,10],[350,250,30]]),target=new V(300,100),frames=[];
  for(let step=0;step<5;step++){
    const frame=[];
    for(const v of agents){
      const before={position:xy(v.pos),velocity:xy(v.vel),acceleration:xy(v.acc)};
      const individual={},weighted={},observations=[];
      let applications=0;
      const originalApply=v.applyForce;
      v.applyForce=function(f){applications++;return originalApply.call(this,f);};
      if(kind==='full'){
        const originals={};
        for(const name of Object.keys(weights)){
          originals[name]=v[name];
          v[name]=function(...args){
            let force;
            if(name==='avoid'){
              const result=observeAvoid(env,this,args[0],originals[name]);force=result.force;observations.push(result.observation);
            }else force=originals[name].apply(this,args);
            individual[name]=xy(force);return force;
          };
        }
        try{v.applyBehaviors(target,list);}finally{for(const name of Object.keys(weights))v[name]=originals[name];}
        for(const name of Object.keys(weights))weighted[name]=individual[name].map(n=>n*weights[name]);
      }else{
        const names=kind==='arrive-avoid'?['arrive','avoid']:[kind];
        for(const name of names){
          let force;
          if(name==='avoid'){const result=observeAvoid(env,v,list);force=result.force;observations.push(result.observation);}
          else if(name==='arrive')force=v.arrive(target);
          else if(name==='separate')force=v.separate(neighbors);
          else force=v.boundaries(0,0,1200,800,25);
          individual[name]=xy(force);
          // Isolated behaviors use weight 1; the paired scenario uses historical weights.
          const weight=kind==='arrive-avoid'?weights[name]:1;
          force.mult(weight);weighted[name]=xy(force);v.applyForce(force);
        }
      }
      const resultant=xy(v.acc);
      v.applyForce=originalApply;v.update();
      frame.push({before,individual,weighted,resultant,applications,
        detection:observations[0]??null,
        after:{position:xy(v.pos),velocity:xy(v.vel),acceleration:xy(v.acc)}});
    }
    frames.push(frame);
  }
  return frames;
}
