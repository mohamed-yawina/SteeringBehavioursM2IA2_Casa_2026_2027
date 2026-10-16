import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {load,Vector,makePath} from './reference-harness.mjs';
const near=(a,b)=>assert.ok(Math.abs(a-b)<=1e-12,`${a} != ${b}`);
function lab(){const e=load();e.LabController.reset();return e;}
test('composition: contributions convergentes, opposees et nulles, sans mutation',()=>{
 for(const [f,g] of [[[.3,0],[.3,0]],[[.3,0],[-.3,0]],[[0,0],[0,0]]]){
  const e=load(),v=new e.Vehicle(0,0,3,.3),a=new Vector(...f),b=new Vector(...g),before=JSON.stringify([a,b]);
  v.composeForces({follow:a,separation:b},{follow:2,separation:1.2});
  const expected=a.copy().mult(2).add(b.copy().mult(1.2)).limit(.3);
  near(v.acc.x,expected.x);near(v.acc.y,expected.y);assert.ok(v.acc.mag()<=.3+1e-15);
  assert.equal(JSON.stringify([a,b]),before);
 }
});
test('diagnostics: valeurs exactes, candidats et copies defensives imbriquees',()=>{
 const e=load(),v=new e.Vehicle(30,30,3,.3);v.applyBehaviors([v],makePath(e));
 const d=v.copyFollowDiagnostics(),f=v.copyForceDiagnostics();
 near(d.future.x,55);near(d.normal.x,55);near(d.target.x,80);assert.equal(d.selectedIndex,0);
 assert.equal(d.candidates.length,2);near(d.distance,30);assert.equal(d.active,true);
 near(f.weighted.follow.mag(),.6);near(f.total.mag(),.3);
 d.candidates[0].normal.x=999;d.target.x=999;f.weighted.follow.x=999;
 assert.notEqual(v.copyFollowDiagnostics().target.x,999);
 assert.notEqual(v.copyFollowDiagnostics().candidates[0].normal.x,999);
 assert.notEqual(v.copyForceDiagnostics().weighted.follow.x,999);
});
test('Path: heritage, pas de tirage aleatoire, immobilite sur 10 pas',()=>{
 const e=lab(),p=vm.runInContext('path',e.scope),before=JSON.stringify(p),calls=e.randomCalls();
 assert.ok(p instanceof e.Vehicle);assert.equal(p.vel.mag(),0);assert.equal(p.maxSpeed,0);
 p.update=()=>assert.fail('Path must never integrate');
 const state=JSON.stringify({points:p.points,pos:p.pos,vel:p.vel,acc:p.acc});
 for(let i=0;i<10;i++)e.LabController.step();
 assert.equal(JSON.stringify({points:p.points,pos:p.pos,vel:p.vel,acc:p.acc}),state);
 const start=e.randomCalls();new e.Path();assert.equal(e.randomCalls(),start);
 assert.ok(before.length>0);assert.ok(e.randomCalls()>=calls);
});
test('degeneres mixtes: segments nuls signales, segments valides exploitables',()=>{
 const e=load(),v=new e.Vehicle(30,30,3,.3);
 v.follow(makePath(e,[[0,0],[0,0],[100,0]]));
 const d=v.copyFollowDiagnostics();assert.equal(d.status,'defined');
 assert.equal(d.candidates[0].status,'undefined');assert.equal(d.selectedIndex,1);
});
test('parametres: zero accepte, anticipations negatives et limites invalides sans force',()=>{
 const e=load(),v=new e.Vehicle(30,30,3,.3),p=makePath(e);
 v.anticipationDistance=0;v.targetAdvance=0;v.follow(p);
 near(v.copyFollowDiagnostics().future.x,30);near(v.copyFollowDiagnostics().target.x,30);
 for(const key of ['anticipationDistance','targetAdvance','maxSpeed','maxForce']){
  for(const value of [-1,NaN,Infinity]){
   const a=new e.Vehicle(30,30,3,.3);a[key]=value;assert.equal(a.follow(p).mag(),0);assert.equal(a.copyFollowDiagnostics().status,'invalid');
  }
 }
});
test('Wander: changement RNG intentionnel a poids nul, activation consomme un tirage',()=>{
 const e=load(),v=new e.Vehicle(30,30,3,.3),p=makePath(e),theta=v.wanderTheta;
 const start=e.randomCalls();v.applyBehaviors([v],p);assert.equal(e.randomCalls(),start);near(v.wanderTheta,theta);
 v.wanderWeight=1;v.applyBehaviors([v],p);assert.equal(e.randomCalls(),start+1);assert.notEqual(v.wanderTheta,theta);
});
test('pause, pas unique et reprise: compte physique exact',()=>{
 const e=lab(),c=e.LabController;c.paused=true;
 assert.equal(c.step(),false);assert.equal(c.steps,0);
 c.requestStep();assert.equal(c.step(),true);assert.equal(c.steps,1);
 assert.equal(c.step(),false);assert.equal(c.steps,1);
 c.paused=false;c.step();assert.equal(c.steps,2);
});
test('tous scenarios reproductibles apres reset, y compris Wander actif',()=>{
 const e=lab(),c=e.LabController;
 for(const scenario of ['line','turn','complex','crossing','degenerate']){
  const run=()=>{c.reset(scenario);c.paused=false;c.setParameter('wanderWeight',1);
   for(let i=0;i<8;i++)c.step();
   return JSON.stringify(c.agents().map(a=>[a.pos.x,a.pos.y,a.vel.x,a.vel.y,a.wanderTheta]));};
  assert.equal(run(),run());assert.equal(c.steps,8);
 }
});
test('selection et parametres agissent sur le bon agent, Wander refuse pour serpent',()=>{
 const e=lab(),c=e.LabController,first=c.selected();c.setParameter('maxSpeed',0);assert.equal(first.maxSpeed,0);
 c.select(1);const head=c.selected();assert.notEqual(head,first);
 assert.equal(c.setParameter('anticipationDistance',77),true);assert.equal(head.anticipationDistance,77);
 c.setParameter('followPathWeight',3);assert.equal(vm.runInContext('snakes[0].followWeight',e.scope),3);
 assert.equal(c.setParameter('wanderWeight',1),false);
 assert.equal(c.setParameter('maxForce',NaN),false);
 c.select(999);assert.equal(c.selected(),head);
});
test('edition controlee: pause obligatoire, bornage, invalidation des diagnostics',()=>{
 const e=lab(),c=e.LabController;c.step();const a=c.selected();
 assert.ok(a.followDiagnostics);assert.equal(c.moveVertex(0,10,10),false);
 c.paused=true;c.editing=true;assert.equal(c.moveVertex(0,-20,9999),true);
 const p=vm.runInContext('path.points[0]',e.scope);near(p.x,0);near(p.y,800);
 assert.equal(a.followDiagnostics,null);assert.equal(a.forceDiagnostics,null);
 assert.equal(c.moveVertex(0,NaN,0),false);assert.equal(c.moveVertex(-1,0,0),false);
});
test('rendu et diagnostics UI: aucun calcul steering, integration ou tirage',()=>{
 const e=lab(),c=e.LabController;c.step();
 const a=c.selected(),before=JSON.stringify([a.pos,a.vel,a.acc,a.followDiagnostics,a.forceDiagnostics]),calls=e.randomCalls();
 a.follow=()=>assert.fail('follow during render');a.update=()=>assert.fail('update during render');
 vm.runInContext('debug=true',e.scope);
 e.LabRenderer.draw();e.LabUI.update();
 assert.equal(e.randomCalls(),calls);
 assert.equal(JSON.stringify([a.pos,a.vel,a.acc,a.followDiagnostics,a.forceDiagnostics]),before);
 assert.match(e.elements.get('diagnostics').textContent,/Resultante/);
});
test('UI: boutons et sliders relies au controleur, aucune integration directe',()=>{
 const e=lab();e.LabUI.bind();
 e.elements.get('pause').onclick();assert.equal(e.LabController.paused,true);
 e.elements.get('step').onclick();assert.equal(e.LabController.pendingStep,true);
 e.elements.get('maxForce').oninput({target:{value:'0.12'}});near(e.LabController.selected().maxForce,.12);
 e.elements.get('scenario').onchange({target:{value:'crossing'}});assert.equal(e.LabController.scenario,'crossing');
 e.elements.get('edit').onchange({target:{checked:true}});assert.equal(e.LabController.editing,true);
 e.elements.get('reset').onclick();assert.equal(e.LabController.steps,0);
});
test('serpents: plafonds et origine avant integration pour chaque anneau sur 30 pas',()=>{
 const e=lab(),c=e.LabController;
 for(let step=0;step<30;step++){c.step();
  for(const a of vm.runInContext('snakes[0].anneaux',e.scope)){
   const f=a.copyForceDiagnostics();assert.ok(f.total.mag()<=a.maxForce+1e-12);
   near(a.pos.x,f.origin.x+a.vel.x);near(a.pos.y,f.origin.y+a.vel.y);
  }
 }
});
test('raccourcis s/w/T et glissement conservent creation et corrigent maxSpeed',()=>{
 const e=lab();
 vm.runInContext('key="s";keyPressed({repeat:false})',e.scope);
 assert.equal(vm.runInContext('vehicles.at(-1).maxSpeed',e.scope),10);
 vm.runInContext('key="w";keyPressed({repeat:false})',e.scope);
 assert.equal(vm.runInContext('vehicles.at(-1).wanderWeight',e.scope),1);
 vm.runInContext('key="t";keyPressed({repeat:false})',e.scope);
 assert.equal(vm.runInContext('snakes.length',e.scope),2);
 const count=vm.runInContext('vehicles.length',e.scope);
 vm.runInContext('mouseDragged()',e.scope);assert.equal(vm.runInContext('vehicles.length',e.scope),count+1);
});
test('trajectoires corrigees: oracle independant du plafond a chaque pas et anneau',async()=>{
 const {trajectory}=await import('./reference-harness.mjs');
 for(const kind of ['vehicle-separation','snake-separation']){
  let clamped=0;
  trajectory(kind,{inspectStep(agents){
   for(const a of agents){
    const f=a.copyForceDiagnostics();
    const sum=Object.values(f.weighted).reduce((s,v)=>s.add(v),new Vector());
    const expected=sum.copy().limit(a.maxForce);
    near(f.total.x,expected.x);near(f.total.y,expected.y);
    const velocity=f.velocity.copy().add(expected).limit(a.maxSpeed);
    near(a.vel.x,velocity.x);near(a.vel.y,velocity.y);
    near(a.pos.x,f.origin.x+velocity.x);near(a.pos.y,f.origin.y+velocity.y);
    if(sum.mag()>a.maxForce)clamped++;
   }
  }});
  assert.ok(clamped>0);
 }
});
test('simulation et rendu restent separes sur la boucle complete, pause incluse',()=>{
 const e=lab(),c=e.LabController;c.paused=true;
 const count=c.steps;
 vm.runInContext('draw();draw()',e.scope);assert.equal(c.steps,count);
 c.requestStep();vm.runInContext('draw();draw()',e.scope);assert.equal(c.steps,count+1);
});
test('selection conservee quand un nouveau vehicule decale les tetes dans la liste',()=>{
 const e=lab();e.LabController.select(1);const head=e.LabController.selected();
 vm.runInContext('newVehicle(100,100)',e.scope);assert.equal(e.LabController.selected(),head);
});
test('Wander debug memorise et creation w presente immediatement dans la selection',()=>{
 const e=lab();vm.runInContext('key="w";keyPressed({repeat:false})',e.scope);
 assert.equal(e.elements.get('agent').children.length,3);
 e.LabController.select(1);e.LabController.step();
 const a=e.LabController.selected(),w=a.copyWanderDiagnostics();assert.ok(w);
 const before=JSON.stringify(w),calls=e.randomCalls();
 vm.runInContext('debug=true',e.scope);e.LabRenderer.draw();assert.equal(e.randomCalls(),calls);
 assert.equal(JSON.stringify(a.copyWanderDiagnostics()),before);
 w.target.x=999;assert.notEqual(a.copyWanderDiagnostics().target.x,999);
 a.wanderWeight=0;e.LabController.step();assert.equal(a.copyWanderDiagnostics(),null);
});
