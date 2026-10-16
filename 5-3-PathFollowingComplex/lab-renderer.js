const LabRenderer = {
  arrow(origin,vector,ink,scale=1) {
    if(!origin||!vector||vector.mag()===0)return;
    const x=origin.x+vector.x*scale,y=origin.y+vector.y*scale;
    stroke(ink);strokeWeight(2);line(origin.x,origin.y,x,y);
    const angle=Math.atan2(y-origin.y,x-origin.x);
    line(x,y,x-7*Math.cos(angle-.4),y-7*Math.sin(angle-.4));
    line(x,y,x-7*Math.cos(angle+.4),y-7*Math.sin(angle+.4));
  },
  point(p,label,ink) {
    if(!p)return;stroke('#fff');strokeWeight(2);fill(ink);circle(p.x,p.y,9);
    noStroke();fill(ink);text(label,p.x+9,p.y-9);
  },
  draw() {
    for(let i=0;i<path.points.length;i++)this.point(path.points[i],LabController.editing?String(i):'', '#64748b');
    const a=LabController.selected();if(!a)return;
    noFill();stroke('#0f172a');strokeWeight(2);circle(a.pos.x,a.pos.y,32);
    if(!debug)return;
    const d=a.copyFollowDiagnostics(),f=a.copyForceDiagnostics();
    const w=a.copyWanderDiagnostics();
    if(w){
      noFill();stroke('#be185d');strokeWeight(1);
      circle(w.center.x,w.center.y,w.radius*2);
      line(w.origin.x,w.origin.y,w.center.x,w.center.y);
      this.point(w.target,'W','#be185d');
    }
    if(d?.status==='defined'){
      for(const c of d.candidates)if(c.status==='defined') {
        stroke('#b6c5d7');strokeWeight(1);line(d.future.x,d.future.y,c.normal.x,c.normal.y);
        noStroke();fill('#94a3b8');circle(c.normal.x,c.normal.y,4);
      }
      const i=d.selectedIndex,p=path.points[i],q=path.points[(i+1)%path.points.length];
      stroke('#9333ea');strokeWeight(4);line(p.x,p.y,q.x,q.y);
      stroke('#0891b2');strokeWeight(2);line(d.future.x,d.future.y,d.normal.x,d.normal.y);
      this.point(d.future,'F','#2563eb');this.point(d.normal,'H','#0891b2');this.point(d.target,'T','#9333ea');
    }
    if(f){
      this.point(f.origin,'Oₙ','#334155');
      this.arrow(f.origin,f.velocity,'#2563eb',15);
      this.arrow(f.origin,f.weighted.follow,'#9333ea',70);
      this.arrow(f.origin,f.weighted.separation,'#d97706',70);
      this.arrow(f.origin,f.weighted.wander,'#be185d',70);
      this.arrow(f.origin,f.total,'#059669',70);
    }
  }
};
