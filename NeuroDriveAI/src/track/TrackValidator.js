import {pointSegmentDistance} from '../math/geometry.js';
const EPS=1e-7;
const cross=(a,b,c)=>(b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x);
const near=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y)<EPS;
function on(p,a,b){return Math.abs(cross(a,b,p))<EPS&&p.x>=Math.min(a.x,b.x)-EPS&&p.x<=Math.max(a.x,b.x)+EPS&&p.y>=Math.min(a.y,b.y)-EPS&&p.y<=Math.max(a.y,b.y)+EPS;}
export function segmentsIntersect(a,b,c,d){
 const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
 return (x*y<0&&z*w<0)||on(c,a,b)||on(d,a,b)||on(a,c,d)||on(b,c,d);
}
export function pointInPolygon(p,polygon){
 let inside=false;for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
  const a=polygon[i],b=polygon[j];if(on(p,a,b))return true;
  if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)inside=!inside;
 }return inside;
}
function edges(poly){return poly.map((a,i)=>({a,b:poly[(i+1)%poly.length]}));}
function segmentDistance(a,b,c,d){return segmentsIntersect(a,b,c,d)?0:Math.min(pointSegmentDistance(a,c,d),pointSegmentDistance(b,c,d),pointSegmentDistance(c,a,b),pointSegmentDistance(d,a,b));}
export function validateTrack(track,{minimumWidth=40,carRadius=Math.hypot(26,14)/2}={}){
 const errors=[],inner=track.inner,outer=track.outer;
 const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
 if(!Array.isArray(inner)||!Array.isArray(outer)||inner.length<3||outer.length<3||inner.length!==outer.length||inner.some(p=>!finite(p))||outer.some(p=>!finite(p)))return {valid:false,errors:['Invalid boundaries']};
 const ie=edges(inner),oe=edges(outer);
 for(const [name,poly,list]of [['inner',inner,ie],['outer',outer,oe]]){
  for(let i=0;i<list.length;i++){
   if(near(list[i].a,list[i].b))errors.push(`${name}: zero edge`);
   for(let j=i+1;j<list.length;j++)if(j!==i+1&&!(i===0&&j===list.length-1)&&segmentsIntersect(list[i].a,list[i].b,list[j].a,list[j].b))errors.push(`${name}: self intersection`);
  }
  const walls=track.walls?.filter(w=>list.some(e=>near(w.a,e.a)&&near(w.b,e.b)));
  if(walls?.length!==poly.length)errors.push(`${name}: boundary not closed by walls`);
 }
 let minWidth=Infinity;
 for(const a of ie)for(const b of oe)minWidth=Math.min(minWidth,segmentDistance(a.a,a.b,b.a,b.b));
 if(minWidth<minimumWidth)errors.push('Insufficient minimum width / boundary crossing');
 if(inner.some(p=>!pointInPolygon(p,outer)))errors.push('Inner boundary outside outer');
 const road=p=>pointInPolygon(p,outer)&&!pointInPolygon(p,inner);
 const start=track.start?.position;if(!finite(start)||!road(start))errors.push('Invalid start position');
 const clearance=finite(start)?Math.min(...[...ie,...oe].map(e=>pointSegmentDistance(start,e.a,e.b))):0;
 if(clearance<=carRadius)errors.push('Start overlaps car collision envelope');
 const centerline=track.centerline??inner.map((p,i)=>({x:(p.x+outer[i].x)/2,y:(p.y+outer[i].y)/2}));
 const cps=track.checkpoints??[],anchors=[];
 if(cps.length<2)errors.push('Missing checkpoints');
 for(let i=0;i<cps.length;i++){
  const cp=cps[i];if(!finite(cp.a)||!finite(cp.b)||!finite(cp.normal)||near(cp.a,cp.b)){errors.push('Invalid checkpoint');continue;}
  const middle={x:(cp.a.x+cp.b.x)/2,y:(cp.a.y+cp.b.y)/2};
  if(Math.abs(Math.hypot(cp.normal.x,cp.normal.y)-1)>1e-6||Math.abs((cp.b.x-cp.a.x)*cp.normal.x+(cp.b.y-cp.a.y)*cp.normal.y)>1e-5)errors.push('Invalid checkpoint normal');
  let index=0;centerline.forEach((p,j)=>{if(Math.hypot(p.x-middle.x,p.y-middle.y)<Math.hypot(centerline[index].x-middle.x,centerline[index].y-middle.y))index=j;});anchors.push(index);
  const before=centerline[(index-1+centerline.length)%centerline.length],after=centerline[(index+1)%centerline.length];
  if(Math.hypot(centerline[index].x-middle.x,centerline[index].y-middle.y)>.01)errors.push('Checkpoint not centered on route');
  if(!road(middle))errors.push('Checkpoint outside road');
  if((after.x-before.x)*cp.normal.x+(after.y-before.y)*cp.normal.y<=0)errors.push('Wrong checkpoint crossing direction');
  if(!inner.some(p=>near(p,cp.a))||!outer.some(p=>near(p,cp.b)))errors.push('Checkpoint endpoints not on paired boundaries');
  for(const e of [...ie,...oe])if(segmentsIntersect(cp.a,cp.b,e.a,e.b)&&!on(cp.a,e.a,e.b)&&!on(cp.b,e.a,e.b))errors.push('Checkpoint crosses another wall');
 }
 if(anchors[0]!==0||anchors.some((n,i)=>i>0&&n<=anchors[i-1]))errors.push('Checkpoint order invalid');
 if(!cps[0]||!near(track.finish?.a??{},cps[0].a)||!near(track.finish?.b??{},cps[0].b))errors.push('Invalid finish line');
 let spawn=0;if(finite(start))centerline.forEach((p,i)=>{if(Math.hypot(p.x-start.x,p.y-start.y)<Math.hypot(centerline[spawn].x-start.x,centerline[spawn].y-start.y))spawn=i;});
 if(spawn>=anchors[1])errors.push('Start must be after finish and before checkpoint 1');
 if(finite(start)&&cps[0]&&(start.x-cps[0].a.x)*cps[0].normal.x+(start.y-cps[0].a.y)*cps[0].normal.y<=EPS)errors.push('Start is not strictly after finish');
 const tangent=centerline[(spawn+1)%centerline.length],origin=centerline[spawn],length=Math.hypot(tangent.x-origin.x,tangent.y-origin.y);
 if(!Number.isFinite(track.start?.orientation)||((tangent.x-origin.x)*Math.cos(track.start.orientation)+(tangent.y-origin.y)*Math.sin(track.start.orientation))/length<.85)errors.push('Invalid start orientation');
 const lengthWorld=centerline.reduce((s,p,i)=>s+Math.hypot(p.x-centerline[(i+1)%centerline.length].x,p.y-centerline[(i+1)%centerline.length].y),0);
 return {valid:errors.length===0,errors:[...new Set(errors)],minimumWidth:minWidth,startClearance:clearance,length:lengthWorld,checkpoints:cps.length};
}
