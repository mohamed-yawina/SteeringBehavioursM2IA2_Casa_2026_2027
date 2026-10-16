import {correctedSeparation} from './corrected-expectations.mjs';
﻿import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {load, Vector, makePath, inspectFollow, trajectory} from './reference-harness.mjs';

const close=(a,b)=>assert.ok(Math.abs(a-b)<=1e-12, `${a} != ${b}`);
const point=(a,b)=>{close(a[0],b[0]);close(a[1],b[1]);};
function sample(pos=[30,30],vel=[2,0],points,radius=20) {
  const env=load(), v=new env.Vehicle(...pos,3,.3);v.vel.set(...vel);
  return {...inspectFollow(env,v,makePath(env,points,radius)),env,v};
}
test('reference: anticipation spatiale 25, independante de la vitesse; avance 25',()=>{
  for(const speed of [1,3,10]){
    const r=sample([30,30],[speed,0]);point(r.future,[55,30]);point(r.normal,[55,0]);point(r.target,[80,0]);
  }
});
test('reference: projection orthogonale inclinee et non-mutation',()=>{
  const e=load(),p=new Vector(20,0),a=new Vector(0,0),b=new Vector(20,20);
  const before=JSON.stringify([p,a,b]);const h=e.findProjection(p,a,b);
  point([h.x,h.y],[10,10]);assert.equal(JSON.stringify([p,a,b]),before);
});
test('reference: depassement remplace par B puis direction du segment suivant',()=>{
  const r=sample([130,30]);point(r.normal,[100,0]);point(r.target,[75,0]);
});
test('reference: projection avant A retrouve le sommet par le circuit ferme',()=>{
  const r=sample([-60,30]);point(r.normal,[0,0]);point(r.target,[25,0]);
});
test('reference: candidat le plus proche parmi plusieurs segments',()=>{
  const r=sample([60,40],[2,0],[[0,0],[100,0],[100,100],[0,100]],0);
  point(r.normal,[100,40]);point(r.target,[100,65]);
});
test('reference: egalite conserve le premier segment et son orientation',()=>{
  const r=sample();point(r.target,[80,0]);
  const reverse=sample([30,30],[2,0],[[100,0],[0,0]]);point(reverse.target,[30,0]);
});
test('reference: seuil strict, egalite et interieur sans correction',()=>{
  for(const y of [19,20])assert.equal(sample([30,y]).force.mag(),0);
  assert.ok(sample([30,20+1e-8]).force.mag()>0);
});
test('invariant: Seek borne, formule desired moins vitesse et aucune mutation',()=>{
  const e=load(),v=new e.Vehicle(30,30,3,.3),t=new Vector(80,0);
  const before=JSON.stringify([v.pos,v.vel,v.acc,t]);const f=v.seek(t);
  const expected=Vector.sub(t,v.pos).normalize().mult(3).sub(v.vel).limit(.3);
  point([f.x,f.y],[expected.x,expected.y]);assert.ok(f.mag()<=.3+1e-15);
  assert.equal(JSON.stringify([v.pos,v.vel,v.acc,t]),before);
});
test('reference: vitesse nulle donne F egal position',()=>{
  const r=sample([30,30],[0,0]);point(r.future,[30,30]);point(r.normal,[30,0]);point(r.target,[55,0]);
});
test('invariant: follow ne modifie ni le chemin ni la cinematique',()=>{
  const e=load(),v=new e.Vehicle(30,30,3,.3),p=makePath(e);
  const before=JSON.stringify([v.pos,v.vel,v.acc,p.points]);v.follow(p);
  assert.equal(JSON.stringify([v.pos,v.vel,v.acc,p.points]),before);
});
test('corrige: resultant pondere borne a maxForce',()=>{
  const e=load(),v=new e.Vehicle(30,30,3,.3);v.separateWeight=0;
  v.applyBehaviors([v],makePath(e));close(v.acc.mag(),.3);assert.ok(v.acc.mag()<=v.maxForce+1e-15);
});
test('corrige: chemin vide sans force',()=>{
  const e=load(),v=new e.Vehicle(30,30,3,.3);
  assert.equal(v.follow(makePath(e,[])).mag(),0);assert.equal(v.copyFollowDiagnostics().status,'undefined');
});
test('corrige: chemin incomplet indefini',()=>{
  const e=load(),v=new e.Vehicle(30,30,3,.3);assert.equal(v.follow(makePath(e,[[0,0]])).mag(),0);assert.equal(v.copyFollowDiagnostics().status,'undefined');
});
test('corrige: segment nul explicitement indefini',()=>{
  const e=load(),a=new Vector(50,50);const h=e.findProjection(new Vector(20,20),a,a);
  assert.equal(h,null);const v=new e.Vehicle(20,20,3,.3);assert.equal(v.follow(makePath(e,[[50,50],[50,50]])).mag(),0);
});
test('corrige: coordonnees invalides sans force et grande distance exploitable',()=>{
  for(const bad of [NaN,Infinity,-Infinity]){
    const e=load(),v=new e.Vehicle(30,30,3,.3),p=makePath(e);p.points[0].x=bad;p.points[1].x=bad;
    assert.equal(v.follow(p).mag(),0);assert.equal(v.copyFollowDiagnostics().status,'invalid');
  }
  const e=load(),v=new e.Vehicle(2e6,2e6,3,.3);assert.ok(v.follow(makePath(e)).mag()>0);assert.equal(v.copyFollowDiagnostics().status,'defined');
});
test('corrige: Wander de poids nul ne consomme rien',()=>{
  const e=load(),v=new e.Vehicle(30,30,3,.3),before=e.randomCalls(),theta=v.wanderTheta;
  v.applyBehaviors([v],makePath(e));assert.equal(e.randomCalls()-before,0);assert.equal(v.wanderTheta,theta);
});
test('reference: croisement, premier segment retenu sans etat de progression',()=>{
  const r=sample([-25,0],[2,0],[[-100,-100],[100,100],[-100,100],[100,-100]],0);
  point(r.normal,[0,0]);point(r.target,[25/Math.sqrt(2),25/Math.sqrt(2)]);
});
test('reference: virage serre, cible non bornee a la longueur du segment',()=>{
  const r=sample([60,30],[2,0],[[0,0],[100,0],[100,2],[0,2]],0);
  point(r.normal,[85,2]);point(r.target,[60,2]);
});
test('invariant: application via applyForce puis une integration ordinaire',()=>{
  const e=load(),v=new e.Vehicle(30,30,3,.3),events=[],forces=[];
  const apply=v.applyForce.bind(v),update=v.update.bind(v);
  v.applyForce=f=>{events.push('apply');forces.push(f.copy());apply(f);};
  v.update=()=>{events.push('update');const sum=forces.reduce((s,f)=>s.add(f),new Vector());point([v.acc.x,v.acc.y],[sum.x,sum.y]);update();};
  v.render=()=>events.push('render');v.applyBehaviors([v],makePath(e));v.run();
  assert.deepEqual(events,['apply','update','render']);assert.equal(v.acc.mag(),0);
});
test('invariant: chaque anneau applique ses forces et integre une seule fois',()=>{
  const e=load(),s=new e.SnakePathFollowing(40,40,4),records=[];
  for(const ring of s.anneaux){
    const record={apply:0,update:0};records.push(record);
    const a=ring.applyForce.bind(ring),u=ring.update.bind(ring);
    ring.applyForce=f=>{record.apply++;a(f);};ring.update=()=>{record.update++;u();};
  }
  s.move(makePath(e),[]);for(const r of records)assert.deepEqual(r,{apply:1,update:1});
  assert.ok(s instanceof e.Vehicle);assert.ok(s.anneaux.every(a=>a instanceof e.Vehicle));
});
test('invariant: vitesse bornee et acceleration remise a zero apres integration',()=>{
  const e=load(),v=new e.Vehicle(0,0,3,.3);v.applyForce(new Vector(100,100));v.update();
  close(v.vel.mag(),3);assert.equal(v.acc.mag(),0);
});
test('reference: RNG reproductible non constant et dependant de la graine',()=>{
  const a=load(10),b=load(10),c=load(11);
  const values=e=>Array.from({length:5},()=>new e.Vehicle(0,0,3,.3).displaceRange);
  const av=values(a);assert.deepEqual(av,values(b));assert.notDeepEqual(av,values(c));assert.equal(new Set(av).size,5);
});
const fixtures=JSON.parse(readFileSync(new URL('./reference-trajectories.json',import.meta.url),'utf8'));
for(const [kind,expected] of Object.entries(fixtures)){
  if(kind==='wander') continue; // L'ancienne trajectoire reste un témoin historique immuable.
  test('trajectoire historique 5 pas: '+kind,()=>{
    const actual=trajectory(kind);assert.equal(actual.length,5);
    for(let i=0;i<5;i++){assert.equal(actual[i].length,expected[i].length);
      for(let j=0;j<actual[i].length;j++)for(let k=0;k<6;k++){
        close(actual[i][j][k],(correctedSeparation[kind]??expected)[i][j][k]);
      }}
    if(kind.endsWith('separation'))assert.notDeepEqual(actual,expected);
    assert.deepEqual(trajectory(kind),actual);
  });
}
const correctedWander=JSON.parse(readFileSync(new URL('./corrected-wander-trajectories.json',import.meta.url),'utf8'));
test('trajectoire Wander conforme 5 pas: référence corrigée distincte',()=>{
  const actual=trajectory('wander');assert.equal(actual.length,correctedWander.length);
  for(let i=0;i<actual.length;i++)for(let j=0;j<actual[i].length;j++)for(let k=0;k<6;k++)
    close(actual[i][j][k],correctedWander[i][j][k]);
  assert.deepEqual(trajectory('wander'),actual);
});
test('Wander: steering desired moins vitesse, limites et non-mutation',()=>{
  for(const [velocity,maxSpeed,maxForce] of [[[1,0],3,.3],[[0,0],3,.3],[[1,0],0,.3],[[1,0],3,0]]){
    const e=load(),v=new e.Vehicle(30,30,maxSpeed,maxForce);
    v.vel.set(...velocity);v.wanderTheta=.37;v.displaceRange=0;
    const position=v.pos.copy(),currentVelocity=v.vel.copy();
    const targetDirection=v.vel.copy().setMag(v.distanceCercle);
    targetDirection.add(v.pos);
    const theta=v.wanderTheta+v.vel.heading();
    targetDirection.add(v.wanderRadius*Math.cos(theta),v.wanderRadius*Math.sin(theta));
    const expected=targetDirection.copy().sub(v.pos).normalize().mult(maxSpeed)
      .sub(currentVelocity).limit(maxForce);
    const randomBefore=e.randomCalls(),force=v.wander();
    assert.ok(Math.abs(force.x-expected.x)<=1e-12);
    assert.ok(Math.abs(force.y-expected.y)<=1e-12);
    assert.ok(Number.isFinite(force.x)&&Number.isFinite(force.y));
    assert.ok(force.mag()<=maxForce+1e-15);
    assert.equal(e.randomCalls(),randomBefore+1);
    assert.deepEqual([v.pos.x,v.pos.y],[position.x,position.y]);
    assert.deepEqual([v.vel.x,v.vel.y],[currentVelocity.x,currentVelocity.y]);
    const d=v.copyWanderDiagnostics();
    assert.ok(Math.abs(d.force.x-force.x)<=1e-12&&Math.abs(d.force.y-force.y)<=1e-12);
  }
});
test('Wander: direction cible nulle produit un freinage borné',()=>{
  const e=load(),v=new e.Vehicle(30,30,3,.25);
  v.vel.set(2,0);v.distanceCercle=0;v.wanderRadius=0;v.displaceRange=0;
  const force=v.wander();point([force.x,force.y],[-.25,0]);
  assert.ok(force.mag()<=v.maxForce+1e-15);
});
test('corrige: force totale de la tete bornee',()=>{
  const e=load(),s=new e.SnakePathFollowing(30,30,3);s.separationWeight=0;
  let total;const update=s.head.update.bind(s.head);
  s.head.update=()=>{total=s.head.acc.mag();update();};
  s.move(makePath(e),[]);assert.ok(total<=s.head.maxForce+1e-15);close(total,.3);
});
test('invariant: separate et applyForce ne mutent pas voisin ou force fournie',()=>{
  const e=load(),v=new e.Vehicle(30,30,3,.3),other=new e.Vehicle(35,30,2,.3);
  const before=JSON.stringify([v.pos,v.vel,other.pos,other.vel]);v.separate([other]);
  assert.equal(JSON.stringify([v.pos,v.vel,other.pos,other.vel]),before);
  const f=new Vector(.1,.2),copy=JSON.stringify(f);v.applyForce(f);assert.equal(JSON.stringify(f),copy);
});
test('invariant: toutes les references restent finies et respectent les vitesses propres',()=>{
  for(const kind of Object.keys(fixtures))for(const frame of trajectory(kind)){
    for(let index=0;index<frame.length;index++){
      const [x,y,vx,vy,ax,ay]=frame[index];assert.ok([x,y,vx,vy,ax,ay].every(Number.isFinite));
      assert.ok(Math.hypot(vx,vy)<=(kind.startsWith('snake')&&index>0?10:3)+1e-12);
      assert.equal(Math.abs(ax)+Math.abs(ay),0);
    }
  }
});
