// Path Following (Complex Path)
// The Nature of Code
// The Coding Train / Daniel Shiffman
// https://youtu.be/LrnR6dc2IfM
// https://thecodingtrain.com/learning/nature-of-code/5.7-path-following.html

// Path Following: https://editor.p5js.org/codingtrain/sketches/dqM054vBV
// Complex Path: https://editor.p5js.org/codingtrain/sketches/2FFzvxwVt

// Crowd Path Following
// Via Reynolds: http://www.red3d.com/cwr/steer/CrowdPath.html

// Pour debug on/off affichage des lignes etc.
let debug = false;

// le chemin
let path;

// Tableau des véhicules
let vehicles = [];
let snakes = [];
let snakeFollowWeight = 2;
let snakeSeparationWeight = 1.2;
let circuitWidth = 20;
let snakeSpacing = 20;
let snakeSize = 22;

function setup() {
  createCanvas(1200,800).parent('canvas-host');
  frameRate(60); debug=true;
  bindSnakeControls(); LabController.reset(); LabUI.bind();
}

function draw() {
  LabController.step();
  background('#f1f5f9'); path.display();
  for(const v of vehicles)v.render();
  for(const snake of snakes)snake.show();
  LabRenderer.draw(); LabUI.update();
}

function neighborsForSnake(snake, allNeighbors) {
  const ownSegments = new Set(snake.anneaux);
  return allNeighbors.filter(vehicle => !ownSegments.has(vehicle));
}

function newSnake(x, y) {
  const snake = new SnakePathFollowing(x, y, 12, snakeSize,
    color(random(40, 200), random(70, 190), random(40, 200)));
  snake.followWeight = snakeFollowWeight;
  snake.separationWeight = snakeSeparationWeight;
  snake.setRingSpacing(snakeSpacing);
  snake.setSize(snakeSize);
  snakes.push(snake);
  document.getElementById('snake-count').value = `${snakes.length} serpent${snakes.length > 1 ? 's' : ''}`;
  if(typeof LabUI !== "undefined")LabUI.refreshAgents();
  return snake;
}

function bindSnakeControls() {
  const synchronize = () => {
    snakeFollowWeight = Number(document.getElementById('snake-follow').value);
    snakeSeparationWeight = Number(document.getElementById('snake-separation').value);
    circuitWidth = Number(document.getElementById('circuit-width').value);
    snakeSpacing = Number(document.getElementById('snake-spacing').value);
    snakeSize = Number(document.getElementById('snake-size').value);
    if (path) path.radius = circuitWidth;
    for (const snake of snakes) {
      snake.followWeight = snakeFollowWeight;
      snake.separationWeight = snakeSeparationWeight;
      snake.setRingSpacing(snakeSpacing);
      snake.setSize(snakeSize);
    }
    document.getElementById('snake-follow-value').value = snakeFollowWeight.toFixed(1);
    document.getElementById('snake-separation-value').value = snakeSeparationWeight.toFixed(1);
    document.getElementById('circuit-width-value').value = `${circuitWidth.toFixed(0)} px`;
    document.getElementById('snake-spacing-value').value = `${snakeSpacing.toFixed(0)} px`;
    document.getElementById('snake-size-value').value = `${snakeSize.toFixed(0)} px`;
    if (typeof LabController !== 'undefined') LabController.invalidate();
    if (typeof LabUI !== 'undefined') LabUI.sync();
  };
  for (const id of ['snake-follow', 'snake-separation', 'circuit-width', 'snake-spacing', 'snake-size']) {
    document.getElementById(id).addEventListener('input', synchronize);
  }
  synchronize();
}

function newPath() {
  // Simple suite de points partant de 30, 30 et allant vers 30, height - 30 etc.
  path = new Path();
  
  /*
  let offset = 100;
  path.addPoint(offset, offset);
  path.addPoint(300, 180);
  path.addPoint(width - offset, offset);
  path.addPoint(width - offset, height - offset);
  path.addPoint(width / 2, height - offset * 3);
  path.addPoint(200,550);
  path.addPoint(offset, height - offset);
*/
  // genere un circuit qui ressemble à une piste de course
  // de voiture, sans angles trop durs
  // Je voudrais une trentaine de segments
  // Pas dangles trop aigus
  // et un peu d'aléatoire pour ne pas générer toujours le même circuit
  
  let offset = 100;
  let nbSegments = 30;
  let angleStep = (TWO_PI / nbSegments);
  let radiusMin = min(width, height) / 3;
  let radiusMax = min(width, height) / 2.5;

  for (let i = 0; i < nbSegments; i++) {
    let angle = i * angleStep;
    // un peu d'aléatoire sur le rayon
    let radius = random(radiusMin, radiusMax);
    let x = width / 2 + cos(angle) * radius;
    let y = height / 2 + sin(angle) * radius;
    path.addPoint(x, y);
  }
  
}

function newVehicle(x, y) {
  const selected = typeof LabController !== 'undefined' ? LabController.selected() : null;
  let maxspeed = random(1, 3);
  let maxforce = 0.3;
  let v = new Vehicle(x, y, maxspeed, maxforce);
  vehicles.push(v);
  if (selected) LabController.selectedIndex = LabController.agents().indexOf(selected);
  if(typeof LabUI !== "undefined")LabUI.refreshAgents();
  return v;
}

function keyPressed(event) {
  if (document.activeElement?.matches('input, select, textarea')) return;
  if (key.toLowerCase() == "t") {
    if (!event?.repeat) newSnake(constrain(mouseX, 0, width), constrain(mouseY, 0, height));
  } else if (key == "d") {
    debug = !debug;
    const checkbox=document.getElementById("details");if(checkbox)checkbox.checked=debug;
    Vehicle.debug = false;
  } else if(key == "s") {
    let v = newVehicle(mouseX, mouseY);
    v.maxSpeed = 10;
    v.couleur = "red"
    if (typeof LabUI !== 'undefined') LabUI.sync();
  } else if (key == "w") {
    const selected = typeof LabController !== 'undefined' ? LabController.selected() : null;
    // on cree un véhicule wander
    let v = new Vehicle(mouseX, mouseY, 2, 0.25);
    v.wanderWeight = 1;
    v.followPathWeight = 0;
    v.separateWeight = 0;
    v.r = 30;
    v.couleur = "lightgreen";
    vehicles.push(v);
    if (selected) LabController.selectedIndex = LabController.agents().indexOf(selected);
    if (typeof LabUI !== 'undefined') LabUI.refreshAgents();
  }
}

let draggedVertex = -1;
function mousePressed(event) {
  if(event?.target?.tagName !== 'CANVAS')return;
  if(LabController.editing){
    LabController.paused=true;
    draggedVertex=path.points.findIndex(p=>Math.hypot(p.x-mouseX,p.y-mouseY)<16);
  }else{
    const index=LabController.agents().findIndex(a=>Math.hypot(a.pos.x-mouseX,a.pos.y-mouseY)<20);
    if(index>=0){LabController.select(index);LabUI.refreshAgents();}
  }
}
function mouseReleased(){draggedVertex=-1;}
function mouseDragged(event) {
  if(event?.target && event.target.tagName!=='CANVAS')return;
  if(LabController.editing){LabController.moveVertex(draggedVertex,mouseX,mouseY);return false;}
  if (mouseX >= 0 && mouseX <= width && mouseY >= 0 && mouseY <= height) newVehicle(mouseX, mouseY);
}
