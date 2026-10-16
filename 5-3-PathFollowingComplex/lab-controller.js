const LabController = {
  paused:false, pendingStep:false, selectedIndex:0, scenario:'complex', steps:0, editing:false,
  agents() { return [...vehicles,...snakes.map(s=>s.head)]; },
  selected() { return this.agents()[this.selectedIndex] || null; },
  reset(name=this.scenario) {
    this.scenario=name; randomSeed(2027);
    vehicles=[]; snakes=[]; path=new Path(); path.radius=circuitWidth;
    for(const p of scenarioPoints(name)) path.addPoint(...p);
    newVehicle(260,270); newSnake(220,300);
    this.selectedIndex=0; this.steps=0; this.pendingStep=false;
    this.invalidate(); LabUI.refreshAgents();
  },
  invalidate() {
    for(const a of [...vehicles,...snakes.flatMap(s=>s.anneaux)]) {
      a.followDiagnostics=null; a.forceDiagnostics=null;
      a.wanderDiagnostics=null;
    }
  },
  step() {
    if(this.paused&&!this.pendingStep)return false;
    this.pendingStep=false;
    const neighbors=[...vehicles,...snakes.flatMap(s=>s.anneaux)];
    for(const v of vehicles){v.applyBehaviors(neighbors,path);v.update();}
    for(const s of snakes)s.move(path,neighborsForSnake(s,neighbors));
    this.steps++; return true;
  },
  requestStep() { this.paused=true; this.pendingStep=true; },
  select(index) {
    if(Number.isInteger(index)&&index>=0&&index<this.agents().length)this.selectedIndex=index;
  },
  moveVertex(index,x,y) {
    if(!this.paused || !this.editing || !path.points[index] ||
       !Number.isFinite(x)||!Number.isFinite(y))return false;
    path.points[index].set(constrain(x,0,width),constrain(y,0,height));
    this.invalidate(); return true;
  },
  setParameter(name,value) {
    const a=this.selected(); if(!a||!Number.isFinite(value)||value<0)return false;
    const snake=snakes.find(s=>s.head===a);
    if(name==='followPathWeight'&&snake)snake.followWeight=value;
    else if(name==='separateWeight'&&snake)snake.separationWeight=value;
    else if(name==='wanderWeight'&&snake)return false;
    else if(['anticipationDistance','targetAdvance','maxSpeed','maxForce','followPathWeight','separateWeight','wanderWeight'].includes(name))a[name]=value;
    else return false;
    this.invalidate();return true;
  }
};
