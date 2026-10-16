// Scalar Projection — The Nature of Code / Daniel Shiffman / The Coding Train
// Original references preserved:
// https://youtu.be/DHPfoqiE4yQ
// https://thecodingtrain.com/learning/nature-of-code/5.6-dot-product.html
// https://editor.p5js.org/codingtrain/sketches/ORP5Yx7JX
// Formula retained in projection.js: normalize b, dot a with it, multiply by the scalar.
let projectionLab;
let projectionCanvas;
let draggingPoint = null;
let activePointer = null;

function sceneSize() {
  const w = Math.max(1, Math.round(document.getElementById('canvas-host').getBoundingClientRect().width));
  return { w, h: Math.max(320, Math.min(640, Math.round(w * .64))) };
}
function sceneTransform() {
  const scale = Math.min(width / 1000, height / 640);
  return { scale, x: (width - 1000 * scale) / 2, y: (height - 640 * scale) / 2 };
}
function eventPoint(event) {
  const rect = projectionCanvas.elt.getBoundingClientRect(), view = sceneTransform();
  return { x: ((event.clientX - rect.left) * width / rect.width - view.x) / view.scale,
    y: ((event.clientY - rect.top) * height / rect.height - view.y) / view.scale };
}
function setup() {
  const size = sceneSize();
  projectionCanvas = createCanvas(size.w, size.h);
  projectionCanvas.parent('canvas-host');
  pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
  projectionCanvas.elt.tabIndex = 0;
  projectionCanvas.elt.setAttribute('aria-label', 'Construction de projection. Sélectionnez O, P ou B, puis utilisez les flèches.');
  projectionCanvas.elt.setAttribute('aria-describedby', 'canvas-summary');
  projectionLab = ProjectionController.create(state => { ProjectionUI.render(state); if (projectionLab) redraw(); });
  ProjectionUI.bind(projectionLab);
  const canvas = projectionCanvas.elt;
  canvas.addEventListener('pointerdown', event => {
    if (activePointer !== null || (event.button !== undefined && event.button !== 0)) return;
    const point = eventPoint(event), state = projectionLab.snapshot;
    const hits = ['O', 'P', 'B'].map(name => ({ name, distance: Math.hypot(point.x - state.result[name].x, point.y - state.result[name].y) }))
      .filter(hit => hit.distance <= Math.max(16, 20 / sceneTransform().scale))
      .sort((a, b) => (a.name === state.selected ? -1 : b.name === state.selected ? 1 : a.distance - b.distance));
    if (!hits.length) return;
    draggingPoint = hits[0].name; activePointer = event.pointerId;
    canvas.setPointerCapture(event.pointerId); canvas.focus(); projectionLab.select(draggingPoint); event.preventDefault();
  });
  canvas.addEventListener('pointermove', event => {
    if (event.pointerId !== activePointer || !draggingPoint) return;
    const point = eventPoint(event); projectionLab.move(draggingPoint, point.x, point.y); event.preventDefault();
  });
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(type, event => {
    if (event.pointerId !== activePointer) return;
    draggingPoint = null; activePointer = null;
  });
  canvas.addEventListener('keydown', event => {
    const deltas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!deltas[event.key]) return;
    const state = projectionLab.snapshot, point = state.result[state.selected], delta = deltas[event.key];
    const step = event.shiftKey ? 10 : 1;
    projectionLab.move(state.selected, point.x + delta[0] * step, point.y + delta[1] * step); event.preventDefault();
  });
  noLoop(); // p5 alone owns rendering; changes explicitly request redraw().
}
function windowResized() {
  const size = sceneSize(); resizeCanvas(size.w, size.h); // Geometry in reference pixels is unchanged.
}
function geometryLine(a, b, shade, weight = 2) {
  stroke(shade); strokeWeight(weight); line(a.x, a.y, b.x, b.y);
}
function geometryArrow(origin, vector, shade, factor = 1) {
  if (!vector) return;
  const end = { x: origin.x + vector.x * factor, y: origin.y + vector.y * factor };
  geometryLine(origin, end, shade, 3);
  if (Math.hypot(vector.x, vector.y) < 1e-12) return;
  const angle = Math.atan2(vector.y, vector.x), size = Math.max(10, 6 / sceneTransform().scale);
  push(); translate(end.x, end.y); rotate(angle); noStroke(); fill(shade); triangle(0, 0, -size, -size / 2, -size, size / 2); pop();
}
function geometryPoint(point, name, shade, offsetX, offsetY, annotations, selected = false) {
  if (!point) return;
  const zoom = Math.max(1, .7 / sceneTransform().scale);
  stroke('#0c1623'); strokeWeight(3); fill(shade); circle(point.x, point.y, (selected ? 21 : 15) * zoom);
  if (annotations) { noStroke(); fill(shade); textSize(17 * zoom); textStyle(BOLD); text(name, point.x + offsetX * zoom, point.y + offsetY * zoom); textStyle(NORMAL); }
}
function draw() {
  background('#0c1623');
  if (!projectionLab) return;
  // One immutable calculation result, no projection or controller mutation during rendering.
  const state = projectionLab.snapshot, d = state.result, stage = state.step, opt = state.options;
  const view = sceneTransform();
  push(); translate(view.x, view.y); scale(view.scale);
  stroke('#182738'); strokeWeight(1);
  for (let x = 0; x <= 1000; x += 40) line(x, 0, x, 640);
  for (let y = 0; y <= 640; y += 40) line(0, y, 1000, y);
  if (!d.O || !d.P || !d.B) { pop(); return; }
  if (d.valid) {
    drawingContext.setLineDash([7, 9]);
    geometryLine({ x: d.O.x - d.u.x * 2000, y: d.O.y - d.u.y * 2000 },
      { x: d.O.x + d.u.x * 2000, y: d.O.y + d.u.y * 2000 }, '#566a81', 1.5);
    drawingContext.setLineDash([]);
  }
  geometryLine(d.O, d.B, '#aab9cd', 5);
  if (opt.vectors) {
    geometryArrow(d.O, d.a, '#69d8ee'); geometryArrow(d.O, d.b, '#aab9cd');
    if (d.valid && stage >= 2) geometryArrow(d.O, d.u, '#f7d98a', 55);
    if (d.valid && stage >= 4) geometryArrow(d.O, d.vector, '#b6a1ff');
  }
  if (d.valid && stage >= 3 && opt.annotations) {
    noStroke(); fill('#b6a1ff'); textSize(14);
    text(`s = ${d.scalar.toFixed(1)} px`, (d.O.x + d.H.x) / 2, (d.O.y + d.H.y) / 2 + 30);
  }
  if (d.valid && stage >= 5 && opt.perpendicular) {
    geometryArrow(d.H, d.residual, '#ff9c90');
    if (d.distance > 1) {
      const n = { x: d.residual.x / d.distance, y: d.residual.y / d.distance }, size = Math.min(14, d.distance / 3);
      const a = { x: d.H.x + d.u.x * size, y: d.H.y + d.u.y * size };
      const b = { x: a.x + n.x * size, y: a.y + n.y * size };
      const c = { x: d.H.x + n.x * size, y: d.H.y + n.y * size };
      geometryLine(a, b, '#ff9c90', 1.5); geometryLine(b, c, '#ff9c90', 1.5);
    }
    if (opt.annotations) { noStroke(); fill('#ff9c90'); textSize(14); text(`d droite = ${d.distance.toFixed(1)}`, (d.P.x + d.H.x) / 2 + 14, (d.P.y + d.H.y) / 2); }
  }
  if (stage >= 6 && d.segmentPoint && opt.perpendicular) {
    drawingContext.setLineDash([4, 7]); geometryLine(d.P, d.segmentPoint, '#95e3b3', 2); drawingContext.setLineDash([]);
  }
  geometryPoint(d.O, 'O', '#e7eef6', -25, 28, opt.annotations, state.selected === 'O');
  geometryPoint(d.B, 'B', '#aab9cd', 14, 28, opt.annotations, state.selected === 'B');
  geometryPoint(d.P, 'P', '#69d8ee', 14, -14, opt.annotations, state.selected === 'P');
  if (stage >= 4) geometryPoint(d.H, 'H', '#b6a1ff', -22, -17, opt.annotations);
  if (stage >= 6 && d.segmentPoint) {
    noFill(); stroke('#95e3b3'); strokeWeight(3); circle(d.segmentPoint.x, d.segmentPoint.y, 27);
    if (opt.annotations) { noStroke(); fill('#95e3b3'); textSize(16); text('Q', d.segmentPoint.x + 18, d.segmentPoint.y + 44); }
  }
  pop();
}
