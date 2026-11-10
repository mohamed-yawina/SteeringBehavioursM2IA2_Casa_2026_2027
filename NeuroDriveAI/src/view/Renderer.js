export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.effectsEnabled = true;
    this.trailsEnabled = false;
    this.trails = new WeakMap();
    this.maxTrailPoints = 180;
    this.selectedColor = '#67e8f9';
  }
  draw(simulation, showSensors, populationCars = []) {
    const { canvas, context: ctx } = this;
    const w = Math.max(1, canvas.clientWidth), h = Math.max(1, canvas.clientHeight);
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#090f1c'; ctx.fillRect(0, 0, w, h);
    const scale = Math.min(w / 1000, h / 700);
    ctx.translate((w - scale * 1000) / 2, (h - scale * 700) / 2);
    ctx.scale(scale, scale);
    const { track, car, checkpoints } = simulation;
    const polygon = points => {
      ctx.moveTo(points[0].x, points[0].y);
      for (const p of points.slice(1)) ctx.lineTo(p.x, p.y);
      ctx.closePath();
    };
    ctx.beginPath(); polygon(track.outer); polygon(track.inner);
    ctx.fillStyle = '#1b2b40'; ctx.fill('evenodd');
    ctx.lineWidth = 3; ctx.strokeStyle = '#819ab8'; ctx.stroke();
    const line = (a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };
    track.checkpoints.forEach((cp, i) => {
      ctx.strokeStyle = i === checkpoints.nextIndex ? '#67e8f9' : i === 0 ? '#ffffff' : '#566d89';
      ctx.lineWidth = i === checkpoints.nextIndex || i === 0 ? 4 : 1;
      line(cp.a, cp.b);
      const x = (cp.a.x + cp.b.x) / 2, y = (cp.a.y + cp.b.y) / 2;
      ctx.fillStyle = '#e0eaf0'; ctx.font = 'bold 14px system-ui'; ctx.textAlign = 'center';
      ctx.fillText(i === 0 ? 'ARRIVÉE' : String(i), cp.b.x + (cp.b.x - x) * .17, cp.b.y + (cp.b.y - y) * .17);
      const tip = { x: x + cp.normal.x * 14, y: y + cp.normal.y * 14 };
      ctx.strokeStyle = '#8ea4b5'; ctx.lineWidth = 2;
      line({ x: x - cp.normal.x * 10, y: y - cp.normal.y * 10 }, tip);
      line(tip, { x: tip.x - cp.normal.x * 6 - cp.normal.y * 4, y: tip.y - cp.normal.y * 6 + cp.normal.x * 4 });
      line(tip, { x: tip.x - cp.normal.x * 6 + cp.normal.y * 4, y: tip.y - cp.normal.y * 6 - cp.normal.x * 4 });
    });
    ctx.beginPath(); ctx.arc(track.startZone.position.x, track.startZone.position.y, track.startZone.radius, 0, Math.PI * 2);
    ctx.fillStyle = '#75d9b526'; ctx.fill();
    // Traces record accepted positions; they never drive a vehicle.
    if(this.trailsEnabled)this.drawTrail(car,line);
    if (showSensors) {
      ctx.lineWidth = 1;
      for (const ray of car.sensors.readings) {
        ctx.strokeStyle = ray.hit ? '#f7d175aa' : '#f7d17535';
        line(car.position, ray.end);
        if (ray.hit) { ctx.beginPath(); ctx.arc(ray.end.x, ray.end.y, 2.5, 0, Math.PI * 2); ctx.fillStyle = '#f7d175'; ctx.fill(); }
      }
    }
    for (const [index,other] of populationCars.entries()) {
      if (other === car || !other.active) continue;
      ctx.save(); ctx.translate(other.position.x, other.position.y); ctx.rotate(other.orientation);
      ctx.fillStyle = `hsla(${185+(index*.61803398875%1)*100},75%,70%,.5)`; ctx.fillRect(-other.length/2, -other.width/2, other.length, other.width);
      ctx.restore();
    }
    ctx.save(); ctx.translate(car.position.x, car.position.y); ctx.rotate(car.orientation);
    ctx.shadowBlur=this.effectsEnabled?12:0;ctx.shadowColor=car.crashed?'#ff8c99':this.selectedColor;
    ctx.fillStyle = car.crashed ? '#ff8c99' : this.selectedColor;
    ctx.fillRect(-car.length / 2, -car.width / 2, car.length, car.width);
    ctx.fillStyle = '#142b34'; ctx.fillRect(2, -car.width / 2 + 2, 5, car.width - 4);
    ctx.strokeStyle = '#e9faf6'; ctx.lineWidth = 2;
    line({ x: 8, y: 0 }, { x: 17, y: 0 }); ctx.restore();
    ctx.shadowBlur=0;
    ctx.beginPath();ctx.arc(car.position.x,car.position.y,car.collisionRadius+6,0,Math.PI*2);ctx.strokeStyle=car.crashed?'#ff8c99':'#e4faff';ctx.lineWidth=1.5;ctx.stroke();
    if(car.crashed&&this.effectsEnabled){ctx.fillStyle='#ff8c99';ctx.font='bold 13px system-ui';ctx.fillText('COLLISION',car.position.x,car.position.y-28);}
  }
  drawTrail(car,line){
    let trace=this.trails.get(car);if(!trace||car.distanceTravelled<trace.distance){trace={points:[],distance:-1};this.trails.set(car,trace);}
    if(car.distanceTravelled!==trace.distance){trace.points.push({x:car.position.x,y:car.position.y});if(trace.points.length>this.maxTrailPoints)trace.points.shift();trace.distance=car.distanceTravelled;}
    const ctx=this.context;ctx.lineWidth=1.5;ctx.strokeStyle='#67e8f980';for(let i=1;i<trace.points.length;i++)line(trace.points[i-1],trace.points[i]);
  }
}
