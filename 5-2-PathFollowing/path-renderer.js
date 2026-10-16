// Presentation reads only the saved diagnostic of the last physical step.
const PathRenderer = (() => {
  const shades = ['#6ddbc7', '#c5a0ff'];
  function lineBetween(a, b, shade, weight = 2) { stroke(shade); strokeWeight(weight); line(a.x, a.y, b.x, b.y); }
  function arrow(origin, vector, shade, factor = 1) {
    const end = { x: origin.x + vector.x * factor, y: origin.y + vector.y * factor };
    lineBetween(origin, end, shade, 2);
    if (vector.mag() === 0) return;
    push(); translate(end.x, end.y); rotate(vector.heading()); fill(shade); noStroke(); triangle(0, 0, -10, -4, -10, 4); pop();
  }
  function marker(point, label, shade, dx = 12, dy = -14) {
    if (!point) return;
    fill(shade); stroke('#101a28'); strokeWeight(2); circle(point.x, point.y, 14);
    noStroke(); textSize(18); text(label, point.x + dx, point.y + dy);
  }
  function render(state) {
    background('#101a28'); stroke('#1d2b3c'); strokeWeight(1);
    for (let x = 0; x < 1200; x += 50) line(x, 0, x, 800);
    for (let y = 0; y < 800; y += 50) line(0, y, 1200, y);
    const path = state.path, direction = p5.Vector.sub(path.end, path.start);
    if (direction.mag() > 0) {
      direction.normalize();
      const a = path.start.copy().add(direction.copy().mult(-2400));
      const b = path.end.copy().add(direction.copy().mult(2400));
      stroke(90, 145, 180, 25); strokeWeight(path.radius * 2); if (path.radius > 0) line(a.x, a.y, b.x, b.y);
      drawingContext.setLineDash([10, 10]); lineBetween(a, b, '#617a92', 2); drawingContext.setLineDash([]);
    }
    path.show();
    marker(path.start, 'A', '#ffcf85', 12, 26); marker(path.end, 'B', '#ffcf85', -28, 26);
    state.vehicles.forEach((v, i) => {
      const shade = shades[i];
      if (state.showTrails) for (let j = 1; j < state.trails[i].length; j++) lineBetween(state.trails[i][j - 1], state.trails[i][j], shade, 1.5);
      if (state.showDiagnostics) {
        const d = v.copyFollowDiagnostics();
        if (d) {
          if (d.origin && d.future) { drawingContext.setLineDash([4, 6]); lineBetween(d.origin, d.future, '#ff9a8c'); drawingContext.setLineDash([]); }
          if (d.origin && d.velocity) arrow(d.origin, d.velocity, '#e8eef6', 12);
          if (d.origin) arrow(d.origin, d.force, shade, 350);
          if (d.future && d.target) {
            lineBetween(d.future, d.target, '#ffcf85');
            const residual = p5.Vector.sub(d.future, d.target);
            if (residual.mag() > 1 && direction.mag() > 0) {
              residual.normalize();
              const a = d.target.copy().add(direction.copy().mult(12));
              const b = a.copy().add(residual.copy().mult(12));
              const c = d.target.copy().add(residual.copy().mult(12));
              lineBetween(a, b, '#ffcf85'); lineBetween(b, c, '#ffcf85');
            }
          }
          marker(d.future, `F${state.comparison ? i + 1 : ''}`, '#ff9a8c');
          marker(d.target, `H${state.comparison ? i + 1 : ''}`, shade, 12, 26);
          if (d.origin) { noFill(); stroke(shade); strokeWeight(1); circle(d.origin.x, d.origin.y, 8); }
        }
      }
      // Use the supplied vehicle renderer, with a colored ring to identify cohorts.
      v.show(); noFill(); stroke(shade); strokeWeight(2); circle(v.pos.x, v.pos.y, 44);
    });
  }
  return { render };
})();
