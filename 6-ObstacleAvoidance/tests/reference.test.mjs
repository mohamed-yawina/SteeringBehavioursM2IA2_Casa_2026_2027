import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {load,vehicle,obstacles,observeAvoid,xy,runTrajectory,weights} from './reference-harness.mjs';
const close=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-12,`${a} != ${b}`);
const point=(a,b)=>{assert.equal(a.length,b.length);a.forEach((n,i)=>close(n,b[i]));};
function sample(points,vel=[1,0],pos=[100,100]){
 const env=load(),v=vehicle(env,pos,vel),list=obstacles(env,points);
 return {...observeAvoid(env,v,list),env,v,list};
}
test('harness: véritable Vector local, RNG reproductible et non constant',()=>{
 const a=load(7),b=load(7),c=load(8);
 assert.equal(typeof a.Vector.prototype.dist,'function');
 const values=e=>Array.from({length:4},()=>vm.runInContext('random(0,1)',e.scope));
 const first=values(a);assert.deepEqual(first,values(b));assert.notDeepEqual(first,values(c));assert.equal(new Set(first).size,4);
 const v=new a.Vector(1,0);v.mult(undefined);point(xy(v),[1,0]);
 assert.match(a.warnings.at(-1),/not a finite number/);
});
test('constructeur: état initial, paramètres physiques et géométriques',()=>{
 const e=load(),v=new e.Vehicle(12,34);
 point(xy(v.pos),[12,34]);point(xy(v.vel),[0,0]);point(xy(v.acc),[0,0]);
 assert.equal(v.maxSpeed,4);assert.equal(v.maxForce,.2);assert.equal(v.r_pourDessin,16);
 assert.equal(v.r,48);assert.equal(v.largeurZoneEvitementDevantVaisseau,24);
 assert.equal(v.path.length,0);assert.equal(v.pathMaxLength,30);assert.equal(v.dureeDeVie,5);
});
test('détection: X, Q15 et Q30 sont observés dans le vrai calcul',()=>{
 const r=sample([[130,105,5]]);
 point(r.observation.origin,[100,100]);point(r.observation.q15,[115,100]);point(r.observation.q30,[130,100]);
});
test('anticipation: distance proportionnelle à la vitesse, pas normalisée',()=>{
 const r=sample([[220,105,10]],[4,0]);point(r.observation.q15,[160,100]);point(r.observation.q30,[220,100]);
});
test('sélection: centre le plus proche, rayon non utilisé pour le classement',()=>{
 const e=load(),v=vehicle(e),list=obstacles(e,[[120,100,0],[140,100,1000]]);
 assert.equal(v.getObstacleLePlusProche(list),list[0]);
});
test('sélection: égalité départagée par ordre du tableau',()=>{
 const e=load(),v=vehicle(e),list=obstacles(e,[[120,110,5],[120,90,5]]);
 assert.equal(v.getObstacleLePlusProche(list),list[0]);
 assert.equal(v.getObstacleLePlusProche([...list].reverse()),list[1]);
});
test('échantillon retenu: Q30, Q15 puis X selon la distance',()=>{
 for(const [center,expected] of [[[130,105,5],[130,100]],[[115,105,5],[115,100]],[[100,105,5],[100,100]]]){
  const r=sample([center]);point(r.observation.selectedSample,expected);assert.equal(r.observation.detected,true);
 }
});
test('échantillons équidistants: Q30 est conservé devant Q15',()=>{
 point(sample([[122.5,100,5]]).observation.selectedSample,[130,100]);
});
test('seuil: strictement inférieur au rayon obstacle plus 24',()=>{
 assert.equal(sample([[130,129,5]]).observation.detected,false);
 assert.equal(sample([[130,129-1e-8,5]]).observation.detected,true);
 assert.equal(sample([[130,129+1e-8,5]]).force.mag(),0);
});
test('obstacle éloigné: force nulle',()=>assert.equal(sample([[500,500,10]]).force.mag(),0));
test('obstacle directement devant: force longitudinale historique',()=>{
 point(xy(sample([[120,100,10]]).force),[-.1,0]);
 point(xy(sample([[110,100,10]]).force),[.1,0]);
});
test('obstacle latéral: direction opposée au centre',()=>point(xy(sample([[130,105,5]]).force),[0,-.1]));
test('obstacle proche derrière: X permet une détection',()=>{
 const r=sample([[90,100,5]]);point(r.observation.selectedSample,[100,100]);point(xy(r.force),[.1,0]);
});
test('limite historique: menace masquée par un centre proche non dangereux',()=>{
 const r=sample([[100,140,1],[220,105,10]],[4,0]);
 assert.equal(r.observation.selectedIndex,0);assert.equal(r.observation.detected,false);
 assert.equal(r.force.mag(),0);assert.ok(sample([[220,105,10]],[4,0]).force.mag()>0);
});
test('limite historique: petit obstacle entre les points non détecté',()=>{
 const r=sample([[130,100,1]],[4,0]);assert.equal(r.observation.detected,false);assert.equal(r.force.mag(),0);
});
test('défaut à corriger: centre exactement sur Q30, détection mais force nulle',()=>{
 const r=sample([[130,100,10]]);assert.equal(r.observation.detected,true);assert.equal(r.force.mag(),0);
});
test('vitesse nulle: Q15=Q30=X, répulsion possible hors centre',()=>{
 const r=sample([[110,100,10]],[0,0]);point(r.observation.q15,[100,100]);point(r.observation.q30,[100,100]);point(xy(r.force),[-.1,0]);
});
test('rayon obstacle nul: marge véhicule conservée',()=>assert.equal(sample([[130,105,0]]).observation.detected,true));
test('obstacles superposés: premier retenu et force finie',()=>{
 const r=sample([[130,105,10],[130,105,10]]);assert.equal(r.observation.selectedIndex,0);close(r.force.mag(),.1);
});
test('obstacles symétriques: changer ordre inverse le côté choisi',()=>{
 const a=sample([[120,110,5],[120,90,5]]),b=sample([[120,90,5],[120,110,5]]);
 close(a.force.x,b.force.x);close(a.force.y,-b.force.y);assert.ok(a.force.y<0);
});
test('Arrive: ralentissement, freinage à distance zéro et borne individuelle',()=>{
 const e=load(),v=vehicle(e);const f=v.arrive(new e.Vector(125,100));assert.equal(f.mag(),0);
 point(xy(v.arrive(new e.Vector(100,100))),[-.2,0]);
 const far=v.arrive(new e.Vector(300,100));point(xy(far),[.2,0]);assert.ok(far.mag()<=v.maxForce);
});
test('Avoid: norme maxForce/2, indépendante de la profondeur détectée',()=>{
 for(const y of [101,105,120])close(sample([[130,y,10]]).force.mag(),.1);
});
test('défaut à corriger: Avoid diffère de desiredVelocity moins velocity',()=>{
 const r=sample([[130,105,10]]);
 const desired=new r.env.Vector(0,-4).sub(r.v.vel).limit(.1);
 assert.ok(Math.abs(desired.x-r.force.x)>1e-3);
});
test('défaut à corriger: Separate mauvais noms, norme 1 et avertissement p5',()=>{
 const e=load(),v=vehicle(e),other=vehicle(e,[110,100]);const f=v.separate([v,other]);
 point(xy(f),[-1,0]);assert.ok(f.mag()>v.maxForce);assert.match(e.warnings.join(' '),/undefined|finite/);
 assert.equal(v.maxspeed,undefined);assert.equal(v.velocity,undefined);assert.equal(v.maxforce,undefined);
});
test('Separate: aucun voisin, voisin éloigné ou superposé donnent zéro',()=>{
 const e=load(),v=vehicle(e);
 for(const list of [[],[v],[vehicle(e,[500,500])],[vehicle(e,[100,100])]])assert.equal(v.separate(list).mag(),0);
});
test('défaut à corriger: Boundaries retourne desired même si steering serait nul',()=>{
 const e=load(),v=vehicle(e,[10,100],[4,0]);
 point(xy(v.boundaries(0,0,1200,800,25)),[.2,0]);
 const desired=new e.Vector(4,0);assert.equal(desired.sub(v.vel).mag(),0);
});
test('Boundaries: centre et seuil exact sans force; coin garde priorité verticale',()=>{
 const e=load(),v=vehicle(e,[25,100]);assert.equal(v.boundaries(0,0,1200,800,25).mag(),0);
 v.pos.set(10,10);v.vel.set(-1,-1);const f=v.boundaries(0,0,1200,800,25);
 assert.ok(f.x<0&&f.y>0);close(f.mag(),.2);
});
test('composition: poids exacts, 4 applications et somme non plafonnée',()=>{
 const e=load(),v=vehicle(e),list=obstacles(e,[[130,105,10]]);e.setVehicles([v]);
 const calls=[],individual={};const names=Object.keys(weights);
 for(const name of names){const original=v[name];v[name]=function(...args){const f=original.apply(this,args);individual[name]=f.copy();return f;};}
 const original=v.applyForce.bind(v);v.applyForce=f=>{calls.push(f.copy());original(f);};
 v.applyBehaviors(new e.Vector(300,100),list);
 assert.equal(calls.length,4);names.forEach((name,i)=>point(xy(calls[i]),xy(individual[name].mult(weights[name]))));
 const sum=calls.reduce((a,f)=>a.add(f),new e.Vector());point(xy(v.acc),xy(sum));assert.ok(sum.mag()>v.maxForce);
});
test('applyForce et update: accumulation, limite de vitesse, déplacement puis remise à zéro',()=>{
 const e=load(),v=vehicle(e),force=new e.Vector(100,100),before=xy(force),start=v.pos.copy();
 v.applyForce(force);point(xy(force),before);v.update();close(v.vel.mag(),4);
 point(xy(v.pos),xy(start.add(v.vel)));assert.equal(v.acc.mag(),0);assert.equal(v.path.length,1);close(v.dureeDeVie,4.99);
});
test('draw réel: quatre forces puis une intégration et un rendu par agent',()=>{
 const e=load(),v=vehicle(e),events=[];e.setVehicles([v]);e.scope.__obstacles=obstacles(e,[[600,400,100]]);
 vm.runInContext('obstacles=__obstacles',e.scope);
 const a=v.applyForce.bind(v),u=v.update.bind(v);v.applyForce=f=>{events.push('apply');a(f);};v.update=()=>{events.push('update');u();};
 v.show=()=>events.push('show');vm.runInContext('draw()',e.scope);
 assert.deepEqual(events,['apply','apply','apply','apply','update','show']);
});
test('non-mutation: calculs de forces préservent état, cible et obstacles',()=>{
 const e=load(),v=vehicle(e),other=vehicle(e,[110,104]),list=obstacles(e,[[130,105,10]]),target=new e.Vector(300,100);
 const state=()=>JSON.stringify([v.pos,v.vel,v.acc,other.pos,other.vel,target,list.map(o=>[o.pos,o.r])]);
 const before=state();v.arrive(target);v.avoid(list);v.separate([v,other]);v.boundaries(0,0,1200,800,25);
 assert.equal(state(),before);
});
test('observation debug: aucun effet sur force, état ou aléatoire',()=>{
 const e=load(),v=vehicle(e),list=obstacles(e,[[130,105,10]]),before=JSON.stringify([v.pos,v.vel,v.acc,list]),calls=e.randomCalls();
 const plain=v.avoid(list);const observed=observeAvoid(e,v,list).force;point(xy(plain),xy(observed));
 assert.equal(JSON.stringify([v.pos,v.vel,v.acc,list]),before);assert.equal(e.randomCalls(),calls);
});
test('défaut à corriger: liste vide et objet obstacle invalide provoquent exceptions',()=>{
 const e=load(),v=vehicle(e);
 for(const list of [[],[null],[{}],[{r:10}]] )assert.throws(()=>v.avoid(list));
});
test('défaut à corriger: sentinelle exclut les centres à très grande distance',()=>{
 const e=load(),v=vehicle(e),list=obstacles(e,[[2e8,0,20]]);
 assert.equal(v.getObstacleLePlusProche(list),undefined);assert.throws(()=>v.avoid(list),/pos/);
});
test('entrées invalides: NaN masqué par p5, Infinity sans obstacle sélectionné',()=>{
 const e=load(),v=vehicle(e),o=new e.Obstacle(130,105,10);o.pos.x=NaN;
 point(xy(v.avoid([o])),[0,0]);
 for(const value of [Infinity,-Infinity]){
  const invalid=new e.Obstacle(130,105,10);invalid.pos.x=value;
  assert.throws(()=>v.avoid([invalid]),/pos/);
 }
});
test('défaut à corriger: vitesse infinie reste non finie après intégration',()=>{
 const e=load(),v=vehicle(e);v.vel.x=Infinity;
 v.applyForce(v.avoid(obstacles(e,[[130,105,10]])));v.update();
 assert.equal(Number.isFinite(v.vel.x),false);assert.equal(Number.isFinite(v.pos.x),false);
});
test('maxForce zéro: Arrive, Avoid et Boundaries nuls mais Separate défectueux',()=>{
 const e=load(),v=vehicle(e);v.maxForce=0;
 assert.equal(v.arrive(new e.Vector(300,100)).mag(),0);
 assert.equal(v.avoid(obstacles(e,[[130,105,10]])).mag(),0);
 v.pos.set(10,100);assert.equal(v.boundaries(0,0,1200,800,25).mag(),0);
 assert.equal(v.separate([vehicle(e,[20,100])]).mag(),1);
});
test('maxSpeed zéro: Arrive freine puis intégration immobilise',()=>{
 const e=load(),v=vehicle(e);v.maxSpeed=0;
 point(xy(v.arrive(new e.Vector(300,100))),[-.2,0]);const before=xy(v.pos);
 v.applyForce(new e.Vector(1,1));v.update();assert.equal(v.vel.mag(),0);point(xy(v.pos),before);
});
test('direction nulle et centre obstacle: détection sans répulsion',()=>{
 const r=sample([[100,100,100]],[0,0]);assert.equal(r.observation.detected,true);assert.equal(r.force.mag(),0);
});
test('héritage historique: Obstacle indépendant, Target hérite de Vehicle',()=>{
 const e=load();assert.equal(new e.Obstacle(0,0,10) instanceof e.Vehicle,false);
 assert.ok(e.Target.prototype instanceof e.Vehicle);
});
test('interactions historiques: setup, clic, v, f et d',()=>{
 const e=load();vm.runInContext('setup();mousePressed();key="v";keyPressed();key="f";keyPressed();key="d";keyPressed()',e.scope);
 assert.equal(vm.runInContext('vehicules.length',e.scope),12);assert.equal(vm.runInContext('obstacles.length',e.scope),2);
 assert.equal(e.Vehicle.debug,true);
 assert.equal(vm.runInContext('vehicules.slice(2).every(v=>v.pos.x===20&&v.pos.y===300)',e.scope),true);
});
test('bords: draw ne reboucle pas et ne supprime pas les véhicules',()=>{
 const e=load(),v=vehicle(e,[1210,400],[4,0]);e.setVehicles([v]);e.scope.__obs=obstacles(e,[[600,400,100]]);
 vm.runInContext('obstacles=__obs;draw()',e.scope);assert.ok(v.pos.x>1200);assert.ok(v.vel.mag()<=4+1e-12);
});
function numericTree(actual,expected,path='root'){
 if(typeof expected==='number'){close(actual,expected);return;}
 if(Array.isArray(expected)){assert.equal(actual.length,expected.length,path);expected.forEach((v,i)=>numericTree(actual[i],v,path+'.'+i));return;}
 if(expected&&typeof expected==='object'){
  assert.deepEqual(Object.keys(actual),Object.keys(expected),path);for(const key of Object.keys(expected))numericTree(actual[key],expected[key],path+'.'+key);return;
 }
 assert.equal(actual,expected,path);
}
const fixtures=JSON.parse(readFileSync(new URL('./reference-trajectories.json',import.meta.url),'utf8'));
for(const [kind,expected] of Object.entries(fixtures.scenarios)){
 test('référence numérique cinq pas, tous agents et diagnostics : '+kind,()=>{
  const actual=runTrajectory(kind);assert.equal(actual.length,5);numericTree(actual,expected);numericTree(runTrajectory(kind),expected);
 });
}
test('Target dormant: héritage et vitesse aléatoire reproductible sans stub vectoriel',()=>{
 const a=load(10),b=load(10),x=new a.Target(10,20),y=new b.Target(10,20);
 point(xy(x.vel),xy(y.vel));assert.ok(x instanceof a.Vehicle);
 close(x.vel.mag(),5);assert.equal(x.maxSpeed,4);
});
test('scénarios de référence: sommes, application et intégration cohérentes à chaque pas',()=>{
 for(const kind of Object.keys(fixtures.scenarios)){
  const e=load();
  for(const frame of runTrajectory(kind))for(const agent of frame){
   const sum=Object.values(agent.weighted).reduce((s,f)=>s.add(new e.Vector(...f)),new e.Vector());
   point(xy(sum),agent.resultant);
   const expectedVelocity=new e.Vector(...agent.before.velocity).add(sum).limit(4);
   point(agent.after.velocity,xy(expectedVelocity));
   point(agent.after.position,xy(new e.Vector(...agent.before.position).add(expectedVelocity)));
   point(agent.after.acceleration,[0,0]);
   assert.ok(expectedVelocity.mag()<=4+1e-12);
   assert.equal(agent.applications,Object.keys(agent.individual).length);
  }
 }
});
