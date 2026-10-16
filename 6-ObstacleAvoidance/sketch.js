// TD6 — local p5 loop. Physical behavior lives exclusively in Vehicle.
let pursuer1,pursuer2,target;
let obstacles=[],vehicules=[];
let draggedObstacle=-1;
function setup(){
  const canvas=createCanvas(1200,800);if(canvas?.parent)canvas.parent('canvas-host');
  frameRate(60);LabController.reset();LabUI.bind();
}
function draw(){
  LabController.step();
  background(8,18,34);
  target.show();
  for(const o of obstacles)if(validObstacle(o))o.show();
  for(const v of vehicules)if(v.validPhysics()){v.drawPath();v.drawVehicle();}
  LabRenderer.draw();LabUI.update();
}
function canvasEvent(event){return !event?.target||event.target.tagName==='CANVAS';}
function mousePressed(event){
  if(!canvasEvent(event)||mouseX<0||mouseX>width||mouseY<0||mouseY>height)return;
  if(event?.shiftKey){
    const index=vehicules.findIndex(v=>Math.hypot(v.pos.x-mouseX,v.pos.y-mouseY)<25);
    if(index>=0)LabController.selectVehicle(index);
    LabUI.sync();return;
  }
  if(LabController.editing){
    LabController.paused=true;
    const hit=obstacles.findIndex(o=>Math.hypot(o.pos.x-mouseX,o.pos.y-mouseY)<=Math.max(o.r,12));
    draggedObstacle=hit;if(hit>=0)LabController.selectObstacle(hit);
  }else LabController.addObstacle(mouseX,mouseY,random(20,100));
  LabUI.sync();
}
function mouseDragged(event){
  if(!canvasEvent(event)||draggedObstacle<0||!LabController.editing)return;
  const o=obstacles[draggedObstacle];
  LabController.editObstacle(draggedObstacle,constrain(mouseX,0,width),constrain(mouseY,0,height),o.r);
  LabUI.sync();return false;
}
function mouseReleased(){draggedObstacle=-1;}
function keyPressed(event){
  if(typeof document!=='undefined'&&document.activeElement?.matches('input,select,textarea,button'))return;
  if(key==='v')LabController.addVehicle(random(width),random(height));
  if(key==='d'){Vehicle.debug=!Vehicle.debug;LabController.details=Vehicle.debug;LabUI.sync();}
  else if(key==='f')for(let i=0;i<10;i++)LabController.addVehicle(20,300,[random(1,5),random(1,5)]);
  else if(key===' '){LabController.paused=!LabController.paused;return false;}
}
