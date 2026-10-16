const LabController = {
 paused:false,pending:false,steps:0,selectedVehicle:0,selectedObstacle:-1,
 scenario:'historical',editing:false,details:false,followMouse:true,
 avoidEnabled:true,
 params:{...LabDefaults},
 reset(name=this.scenario) {
   if(!Object.hasOwn(LabScenarios,name))return false;
   this.scenario=name;this.params={...LabDefaults};this.avoidEnabled=true;
   this.steps=0;this.pending=false;this.selectedVehicle=0;this.selectedObstacle=-1;this.editing=false;
   const config=LabScenarios[name];
   vehicules=config.vehicles.map(item=>{const v=new Vehicle(...item.pos);v.vel.set(...item.vel);return v;});
   obstacles=config.obstacles.map(item=>new Obstacle(...item,'green'));
   target=new Target(...config.target);this.followMouse=!!config.mouse;
   randomSeed(2027);
   this.applyParameters();this.invalidate();LabUI.sync();return true;
 },
 selected(){return vehicules[this.selectedVehicle]??null;},
 invalidate(){
   for(const v of vehicules){v.avoidDiagnostics=null;v.forceDiagnostics=null;v.boundaryDiagnostics=null;}
 },
 applyParameters(){
   for(const v of vehicules){
     v.maxSpeed=this.params.maxSpeed;v.maxForce=this.params.maxForce;
     v.setAnticipation(this.params.shortHorizon,this.params.longHorizon);
     v.behaviorWeights={arrive:this.params.arrive,avoid:this.params.avoid,
       separate:this.params.separate,boundaries:this.params.boundaries};
     v.avoidEnabled=this.avoidEnabled;
   }
 },
 setParameter(name,value) {
   const limits={maxSpeed:20,maxForce:5,shortHorizon:120,longHorizon:120,arrive:10,avoid:10,separate:10,boundaries:10};
   if(!Object.hasOwn(limits,name)||!Number.isFinite(value)||value<0||value>limits[name])return false;
   if(name==='shortHorizon'&&value>this.params.longHorizon || name==='longHorizon'&&value<this.params.shortHorizon)return false;
   this.params[name]=value;this.applyParameters();this.invalidate();return true;
 },
 setAvoidEnabled(enabled){
   if(typeof enabled!=='boolean')return false;
   this.avoidEnabled=enabled;this.applyParameters();this.invalidate();return true;
 },
 requestStep(){this.paused=true;this.pending=true;},
 step(){
   if(this.paused&&!this.pending)return false;
   this.pending=false;
   if(this.followMouse&&finitePoint({x:mouseX,y:mouseY})&&mouseX>=0&&mouseX<=width&&mouseY>=0&&mouseY<=height)
     target.setPosition(mouseX,mouseY);
   const step=this.steps+1;
   for(const v of vehicules){
     v.diagnosticStep=step;
     if(v.applyBehaviors(target.pos,obstacles))v.update();
   }
   this.steps=step;return true;
 },
 selectVehicle(index){
   if(!Number.isInteger(index)||!vehicules[index])return false;
   this.selectedVehicle=index;return true;
 },
 selectObstacle(index){
   if(!Number.isInteger(index)||!obstacles[index])return false;
   this.selectedObstacle=index;return true;
 },
 addVehicle(x,y,velocity=[0,0]){
   if(!finitePoint({x,y})||!velocity.every(Number.isFinite))return false;
   const v=new Vehicle(x,y);v.vel.set(...velocity);vehicules.push(v);this.applyParameters();LabUI.sync();return v;
 },
 addObstacle(x,y,radius){
   if(!finitePoint({x,y})||!Number.isFinite(radius)||radius<0||radius>250)return false;
   obstacles.push(new Obstacle(x,y,radius,'green'));this.selectedObstacle=obstacles.length-1;
   this.invalidate();LabUI.sync();return true;
 },
 editObstacle(index,x,y,radius){
   if(!this.paused||!this.editing||!obstacles[index]||!finitePoint({x,y}))return false;
   const changed=obstacles[index].setGeometry(constrain(x,0,width),constrain(y,0,height),radius);
   if(changed)this.invalidate();return changed;
 },
 setRadius(radius){
   if(!Number.isFinite(radius)||radius<0||radius>250||!obstacles[this.selectedObstacle])return false;
   this.paused=true;this.editing=true;
   const o=obstacles[this.selectedObstacle];return this.editObstacle(this.selectedObstacle,o.pos.x,o.pos.y,radius);
 },
 removeObstacle(){
   if(this.selectedObstacle<0||!obstacles[this.selectedObstacle])return false;
   this.paused=true;obstacles.splice(this.selectedObstacle,1);this.selectedObstacle=-1;
   this.invalidate();LabUI.sync();return true;
 }
};
