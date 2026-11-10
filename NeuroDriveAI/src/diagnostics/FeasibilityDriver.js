// Reference path-following fixture ONLY for geometry/physics feasibility tests.
// Learned policies never import this module or receive route points.
export function createFeasibilityDriver(track,speed=55){
 const route=track.centerline??track.inner.map((p,i)=>({x:(p.x+track.outer[i].x)/2,y:(p.y+track.outer[i].y)/2}));let index=2;
 return car=>{
  let best=index,bestDistance=Infinity;
  for(let offset=-3;offset<=8;offset++){const i=(index+offset+route.length)%route.length,p=route[i],d=Math.hypot(p.x-car.position.x,p.y-car.position.y);if(d<bestDistance){best=i;bestDistance=d;}}
  index=best;let target=route[index],travelled=0,j=index;
  while(travelled<32){const next=(j+1)%route.length;travelled+=Math.hypot(route[next].x-route[j].x,route[next].y-route[j].y);j=next;target=route[j];}
  const dx=target.x-car.position.x,dy=target.y-car.position.y,alpha=Math.atan2(Math.sin(Math.atan2(dy,dx)-car.orientation),Math.cos(Math.atan2(dy,dx)-car.orientation));
  const steer=Math.max(-1,Math.min(1,Math.atan(2*car.wheelbase*Math.sin(alpha)/Math.max(1,Math.hypot(dx,dy)))/car.maxSteeringAngle));
  const throttle=Math.max(0,Math.min(1,(speed-car.speed)*.1+.3*speed/car.maxAcceleration));
  return {steer,throttle:car.speed>speed+1?0:throttle,brake:car.speed>speed+1?Math.min(1,(car.speed-speed)*.1):0};
 };
}
