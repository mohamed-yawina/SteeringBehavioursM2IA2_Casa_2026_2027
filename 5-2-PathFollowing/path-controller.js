// Scene orchestration only. Vehicle owns steering and integration.
const PathLab = (() => {
  const scenarios = {
    reference: { position: [100, 100], velocity: [2, 0], start: [0, 400], end: [1200, 400] },
    inside: { position: [100, 400], velocity: [2, 0], start: [0, 400], end: [1200, 400] },
    threshold: { position: [100, 360], velocity: [2, 0], start: [0, 400], end: [1200, 400] },
    outside: { position: [100, 280], velocity: [2, 0], start: [0, 400], end: [1200, 400] },
    oblique: { position: [120, 150], velocity: [2, 0], start: [60, 650], end: [1140, 200] },
    stopped: { position: [100, 400], velocity: [0, 0], start: [0, 400], end: [1200, 400] },
    zero: { position: [100, 100], velocity: [2, 0], start: [600, 400], end: [600, 400] }
  };
  function create() {
    const state = { scenario: 'reference', tick: 0, paused: false, comparison: false,
      mousePath: false, selectedEndpoint: 'end', showDiagnostics: true, showTrails: true,
      prediction: 20, radius: 40, maxSpeed: 6, maxForce: .1, vehicles: [], path: null, trails: [], wrapped: [] };
    function reset() {
      const scene = scenarios[state.scenario];
      state.path = new Path(...scene.start, ...scene.end); state.path.radius = state.radius;
      state.vehicles = (state.comparison ? [0, 20] : [state.prediction]).map(prediction => {
        const v = new Vehicle(...scene.position); v.vel.set(...scene.velocity);
        v.predictionSteps = prediction; v.maxSpeed = state.maxSpeed; v.maxForce = state.maxForce; return v;
      });
      state.tick = 0; state.trails = state.vehicles.map(() => []); state.wrapped = state.vehicles.map(() => false);
    }
    function invalidate() { state.vehicles.forEach(v => { v.followDiagnostics = null; }); }
    function setScenario(name) { if (!(name in scenarios)) return; state.scenario = name; state.mousePath = false; reset(); }
    function setParameter(name, value) {
      const ranges = { prediction: [0, 60], radius: [0, 150], maxSpeed: [0, 12], maxForce: [0, 1] };
      if (!ranges[name] || !Number.isFinite(value)) return;
      state[name] = Math.max(ranges[name][0], Math.min(ranges[name][1], value));
      state.path.radius = state.radius;
      state.vehicles.forEach((v, i) => { v.predictionSteps = state.comparison ? i * 20 : state.prediction; v.maxSpeed = state.maxSpeed; v.maxForce = state.maxForce; });
      invalidate();
    }
    function editEndpoint(name, x, y) {
      if (!['start', 'end'].includes(name) || !Number.isFinite(x) || !Number.isFinite(y)) return;
      const px = Math.max(0, Math.min(1200, x)), py = Math.max(0, Math.min(800, y));
      if (state.path[name].x === px && state.path[name].y === py) return;
      state.path[name].set(px, py); state.trails.forEach(trail => { trail.length = 0; }); invalidate();
    }
    function step() {
      state.vehicles.forEach((v, i) => {
        const force = v.follow(state.path);
        v.applyForce(force);
        const beforeX = v.pos.x, beforeY = v.pos.y;
        v.edges(); // Retain the supplied follow/apply/edges/update ordering.
        state.wrapped[i] = beforeX !== v.pos.x || beforeY !== v.pos.y;
        v.update();
        if (state.wrapped[i]) state.trails[i].length = 0;
        state.trails[i].push(v.pos.copy());
        if (state.trails[i].length > 160) state.trails[i].shift();
      });
      state.tick++;
    }
    function frame() { if (!state.paused) step(); }
    function singleStep() { if (state.paused) step(); }
    function compare(enabled) { state.comparison = !!enabled; reset(); }
    reset();
    return { state, reset, invalidate, setScenario, setParameter, editEndpoint, step, frame, singleStep, compare };
  }
  return { create };
})();
