const LabRenderer = {
 colors:{arrive:'#38bdf8',avoid:'#fbbf24',separate:'#c084fc',boundaries:'#fb7185',total:'#34d399'},
 arrow(origin,vector,color,scale){
   if(!origin||!vector||vector.mag()===0)return;
   const x=origin.x+vector.x*scale,y=origin.y+vector.y*scale,angle=Math.atan2(vector.y,vector.x);
   stroke(color);strokeWeight(2);line(origin.x,origin.y,x,y);
   line(x,y,x-7*Math.cos(angle-.45),y-7*Math.sin(angle-.45));
   line(x,y,x-7*Math.cos(angle+.45),y-7*Math.sin(angle+.45));
 },
 point(p,label,color){
   if(!p)return;stroke('#071321');strokeWeight(2);fill(color);circle(p.x,p.y,9);
   noStroke();fill(color);text(label,p.x+9,p.y-9);
 },
 draw(){
   const selected=LabController.selected();
   if(LabController.selectedObstacle>=0){
     const o=obstacles[LabController.selectedObstacle];if(o){
       noFill();stroke('#fb923c');strokeWeight(2);circle(o.pos.x,o.pos.y,o.r*2+8);
     }
   }
   if(!selected)return;
   noFill();stroke('#f8fafc');strokeWeight(1);circle(selected.pos.x,selected.pos.y,43);
   if(!LabController.details)return;
   const d=selected.copyAvoidDiagnostics(),f=selected.copyForceDiagnostics();if(!d)return;
   if(d.center){
     noFill();stroke('#fb923c');strokeWeight(3);circle(d.center.x,d.center.y,d.radius*2);
     if(d.threshold!==null){
       drawingContext.setLineDash([5,8]);stroke('#fbbf24');strokeWeight(1);
       circle(d.center.x,d.center.y,d.threshold*2);drawingContext.setLineDash([]);
     }
     this.point(d.center,'C · obstacle retenu','#fb923c');
     if(d.sample){stroke('#94a3b8');strokeWeight(1);line(d.center.x,d.center.y,d.sample.x,d.sample.y);}
   }
   if(d.q30){
     drawingContext.setLineDash([3,9]);stroke('#64748b');strokeWeight(1);
     line(d.origin.x,d.origin.y,d.q30.x,d.q30.y);drawingContext.setLineDash([]);
     this.point(d.q30,'Ql ('+d.longHorizon+')','#fbbf24');
     this.point(d.q15,'Qc ('+d.shortHorizon+')','#a78bfa');
     this.point(d.origin,'Xₙ','#e2e8f0');
     this.arrow(d.origin,d.velocity,'#e2e8f0',12);
     if(d.sample){noFill();stroke(d.detected?'#f87171':'#34d399');strokeWeight(2);circle(d.sample.x,d.sample.y,18);}
   }
   if(f?.status==='defined'){
     for(const name of ['arrive','avoid','separate','boundaries'])
       this.arrow(f.origin,f.weighted[name],this.colors[name],150);
     this.arrow(f.origin,f.total,this.colors.total,150);
   }
 }
};
