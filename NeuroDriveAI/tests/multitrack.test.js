import test from 'node:test';
import assert from 'node:assert/strict';
import {TRACKS,createRegisteredTrack} from '../src/track/TrackRegistry.js';
import {createOvalTrack} from '../src/track/Track.js';
import {validateTrack,segmentsIntersect} from '../src/track/TrackValidator.js';
import {CheckpointManager} from '../src/track/CheckpointManager.js';
import {Simulation} from '../src/simulation/Simulation.js';
import {createFeasibilityDriver} from '../src/diagnostics/FeasibilityDriver.js';
import {vec} from '../src/math/vector.js';
import {createTrackFromControls} from '../src/track/TrackFactory.js';

test('track factory rejects invalid dimensions, nonfinite controls and oversized sampling',()=>{
 const definition={id:'fixture',controls:[[0,0],[500,0],[500,500],[0,500]],width:70,gateCount:12};
 for(const patch of [{width:NaN},{width:1},{gateCount:Infinity},{gateCount:1000000},{controls:[[0,0],[1,1],[2,2],[NaN,3]]}])assert.throws(()=>createTrackFromControls({...definition,...patch}));
 assert.throws(()=>createTrackFromControls());
});

test('registry: five unique documented tracks, unknown id rejected, independent instances',()=>{
 assert.equal(TRACKS.length,5);assert.equal(new Set(TRACKS.map(t=>t.id)).size,5);
 for(const info of TRACKS){const a=createRegisteredTrack(info.id),b=createRegisteredTrack(info.id);assert.ok(info.name&&info.description&&info.difficulty);assert.notEqual(a.inner[0],b.inner[0]);assert.equal(a.metadata.id,info.id);assert.ok(a.validation.valid);}
 assert.throws(()=>createRegisteredTrack('missing'));
});
test('Training Oval geometry is identical to original factory',()=>{
 const a=createRegisteredTrack('oval'),b=createOvalTrack();
 for(const key of ['inner','outer','checkpoints','start','finish','walls'])assert.deepEqual(a[key],b[key]);
});
test('new routes have concavities and distinct lengths/gate counts: no affine oval copies',()=>{
 const lengths=new Set(),counts=new Set();
 for(const {id} of TRACKS){const t=createRegisteredTrack(id),p=t.centerline;lengths.add(t.validation.length.toFixed(3));counts.add(t.checkpoints.length);
  if(id==='oval')continue;
  const signs=p.map((a,i)=>{const b=p[(i+1)%p.length],c=p[(i+2)%p.length];return Math.sign((b.x-a.x)*(c.y-b.y)-(b.y-a.y)*(c.x-b.x));});
  assert.ok(signs.includes(-1)&&signs.includes(1),id+' must be nonconvex');
 }
 assert.equal(lengths.size,5);assert.equal(counts.size,5);
});
test('validator rejects unclosed wall lists, crossing boundaries and insufficient width',()=>{
 const a=createRegisteredTrack('desert');a.walls.pop();assert.equal(validateTrack(a).valid,false);
 const b=createRegisteredTrack('desert');[b.outer[2],b.outer[50]]=[b.outer[50],b.outer[2]];assert.equal(validateTrack(b).valid,false);
 assert.equal(validateTrack(createRegisteredTrack('mountain'),{minimumWidth:100}).valid,false);
 assert.ok(segmentsIntersect(vec(0,0),vec(2,2),vec(0,2),vec(2,0)));
});
test('validator rejects invalid starting position, orientation and finish',()=>{
 for(const id of TRACKS.map(t=>t.id)){
  const a=createRegisteredTrack(id);a.start.position=vec(-100,-100);assert.equal(validateTrack(a).valid,false);
  const b=createRegisteredTrack(id);b.start.orientation+=Math.PI;assert.equal(validateTrack(b).valid,false);
  const c=createRegisteredTrack(id);c.finish={a:vec(),b:vec(1,0)};assert.equal(validateTrack(c).valid,false);
 }
});
test('validator rejects reversed, unordered, missing and invalid checkpoint normals',()=>{
 const a=createRegisteredTrack('neon');a.checkpoints[1].normal.mult(-1);assert.equal(validateTrack(a).valid,false);
 const b=createRegisteredTrack('neon');[b.checkpoints[1],b.checkpoints[3]]=[b.checkpoints[3],b.checkpoints[1]];assert.equal(validateTrack(b).valid,false);
 const c=createRegisteredTrack('neon');c.checkpoints=[];assert.equal(validateTrack(c).valid,false);
 const d=createRegisteredTrack('neon');d.checkpoints[1].normal.mult(2);assert.equal(validateTrack(d).valid,false);
});
for(const {id} of TRACKS){
 test(id+': strict checkpoints reject finish first, skipped gates, reverse motion and repeats',()=>{
  const t=createRegisteredTrack(id),m=new CheckpointManager(t.checkpoints);
  const cross=(index,reverse=false)=>{const cp=t.checkpoints[index],mid=cp.a.copy().add(cp.b).mult(.5),delta=cp.normal.copy().mult(reverse?-2:2);return m.process(mid.copy().sub(delta),mid.copy().add(delta));};
  cross(0);cross(2);cross(1,true);assert.equal(m.validated,0);assert.equal(m.laps,0);
  cross(1);cross(1);assert.equal(m.validated,1);cross(0);assert.equal(m.laps,0);
  for(let i=2;i<t.checkpoints.length;i++)cross(i);assert.equal(m.laps,0);cross(0);assert.equal(m.laps,1);
 });
 test(id+': feasible full lap with real physics, sensors, legal commands and no collision',()=>{
  const t=createRegisteredTrack(id),s=new Simulation(t),drive=createFeasibilityDriver(t);
  for(let i=0;i<60*120&&s.car.active&&s.checkpoints.laps<1;i++){
   const command=drive(s.car);assert.ok(Math.abs(command.steer)<=1&&command.throttle>=0&&command.throttle<=1);
   s.step(1/120,command);assert.ok(Number.isFinite(s.car.position.x)&&Number.isFinite(s.car.position.y));
  }
  assert.equal(s.car.crashed,false);assert.equal(s.checkpoints.laps,1);assert.equal(s.checkpoints.validated,t.checkpoints.length);
  s.reset();assert.equal(s.checkpoints.laps,0);assert.equal(s.elapsed,0);assert.deepEqual(s.car.position,t.start.position);
 });
 test(id+': swept collision prevents fast travel through an actual outer wall',()=>{
  const t=createRegisteredTrack(id),s=new Simulation(t),w=t.walls[t.inner.length+2],mid=w.a.copy().add(w.b).mult(.5);
  const from=vec(t.centerline[2].x,t.centerline[2].y);s.car.position=from.copy();s.car.previousPosition=from.copy();s.car.maxSpeed=20000;
  s.car.velocity=mid.copy().sub(from).normalize().mult(15000);s.car.orientation=Math.atan2(s.car.velocity.y,s.car.velocity.x);
  s.step(.05,{throttle:1});assert.equal(s.car.crashed,true);assert.equal(s.car.active,false);assert.equal(s.checkpoints.laps,0);
 });
}
