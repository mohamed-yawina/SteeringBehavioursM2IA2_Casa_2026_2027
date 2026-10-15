function setup() {
  const box = document.getElementById('simulation-canvas').getBoundingClientRect();
  const width = Math.max(300, Math.floor(box.width));
  const height = Math.max(300, Math.min(620, Math.floor(width * 0.58)));
  const canvas = createCanvas(width, height);
  canvas.parent('simulation-canvas');
  pixelDensity(1);
  PursuitLab.init();
}

function draw() {
  PursuitLab.drawFrame(frameRate());
}

function mousePressed() {
  PursuitLab.mousePressed(mouseX, mouseY);
}

function windowResized() {
  PursuitLab.resize();
}
