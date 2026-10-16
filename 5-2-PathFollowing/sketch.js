// Path Following — Daniel Shiffman / The Coding Train / The Nature of Code
// https://youtu.be/LrnR6dc2IfM
// https://thecodingtrain.com/learning/nature-of-code/5.7-path-following.html
// https://editor.p5js.org/codingtrain/sketches/dqM054vBV
// Complex Path reference (not implemented in this TD):
// https://editor.p5js.org/codingtrain/sketches/2FFzvxwVt
let vehicle;
let path;
let pathLab;
let pathCanvas;
let dragEndpoint = null;
let dragPointer = null;
function setup() {
  // Fixed world units preserve the original trajectories. CSS adapts the view.
  pathCanvas = createCanvas(1200, 800);
  pathCanvas.parent('canvas-host');
  pathLab = PathLab.create();
  vehicle = pathLab.state.vehicles[0]; path = pathLab.state.path;
  PathUI.init(pathLab);
  const canvas = pathCanvas.elt;
  canvas.tabIndex = 0;
  canvas.setAttribute('aria-label', 'Chemin A B. Choisir une extrémité dans le panneau puis utiliser les flèches.');
  function pointer(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * 1200 / rect.width, y: (event.clientY - rect.top) * 800 / rect.height };
  }
  canvas.addEventListener('pointerdown', event => {
    if (dragPointer !== null || (event.button !== undefined && event.button !== 0)) return;
    const p = pointer(event), s = pathLab.state;
    const hitRadius = Math.max(24, 20 * 1200 / canvas.getBoundingClientRect().width);
    const hits = ['start', 'end'].filter(name => Math.hypot(p.x - s.path[name].x, p.y - s.path[name].y) <= hitRadius);
    if (!hits.length) return;
    dragEndpoint = hits.includes(s.selectedEndpoint) ? s.selectedEndpoint : hits[0];
    s.selectedEndpoint = dragEndpoint; dragPointer = event.pointerId; canvas.setPointerCapture(event.pointerId); canvas.focus(); event.preventDefault();
  });
  canvas.addEventListener('pointermove', event => {
    const p = pointer(event), s = pathLab.state;
    if (dragPointer === event.pointerId && dragEndpoint) { pathLab.editEndpoint(dragEndpoint, p.x, p.y); event.preventDefault(); }
    else if (s.mousePath && dragPointer === null) pathLab.editEndpoint('end', s.path.end.x, p.y);
  });
  for (const eventName of ['pointerup', 'pointercancel', 'lostpointercapture']) canvas.addEventListener(eventName, event => {
    if (event.pointerId === dragPointer) { dragPointer = null; dragEndpoint = null; }
  });
  canvas.addEventListener('keydown', event => {
    const deltas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    if (!deltas[event.key]) return;
    const s = pathLab.state, point = s.path[s.selectedEndpoint], delta = deltas[event.key], step = event.shiftKey ? 10 : 1;
    pathLab.editEndpoint(s.selectedEndpoint, point.x + delta[0] * step, point.y + delta[1] * step); event.preventDefault();
  });
}
function draw() {
  pathLab.frame();
  vehicle = pathLab.state.vehicles[0]; path = pathLab.state.path;
  PathRenderer.render(pathLab.state);
  PathUI.update(pathLab);
}
