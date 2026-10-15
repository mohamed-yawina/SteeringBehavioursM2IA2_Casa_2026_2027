// Contrôleur de scène et contrôles DOM. Les comportements ne déplacent pas les agents.
const SteeringLab = (() => {
  const ARRIVAL_RADIUS = 16;
  let agents = [], target, paused = false, lastDistance = 0, selectedAgent = null;
  const byId = id => document.getElementById(id);
  const controls = {};
  function dimensions() { const box = byId('simulation-canvas').getBoundingClientRect(); return { width: Math.max(1, box.width), height: Math.max(1, box.height) }; }
  function createVehicle(x, y) { return new LabVehicle(x, y); }
  function randomPosition(bounds) { return createVector(random(24, Math.max(25, bounds.width - 24)), random(24, Math.max(25, bounds.height - 24))); }
  function hasArrived(agent, destination, radius = ARRIVAL_RADIUS) { return p5.Vector.dist(agent.pos, destination.pos || destination) <= radius; }
  function respawnVehicle(agent, position) {
    agent.pos.set(position.x, position.y);
    agent.vel.mult(0);
    agent.acc.mult(0);
  }
  function createVehicles(count) {
    if (!Number.isInteger(count) || count < 1 || count > 100) throw new RangeError('Le nombre de véhicules doit être compris entre 1 et 100.');
    const bounds = dimensions();
    agents = Array.from({ length: count }, () => { const p = randomPosition(bounds); return createVehicle(p.x, p.y); });
    selectedAgent = agents[0] || null;
  }
  function createTarget() { const d = dimensions(); const p = createVector(d.width * .68, d.height * .48); target = new LabTarget(p.x, p.y); }
  function bind() {
    controls.behavior = byId('behavior-select'); controls.targetMode = byId('target-select'); controls.count = byId('count-slider');
    controls.speed = byId('speed-slider'); controls.force = byId('force-slider'); controls.radius = byId('radius-slider');
    controls.trails = byId('trails-toggle'); controls.vectors = byId('vectors-toggle'); controls.vectorsSide = byId('vectors-toggle-side');
    const sync = () => {
      byId('count-output').value = byId('count-value').textContent = controls.count.value;
      byId('speed-output').value = Number(controls.speed.value).toFixed(1);
      byId('force-output').value = Number(controls.force.value).toFixed(2);
      byId('radius-output').value = `${controls.radius.value} px`;
      for (const agent of agents) { agent.maxSpeed = Number(controls.speed.value); agent.maxForce = Number(controls.force.value); }
    };
    controls.count.addEventListener('input', () => { creerVehicules(Number(controls.count.value)); sync(); });
    for (const input of [controls.speed, controls.force, controls.radius]) input.addEventListener('input', sync);
    controls.vectors.addEventListener('change', () => controls.vectorsSide.checked = controls.vectors.checked);
    controls.vectorsSide.addEventListener('change', () => controls.vectors.checked = controls.vectorsSide.checked);
    byId('pause-button').addEventListener('click', () => paused = true);
    byId('resume-button').addEventListener('click', () => paused = false);
    byId('reset-button').addEventListener('click', reset);
    document.querySelectorAll('[data-scenario]').forEach(button => button.addEventListener('click', () => scenario(button.dataset.scenario, button)));
    sync();
  }
  function reset() { paused = false; creerVehicules(Number(controls.count.value)); createTarget(); agents.forEach(a => a.trail.length = 0); }
  function scenario(name, button) {
    document.querySelectorAll('[data-scenario]').forEach(item => item.classList.toggle('active', item === button));
    if (name === 'flee') { controls.behavior.value = 'flee'; controls.targetMode.value = 'mouse'; controls.count.value = '20'; controls.force.value = '0.1'; }
    if (name === 'seek') { controls.behavior.value = 'seek'; controls.targetMode.value = 'mouse'; controls.count.value = '20'; controls.force.value = '0.1'; }
    if (name === 'mobile') { controls.behavior.value = 'seek'; controls.targetMode.value = 'autonomous'; controls.count.value = '20'; controls.force.value = '0.1'; }
    if (name === 'gentle') { controls.behavior.value = 'seek'; controls.targetMode.value = 'mouse'; controls.count.value = '1'; controls.force.value = '0.01'; }
    creerVehicules(Number(controls.count.value));
    controls.speed.dispatchEvent(new Event('input')); controls.force.dispatchEvent(new Event('input'));
    byId('count-output').value = byId('count-value').textContent = controls.count.value;
  }
  function tick(pointer, bounds) {
    if (paused) return;
    const mouse = controls.targetMode.value === 'mouse';
    if (mouse) target.pos.set(constrain(pointer.x, 0, bounds.width), constrain(pointer.y, 0, bounds.height));
    else target.step(bounds.width, bounds.height);
    const behavior = controls.behavior.value;
    let autonomousTargetRespawned = false;
    for (const agent of agents) {
      agent.maxSpeed = Number(controls.speed.value); agent.maxForce = Number(controls.force.value);
      agent.step(target.pos, behavior, bounds, controls.trails.checked, Number(controls.radius.value));
      if (agent === selectedAgent) lastDistance = agent.vectors.distance;
      if (hasArrived(agent, target)) {
        const p = randomPosition(bounds); respawnVehicle(agent, p);
        agent.trail.length = 0; agent.clearSample();
        if (!mouse && !autonomousTargetRespawned) { target.placeRandomly(bounds.width, bounds.height); autonomousTargetRespawned = true; }
        if (agent === selectedAgent) lastDistance = p5.Vector.dist(agent.pos, target.pos);
      }
    }
  }
  function draw(bounds) {
    if (controls.trails.checked) { background(10, 18, 31, 42); } else background(10, 18, 31);
    // Grille discrète, purement visuelle.
    stroke(110, 145, 190, 15); strokeWeight(1);
    for (let x = 0; x < bounds.width; x += 40) line(x, 0, x, bounds.height);
    for (let y = 0; y < bounds.height; y += 40) line(0, y, bounds.width, y);
    if (controls.targetMode.value === 'mouse') {
      noFill(); stroke(255, 173, 105, 45); strokeWeight(1); circle(target.pos.x, target.pos.y, Number(controls.radius.value) * 2);
    }
    agents.forEach(agent => {
      if (agent.trail.length > 1) { noFill(); stroke(118, 169, 255, 85); strokeWeight(1); beginShape(); agent.trail.forEach(p => vertex(p.x, p.y)); endShape(); }
      agent.show();
      if (agent === selectedAgent) { noFill(); stroke(112, 224, 189, 150); strokeWeight(1); circle(agent.pos.x, agent.pos.y, agent.r * 3.2); }
    });
    target.show();
    if (selectedAgent && controls.vectors.checked && selectedAgent.vectors.visible) drawVectors(selectedAgent);
    byId('fps-value').textContent = Math.round(frameRate());
    byId('count-value').textContent = agents.length;
    byId('distance-value').textContent = `${lastDistance.toFixed(1)} px`;
  }
  function drawVectors(agent) {
    const v = agent.vectors, o = v.origin;
    drawArrow(o, v.desired, color(255, 173, 105), 'desired');
    drawArrow(o, v.velocity, color(87, 213, 223), 'velocity');
    drawArrow(o, v.steering, color(255, 113, 142), 'steering');
    noFill(); stroke(255, 173, 105, 95); strokeWeight(1); line(o.x, o.y, v.target.x, v.target.y);
    noStroke(); fill(255, 255, 255, 180); circle(o.x, o.y, 3);
  }
  function drawArrow(origin, vector, shade, type) {
    const visualScale = 12, endX = origin.x + vector.x * visualScale, endY = origin.y + vector.y * visualScale;
    stroke(shade); strokeWeight(type === 'steering' ? 2 : 1.6); line(origin.x, origin.y, endX, endY);
    const heading = Math.atan2(vector.y, vector.x); push(); translate(endX, endY); rotate(heading); noStroke(); fill(shade); triangle(0, 0, -6, -3, -6, 3); pop();
  }
  function selectAgent(pointer) {
    let closest = null, bestDistance = Infinity;
    for (const agent of agents) {
      const distance = p5.Vector.dist(pointer, agent.pos);
      if (distance < bestDistance && distance <= Math.max(agent.r * 2, 18)) { closest = agent; bestDistance = distance; }
    }
    if (closest) selectedAgent = closest;
    return closest;
  }
  return { ARRIVAL_RADIUS, bind, createVehicles, createTarget, hasArrived, respawnVehicle, selectAgent, reset, tick, draw, dimensions, get agents() { return agents; }, get target() { return target; }, get selectedAgent() { return selectedAgent; }, get paused() { return paused; } };
})();

// Point d'entrée explicite demandé dans l'exercice pour créer la population.
function creerVehicules(nb) {
  SteeringLab.createVehicles(nb);
}
