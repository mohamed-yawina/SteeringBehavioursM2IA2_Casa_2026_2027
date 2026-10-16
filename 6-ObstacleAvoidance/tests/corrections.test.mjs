import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {load,vehicle,obstacles,xy,runTrajectory,observeAvoid} from './reference-harness.mjs';
const corrected=()=>load(2027,{historical:false});
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-12,`${a} != ${b}`);
const point=(a,b)=>a.forEach((n,i)=>near(n,b[i]));
const bounded=(v,limit)=>{assert.ok(Number.isFinite(v.x)&&Number.isFinite(v.y));assert.ok(v.mag()<=limit+1e-12);};
test('Separate corrigé: formule exacte, force limitée, aucune mutation',()=>{
 const e=corrected(),v=vehicle(e),other=vehicle(e,[110,100]);
 const before=JSON.stringify([v.pos,v.vel,v.acc,other.pos,other.vel]);
 const expected=new e.Vector(-4,0).sub(v.vel).limit(.2),f=v.separate([v,other]);
 point(xy(f),xy(expected));bounded(f,.2);assert.equal(e.warnings.length,0);
 assert.equal(JSON.stringify([v.pos,v.vel,v.acc,other.pos,other.vel]),before);
});
test('Separate corrigé: voisins éloignés, superposés, nuls et invalides',()=>{
 const e=corrected(),v=vehicle(e);
 for(const neighbors of [[],[v],[vehicle(e,[600,400])],[vehicle(e,[100,100])],[null,{}],null])
  assert.equal(v.separate(neighbors).mag(),0);
 const other=vehicle(e,[110,100]);other.pos.x=Infinity;assert.equal(v.separate([other]).mag(),0);
});
test('Separate corrigé: moyenne de plusieurs voisins et exclusion exacte distance r',()=>{
 const e=corrected(),v=vehicle(e),a=vehicle(e,[110,100]),b=vehicle(e,[100,120]);
 const desired=new e.Vector(-.1,-.05).div(2).normalize().mult(4);
 point(xy(v.separate([v,a,b])),xy(desired.sub(v.vel).limit(.2)));
 assert.equal(v.separate([vehicle(e,[148,100])]).mag(),0);
});
test('Separate corrigé: maxForce zéro et maxSpeed zéro',()=>{
 const e=corrected(),v=vehicle(e),other=vehicle(e,[110,100]);v.maxForce=0;
 assert.equal(v.separate([other]).mag(),0);v.maxForce=.2;v.maxSpeed=0;
 point(xy(v.separate([other])),[-.2,0]);v.vel.set(0,0);assert.equal(v.separate([other]).mag(),0);
});
test('Separate et Boundaries: paramètres ou états invalides donnent force finie nulle',()=>{
 for(const property of ['maxSpeed','maxForce']){
  for(const value of [NaN,Infinity,-1]){
   const e=corrected(),v=vehicle(e);v[property]=value;
   assert.equal(v.separate([vehicle(e,[110,100])]).mag(),0);
   assert.equal(v.boundaries(0,0,1200,800,25).mag(),0);
  }
 }
 const e=corrected(),v=vehicle(e);v.vel.x=Infinity;
 assert.equal(v.separate([]).mag(),0);assert.equal(v.boundaries(0,0,1200,800,25).mag(),0);
});
test('Boundaries corrigé: vitesse déjà désirée ne produit aucune force',()=>{
 const e=corrected(),v=vehicle(e,[10,100],[4,0]);assert.equal(v.boundaries(0,0,1200,800,25).mag(),0);
});
test('Boundaries corrigé: steering exact aux quatre bords',()=>{
 const e=corrected();
 for(const [pos,vel,desired] of [
  [[10,100],[-1,0],[4,0]],[[1190,100],[1,0],[-4,0]],
  [[100,10],[0,-1],[0,4]],[[100,790],[0,1],[0,-4]]
 ]){
  const v=vehicle(e,pos,vel),f=v.boundaries(0,0,1200,800,25);
  point(xy(f),xy(new e.Vector(...desired).setMag(4).sub(v.vel).limit(.2)));bounded(f,.2);
 }
});
test('Boundaries corrigé: seuils, coins, limites nulles et rectangle invalide',()=>{
 const e=corrected(),v=vehicle(e,[25,100]);assert.equal(v.boundaries(0,0,1200,800,25).mag(),0);
 v.pos.set(10,10);v.vel.set(-1,-1);
 point(xy(v.boundaries(0,0,1200,800,25)),xy(new e.Vector(-1,4).setMag(4).sub(v.vel).limit(.2)));
 v.maxForce=0;assert.equal(v.boundaries(0,0,1200,800,25).mag(),0);
 v.maxForce=.2;v.maxSpeed=0;point(xy(v.boundaries(0,0,1200,800,25)),xy(v.vel.copy().mult(-1).limit(.2)));
 assert.equal(v.boundaries(0,0,NaN,800,25).mag(),0);
});
test('Composition corrigée: convergente, opposée, nulle et maxForce nul',()=>{
 const sets=[
  [[.2,0],[.1,0],[.2,0],[.2,0]],
  [[.2,0],[-.1,0],[.2,0],[0,.2]],
  [[0,0],[0,0],[0,0],[0,0]]
 ];
 for(const vectors of sets)for(const limit of [.2,0]){
  const e=corrected(),v=vehicle(e);v.maxForce=limit;e.setVehicles([v]);
  const names=['arrive','avoid','separate','boundaries'],weights=[.2,3,.2,3],originals=[];
  names.forEach((name,i)=>{const f=new e.Vector(...vectors[i]);originals.push(f);v[name]=()=>f;});
  const before=JSON.stringify(originals),expected=originals.reduce((s,f,i)=>s.add(f.copy().mult(weights[i])),new e.Vector()).limit(limit);
  let calls=0;const apply=v.applyForce.bind(v);v.applyForce=f=>{calls++;apply(f);};
  assert.equal(v.applyBehaviors(new e.Vector(300,100),[]),true);
  point(xy(v.acc),xy(expected));bounded(v.acc,limit);assert.equal(calls,1);assert.equal(JSON.stringify(originals),before);
 }
});
test('Diagnostics composition: forces brutes, pondérées et total exacts, copies imbriquées',()=>{
 const e=corrected(),v=vehicle(e);e.setVehicles([v]);
 v.applyBehaviors(new e.Vector(300,100),obstacles(e,[[130,105,10]]));
 const d=v.copyForceDiagnostics();near(d.raw.arrive.mag(),.2);near(d.raw.avoid.mag(),.1);
 near(d.weighted.arrive.mag(),.04);near(d.weighted.avoid.mag(),.3);
 bounded(d.total,.2);point(xy(v.acc),xy(d.total));assert.ok(d.unclamped.mag()>.2);
 d.raw.avoid.x=999;d.weighted.arrive.y=999;d.total.x=999;d.origin.x=999;
 const next=v.copyForceDiagnostics();assert.notEqual(next.raw.avoid.x,999);assert.notEqual(next.weighted.arrive.y,999);
 assert.notEqual(next.total.x,999);assert.notEqual(next.origin.x,999);
});
test('Avoid corrigé: cas valides identiques au code historique, limites conservées',()=>{
 const cases=[
  [[130,105,5]],[[130,100,10]],[[120,100,10]],[[110,100,10]],[[90,100,5]],
  [[120,110,5],[120,90,5]],[[120,90,5],[120,110,5]],[[130,129,5]],[[130,128.999999,5]],
  [[130,105,0]],[[500,500,10]],[[130,105,10],[130,105,10]]
 ];
 for(const points of cases){
  const old=load(),e=corrected(),a=vehicle(old),b=vehicle(e);
  const historical=observeAvoid(old,a,obstacles(old,points)),actual=observeAvoid(e,b,obstacles(e,points));
  point(xy(actual.force),xy(historical.force));assert.equal(actual.observation.detected,historical.observation.detected);
  assert.equal(actual.observation.selectedIndex,historical.observation.selectedIndex);
  bounded(actual.force,.1);
 }
});
test('Avoid corrigé: X Q15 Q30, échantillon et seuil exacts, sans calcul graphique',()=>{
 const e=corrected(),v=vehicle(e),list=obstacles(e,[[115,105,10]]);
 e.Vehicle.debug=true;e.graphics.length=0;const f=v.avoid(list),d=v.copyAvoidDiagnostics();
 assert.equal(e.graphics.length,0);point(xy(d.origin),[100,100]);point(xy(d.q15),[115,100]);point(xy(d.q30),[130,100]);
 assert.equal(d.sampleName,'Q15');point(xy(d.sample),[115,100]);assert.equal(d.threshold,34);assert.equal(d.detected,true);point(xy(d.force),xy(f));
 d.q15.x=999;d.distances.q15=999;d.force.y=999;d.center.x=999;
 const next=v.copyAvoidDiagnostics();near(next.q15.x,115);near(next.distances.q15,5);near(next.center.x,115);near(next.force.y,-.1);
});
test('Avoid corrigé: liste vide ou invalide sans exception',()=>{
 const e=corrected(),v=vehicle(e);
 for(const list of [[],null,undefined,[null],[{}],[{pos:{x:0,y:0}}]]){
  assert.equal(v.avoid(list).mag(),0);assert.equal(v.copyAvoidDiagnostics().detected,false);
 }
});
test('Avoid corrigé: filtre NaN Infinity rayon invalide et conserve ordre des valides',()=>{
 const e=corrected(),v=vehicle(e),valid=new e.Obstacle(130,105,10);
 for(const value of [NaN,Infinity,-Infinity]){
  const invalid=new e.Obstacle(120,100,10);invalid.pos.x=value;
  point(xy(v.avoid([invalid,valid])),[0,-.1]);assert.equal(v.copyAvoidDiagnostics().selectedIndex,1);
  assert.deepEqual(Array.from(v.copyAvoidDiagnostics().rejected),[0]);
 }
 for(const radius of [NaN,Infinity,-1]){
  const invalid=new e.Obstacle(120,100,radius);assert.equal(v.avoid([invalid]).mag(),0);
 }
});
test('Avoid corrigé: grande distance sans sentinelle, égalités conservées',()=>{
 const e=corrected(),v=vehicle(e),far=new e.Obstacle(2e8,100,20);
 assert.equal(v.getObstacleLePlusProche([far]),far);assert.equal(v.avoid([far]).mag(),0);
 const list=obstacles(e,[[120,110,5],[120,90,5]]);assert.equal(v.getObstacleLePlusProche(list),list[0]);
 assert.equal(v.getObstacleLePlusProche([...list].reverse()),list[1]);
});
test('Avoid historique préservé: menace masquée, trou entre échantillons et vecteur nul',()=>{
 const e=corrected(),v=vehicle(e,[100,100],[4,0]);
 assert.equal(v.avoid(obstacles(e,[[100,140,1],[220,105,10]])).mag(),0);
 assert.equal(v.avoid(obstacles(e,[[130,100,1]])).mag(),0);
 v.vel.set(1,0);assert.equal(v.avoid(obstacles(e,[[130,100,10]])).mag(),0);assert.equal(v.copyAvoidDiagnostics().detected,true);
 v.vel.set(0,0);assert.equal(v.avoid(obstacles(e,[[100,100,100]])).mag(),0);assert.equal(v.copyAvoidDiagnostics().detected,true);
});
test('Avoid corrigé: limites nulles et état non fini sans force invalide',()=>{
 const e=corrected(),v=vehicle(e),list=obstacles(e,[[130,105,10]]);
 v.maxForce=0;assert.equal(v.avoid(list).mag(),0);v.maxForce=.2;v.maxSpeed=0;
 point(xy(v.avoid(list)),[0,-.1]);v.vel.x=Infinity;assert.equal(v.avoid(list).mag(),0);
 assert.equal(v.copyAvoidDiagnostics().status,'invalid');
});
test('Non-mutation: calcul et application préservent cible, obstacles, voisins et contributions',()=>{
 const e=corrected(),v=vehicle(e),other=vehicle(e,[110,104]),list=obstacles(e,[[130,105,10]]),target=new e.Vector(300,100);
 const before=JSON.stringify([v.pos,v.vel,other.pos,other.vel,list,target]);e.setVehicles([v,other]);
 v.applyBehaviors(target,list);assert.equal(JSON.stringify([v.pos,v.vel,other.pos,other.vel,list,target]),before);
});
test('Obstacle et Target: héritage, limites nulles et immobilité sur dix draw',()=>{
 const e=corrected();vm.runInContext('setup()',e.scope);
 const t=vm.runInContext('target',e.scope),list=vm.runInContext('obstacles',e.scope);
 assert.ok(t instanceof e.Target && t instanceof e.Vehicle);assert.ok(list[0] instanceof e.Vehicle);
 for(const obj of [t,...list]){
  obj.update=()=>assert.fail('static integration');obj.applyForce=()=>assert.fail('static force');
  assert.equal(obj.vel.mag(),0);assert.equal(obj.acc.mag(),0);assert.equal(obj.maxSpeed,0);assert.equal(obj.maxForce,0);
 }
 const before=JSON.stringify(list.map(o=>[o.pos,o.r]));
 for(let i=0;i<10;i++)vm.runInContext('draw()',e.scope);
 assert.equal(JSON.stringify(list.map(o=>[o.pos,o.r])),before);
 e.scope.mouseX=450;e.scope.mouseY=320;vm.runInContext('draw()',e.scope);point(xy(t.pos),[450,320]);
});
test('Cible: apparence historique rouge de diamètre 32 et position souris',()=>{
 const e=corrected();vm.runInContext('setup()',e.scope);const t=vm.runInContext('target',e.scope);
 e.graphics.length=0;t.show();assert.ok(e.graphics.some(g=>g.name==='fill'&&JSON.stringify(g.args)==='[255,0,0]'));
 assert.ok(e.graphics.some(g=>g.name==='circle'&&JSON.stringify(g.args)==='[300,100,32]'));
});
test('Interactions: clic, v, d, f et rendu multiple conservés',()=>{
 const e=corrected();vm.runInContext('setup();mousePressed();key="v";keyPressed();key="f";keyPressed();key="d";keyPressed();draw()',e.scope);
 assert.equal(vm.runInContext('vehicules.length',e.scope),12);assert.equal(vm.runInContext('obstacles.length',e.scope),2);
 assert.equal(e.Vehicle.debug,true);assert.equal(vm.runInContext('vehicules.every(v=>v.path.length===1)',e.scope),true);
});
test('Boucle réelle: une application et une intégration par agent, zéro pour statiques',()=>{
 const e=corrected();vm.runInContext('setup();key="v";keyPressed()',e.scope);
 const agents=vm.runInContext('vehicules',e.scope),events=Array.from(agents,()=>[]);
 agents.forEach((v,i)=>{const a=v.applyForce.bind(v),u=v.update.bind(v);v.applyForce=f=>{events[i].push('apply');a(f);};v.update=()=>{events[i].push('update');u();};});
 vm.runInContext('draw()',e.scope);for(const event of events)assert.deepEqual(event,['apply','update']);
});
test('Agent invalide: aucune intégration et aucun rendu de coordonnées invalides',()=>{
 const e=corrected();vm.runInContext('setup()',e.scope);const v=vm.runInContext('vehicules[0]',e.scope);
 v.vel.x=Infinity;v.update=()=>assert.fail('invalid integration');v.show=()=>assert.fail('invalid render');
 vm.runInContext('draw()',e.scope);assert.equal(v.copyForceDiagnostics().status,'invalid');
});
test('Rendu debug: aucun recalcul de force ou intégration, données inchangées',()=>{
 const e=corrected(),v=vehicle(e);e.setVehicles([v]);v.applyBehaviors(new e.Vector(300,100),obstacles(e,[[130,105,10]]));v.update();
 const before=JSON.stringify([v.pos,v.vel,v.acc,v.copyAvoidDiagnostics(),v.copyForceDiagnostics()]),calls=e.randomCalls();
 v.avoid=()=>assert.fail('avoid during show');v.boundaries=()=>assert.fail('boundaries during show');v.update=()=>assert.fail('update during show');
 e.Vehicle.debug=true;v.show();assert.ok(e.graphics.length>0);
 assert.equal(JSON.stringify([v.pos,v.vel,v.acc,v.copyAvoidDiagnostics(),v.copyForceDiagnostics()]),before);assert.equal(e.randomCalls(),calls);
});
test('Constructeur préservé hors horizons autorisés; Seek applyForce update edges inchangés',()=>{
 const frozen=JSON.parse(readFileSync(new URL('./historical-sources.json',import.meta.url),'utf8')).sources['vehicle.js'];
 const current=readFileSync(new URL('../vehicle.js',import.meta.url),'utf8');
 const method=(s,name)=>{const start=s.indexOf('  '+name+'('),body=s.indexOf('{',start);let count=0;for(let i=body;i<s.length;i++){if(s[i]==='{')count++;if(s[i]==='}'&&--count===0)return s.slice(start,i+1);}};
 for(const name of ['constructor','seek','applyForce','update','edges']){
 const actual=name==='constructor'?method(current,name).replace(/    this.shortHorizon = 15;\r?\n    this.longHorizon = 30;\r?\n    this.behaviorWeights = \{arrive:0\.2, avoid:3, separate:0\.2, boundaries:3\};\r?\n    this.avoidEnabled = true;\r?\n/,''):method(current,name);
  assert.equal(actual,method(frozen,name));
 }
});
test('Références préservées: Arrive, Avoid, combinaison isolée et bordure axiale à 1e-12',()=>{
 for(const kind of ['arrive','avoid','arrive-avoid','boundaries']){
  const before=runTrajectory(kind),after=runTrajectory(kind,{historical:false});
  for(let step=0;step<5;step++){
   point(after[step][0].after.position,before[step][0].after.position);
   point(after[step][0].after.velocity,before[step][0].after.velocity);
   for(const name of Object.keys(before[step][0].individual))point(after[step][0].individual[name],before[step][0].individual[name]);
  }
 }
});
test('Trajectoires modifiées: Separate et composition complète, résultat reproductible',()=>{
 for(const kind of ['separate','full']){
  const old=runTrajectory(kind),actual=runTrajectory(kind,{historical:false});
  assert.notEqual(JSON.stringify(actual.map(f=>f.map(a=>a.after.position))),JSON.stringify(old.map(f=>f.map(a=>a.after.position))));
  assert.equal(JSON.stringify(actual),JSON.stringify(runTrajectory(kind,{historical:false})));
  for(const frame of actual)for(const agent of frame){
   const e=corrected(),sum=Object.values(agent.weighted).reduce((s,f)=>s.add(new e.Vector(...f)),new e.Vector());
   if(kind==='full')sum.limit(.2);
   point(agent.resultant,xy(sum));bounded(new e.Vector(...agent.resultant),.2);
   const velocity=new e.Vector(...agent.before.velocity).add(sum).limit(4);
   point(agent.after.velocity,xy(velocity));point(agent.after.position,xy(new e.Vector(...agent.before.position).add(velocity)));
  }
 }
});
test('Boundaries: trajectoire oblique volontairement modifiée par le steering correct',()=>{
 const simulate=historical=>{
  const e=load(2027,{historical}),v=vehicle(e,[10,100],[1,1]),states=[];
  for(let i=0;i<5;i++){
   const force=v.boundaries(0,0,1200,800,25);
   if(!historical){
    const desired=new e.Vector(4,v.vel.y).setMag(4);
    point(xy(force),xy(desired.sub(v.vel).limit(.2)));
   }
   v.applyForce(force);v.update();states.push([...xy(v.pos),...xy(v.vel)]);
  }return states;
 };
 assert.notEqual(JSON.stringify(simulate(true)),JSON.stringify(simulate(false)));
});
test('Attentes corrigées séparées: six scénarios numériques figés à 1e-12',()=>{
 const fixtures=JSON.parse(readFileSync(new URL('./corrected-trajectories.json',import.meta.url),'utf8'));
 const compare=(actual,expected)=>{
  if(typeof expected==='number'){near(actual,expected);return;}
  if(Array.isArray(expected)){assert.equal(actual.length,expected.length);expected.forEach((v,i)=>compare(actual[i],v));return;}
  if(expected&&typeof expected==='object'){
   assert.deepEqual(Object.keys(actual),Object.keys(expected));for(const k of Object.keys(expected))compare(actual[k],expected[k]);return;
  }assert.equal(actual,expected);
 };
 for(const [kind,expected] of Object.entries(fixtures.scenarios))compare(runTrajectory(kind,{historical:false}),expected);
});
