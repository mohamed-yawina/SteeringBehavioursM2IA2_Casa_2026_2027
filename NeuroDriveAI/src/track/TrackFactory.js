import {Track} from './Track.js';
import {vec} from '../math/vector.js';
const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function smooth(points,passes=3){
 let current=points.map(([x,y])=>vec(x,y));
 for(let pass=0;pass<passes;pass++)current=current.flatMap((a,i)=>{const b=current[(i+1)%current.length];return [vec(.75*a.x+.25*b.x,.75*a.y+.25*b.y),vec(.25*a.x+.75*b.x,.25*a.y+.75*b.y)];});
 return current;
}
function resample(points,count){
 const lengths=points.map((p,i)=>distance(p,points[(i+1)%points.length])),total=lengths.reduce((a,b)=>a+b,0);let edge=0,passed=0;
 return Array.from({length:count},(_,i)=>{const target=i*total/count;while(edge<points.length-1&&passed+lengths[edge]<target){passed+=lengths[edge];edge++;}const t=(target-passed)/lengths[edge],a=points[edge],b=points[(edge+1)%points.length];return vec(a.x+(b.x-a.x)*t,a.y+(b.y-a.y)*t);});
}
export function createTrackFromControls({id,controls,width,gateCount}={}){
 if(typeof id!=='string'||!id||!Array.isArray(controls)||controls.length<4||controls.length>128||Array.from(controls).some(p=>!Array.isArray(p)||p.length!==2||Array.from(p).some(n=>!Number.isFinite(n)))||!Number.isFinite(width)||width<40||width>500||!Number.isInteger(gateCount)||gateCount<4||gateCount>128)throw new RangeError('Invalid track definition');
 const centerline=resample(smooth(controls),gateCount*8),inner=[],outer=[];
 for(let i=0;i<centerline.length;i++){
  const p=centerline[i],a=centerline[(i-1+centerline.length)%centerline.length],b=centerline[(i+1)%centerline.length];
  const normal=vec(-(b.y-a.y),b.x-a.x).normalize();inner.push(vec(p.x+normal.x*width/2,p.y+normal.y*width/2));outer.push(vec(p.x-normal.x*width/2,p.y-normal.y*width/2));
 }
 const checkpoints=Array.from({length:gateCount},(_,i)=>{const a=inner[i*8],b=outer[i*8];return {a,b,normal:vec(-(b.y-a.y),b.x-a.x).normalize()};});
 const spawn=2,a=centerline[spawn],b=centerline[spawn+1];
 const track=new Track({id,inner,outer,checkpoints,start:{position:a,orientation:Math.atan2(b.y-a.y,b.x-a.x)}});
 track.centerline=centerline;return track;
}
