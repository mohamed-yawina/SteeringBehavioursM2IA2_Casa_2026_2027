const PursuitLabRenderer = (() => {
  function drawArrow(origin, vector, shade, scale = 8) {
    const endX = origin.x + vector.x * scale;
    const endY = origin.y + vector.y * scale;
    stroke(shade); strokeWeight(2); line(origin.x, origin.y, endX, endY);
    push(); translate(endX, endY); rotate(vector.heading()); noStroke(); fill(shade);
    triangle(0, 0, -8, -4, -8, 4); pop();
  }

  function drawEntity(entity, shade, state, selected = false) {
    if (state.showTrails && entity.trail) {
      noFill();
      for (let i = 1; i < entity.trail.length; i++) {
        const a = entity.trail[i - 1], b = entity.trail[i];
        stroke(red(shade), green(shade), blue(shade), map(i, 1, entity.trail.length, 10, 115));
        strokeWeight(map(i, 1, entity.trail.length, 1, 3)); line(a.x, a.y, b.x, b.y);
      }
    }
    push(); translate(entity.pos.x, entity.pos.y);
    noFill(); stroke(shade); strokeWeight(selected ? 2.5 : 1.5); circle(0, 0, entity.r * 2);
    fill(shade); noStroke(); circle(0, 0, 5);
    if (entity instanceof Target && state.showVision && entity.visionRadius) {
      noFill(); stroke(255, 111, 170, 55); strokeWeight(1); circle(0, 0, entity.visionRadius * 2);
    }
    pop();
  }

  function drawSystem(system, index, state, width, height) {
    const halfOffset = state.systems.length > 1 ? index * (width / 2) : 0;
    const selected = index === state.selectedIndex;
    const target = system.targets.length ? closestTargetTo(system.agent, system.targets) : system.target;
    if (state.systems.length > 1) {
      noStroke(); fill(180); textAlign(CENTER); textSize(13); text(system.label.toUpperCase(), halfOffset + width / 4, 25);
    }
    for (const item of (system.targets.length ? system.targets : [system.target])) drawEntity(item, color(255, 102, 165), state);
    drawEntity(system.agent, color(83, 218, 255), state, selected);

    const sample = system.agent.lastSteering;
    if (!sample) return;
    if (state.showPrediction && sample.predictedPosition) {
      noFill(); stroke(184, 167, 255); strokeWeight(1.5); drawingContext.setLineDash([5, 5]);
      line(target.pos.x, target.pos.y, sample.predictedPosition.x, sample.predictedPosition.y); drawingContext.setLineDash([]);
      fill(184, 167, 255); circle(sample.predictedPosition.x, sample.predictedPosition.y, 10);
    }
    if (selected && state.showVectors) {
      drawArrow(sample.origin, sample.velocity, color(86, 219, 255));
      drawArrow(sample.origin, sample.desiredVelocity, color(184, 167, 255));
      drawArrow(sample.origin, sample.force, color(255, 108, 155), 35);
    }
  }

  function render(state, width, height) {
    background(8, 15, 26);
    stroke(255, 255, 255, 12); strokeWeight(1);
    for (let x = 0; x < width; x += 40) line(x, 0, x, height);
    for (let y = 0; y < height; y += 40) line(0, y, width, y);
    if (state.systems.length > 1) { stroke(255, 255, 255, 50); line(width / 2, 0, width / 2, height); }
    state.systems.forEach((system, index) => drawSystem(system, index, state, width, height));
  }

  return { render };
})();
