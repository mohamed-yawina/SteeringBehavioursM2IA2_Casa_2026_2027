let steeringLabCanvas;
function setup() {
  const bounds = SteeringLab.dimensions();
  steeringLabCanvas = createCanvas(bounds.width, bounds.height);
  steeringLabCanvas.parent('simulation-canvas');
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  SteeringLab.bind(); creerVehicules(20); SteeringLab.createTarget();
}
function draw() {
  const bounds = SteeringLab.dimensions();
  SteeringLab.tick(createVector(mouseX, mouseY), bounds);
  SteeringLab.draw(bounds);
}
function mousePressed() {
  SteeringLab.selectAgent(createVector(mouseX, mouseY));
}
function windowResized() {
  if (!steeringLabCanvas) return;
  const bounds = SteeringLab.dimensions(); resizeCanvas(bounds.width, bounds.height);
}
