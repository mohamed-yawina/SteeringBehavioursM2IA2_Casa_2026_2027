const PursuitLab = (() => {
  const state = {
    paused: false, scenario: 'single', behavior: 'pursuit', frame: 0,
    simSpeed: 1, predictionFrames: 10, maxSpeed: 7, maxForce: 0.6,
    preySpeed: 3, preyForce: 0.35, visionRadius: 200, showVectors: true, showPrediction: true,
    showTrails: true, showVision: true, selectedIndex: 0, systems: [],
    history: [], distanceTotal: 0, distanceSamples: 0, captures: 0,
    lastCaptureFrame: null, stepRequested: false,
  };

  const byId = id => document.getElementById(id);
  let canvasWidth = 900;
  let canvasHeight = 520;

  function dimensions() {
    const box = byId('simulation-canvas').getBoundingClientRect();
    canvasWidth = Math.max(300, Math.floor(box.width));
    canvasHeight = Math.max(300, Math.min(620, Math.floor(canvasWidth * 0.58)));
    return { width: canvasWidth, height: canvasHeight };
  }

  function makeTarget(x, y, velocity, type = 'basic') {
    const target = type === 'ball'
      ? new BouncingBall(x, y, velocity.mag())
      : new Target(x, y, 'basic');
    target.pos.set(x, y);
    target.vel.set(velocity.x, velocity.y);
    target.maxSpeed = Math.max(velocity.mag() + 0.1, state.preySpeed);
    target.baseMaxSpeed = target.maxSpeed;
    target.maxForce = state.preyForce;
    target.visionRadius = state.visionRadius;
    return target;
  }

  function makeAgent(x, y, behavior, label) {
    const agent = new PursuitAgent(x, y);
    agent.maxSpeed = state.maxSpeed;
    agent.baseMaxSpeed = state.maxSpeed;
    agent.maxForce = state.maxForce;
    agent.r = 13;
    agent.color = color(83, 218, 255);
    return { agent, behavior, label, targets: [], target: null, captures: 0, lastCaptureFrame: null, totalDistance: 0, samples: 0 };
  }

  function reset() {
    randomSeed(261015);
    state.frame = 0;
    state.history = [];
    state.distanceTotal = 0;
    state.distanceSamples = 0;
    state.captures = 0;
    state.lastCaptureFrame = null;
    state.selectedIndex = 0;
    state.systems = [];
    byId('behavior-select').disabled = state.scenario !== 'single';

    if (state.scenario === 'compare-pursuit' || state.scenario === 'compare-evade') {
      const isPursuit = state.scenario === 'compare-pursuit';
      const behaviors = isPursuit ? ['seek', 'pursuit'] : ['flee', 'evade'];
      const half = canvasWidth / 2;
      for (let i = 0; i < 2; i++) {
        const offset = i * half;
        const system = makeAgent(offset + half * 0.2, canvasHeight * 0.66, behaviors[i], behaviors[i]);
        system.bounds = { left: offset, right: offset + half };
        system.target = makeTarget(offset + half * 0.69, canvasHeight * 0.34, createVector(1.6, -0.45));
        system.spawnAnchor = { x: offset + half * 0.69, y: canvasHeight * 0.34, vx: 1.6, vy: -0.45 };
        state.systems.push(system);
      }
    } else {
      const behavior = state.scenario === 'chase' || state.scenario === 'bouncing'
        ? 'pursuit' : state.behavior;
      const system = makeAgent(canvasWidth * 0.23, canvasHeight * 0.64, behavior, 'poursuivant');
      if (state.scenario === 'bouncing') {
        const speeds = [2, 3.5, 5, 6.5];
        system.targets = speeds.map((speed, i) => {
          const x = canvasWidth * (0.55 + i * 0.09);
          const y = canvasHeight * (0.24 + (i % 2) * 0.48);
          const target = makeTarget(x, y, p5.Vector.random2D().mult(speed), 'ball');
          target.spawnAnchor = { x, y, vx: target.vel.x, vy: target.vel.y };
          return target;
        });
      } else {
        system.target = makeTarget(canvasWidth * 0.72, canvasHeight * 0.35, createVector(1.5, 0.7));
        system.target.spawnAnchor = { x: canvasWidth * 0.72, y: canvasHeight * 0.35, vx: 1.5, vy: 0.7 };
        system.target.visionRadius = state.visionRadius;
      }
      state.systems.push(system);
    }
    updateMetrics();
  }

  function readControls() {
    state.scenario = byId('scenario-select').value;
    state.behavior = byId('behavior-select').value;
    state.predictionFrames = Number(byId('prediction-slider').value);
    state.maxSpeed = Number(byId('speed-slider').value);
    state.maxForce = Number(byId('force-slider').value);
    state.preySpeed = Number(byId('prey-speed-slider').value);
    state.preyForce = Number(byId('prey-force-slider').value);
    state.visionRadius = Number(byId('vision-slider').value);
    state.simSpeed = Number(byId('sim-speed-slider').value);
    state.showVectors = byId('vectors-toggle').checked;
    state.showPrediction = byId('prediction-toggle').checked;
    state.showTrails = byId('trails-toggle').checked;
    state.showVision = byId('vision-toggle').checked;
  }

  function bindControls() {
    const rangePairs = [
      ['prediction-slider', 'prediction-output', value => `${value} frames`],
      ['speed-slider', 'speed-output', value => Number(value).toFixed(1)],
      ['force-slider', 'force-output', value => Number(value).toFixed(2)],
      ['prey-speed-slider', 'prey-speed-output', value => Number(value).toFixed(1)],
      ['prey-force-slider', 'prey-force-output', value => Number(value).toFixed(2)],
      ['vision-slider', 'vision-output', value => `${value} px`],
      ['sim-speed-slider', 'sim-speed-output', value => `${value}×`],
    ];
    for (const [inputId, outputId, format] of rangePairs) {
      byId(inputId).addEventListener('input', event => {
        byId(outputId).textContent = format(event.target.value);
        readControls();
        applyParameters();
      });
    }
    for (const id of ['behavior-select', 'scenario-select']) {
      byId(id).addEventListener('change', () => { readControls(); reset(); });
    }
    for (const id of ['vectors-toggle', 'prediction-toggle', 'trails-toggle', 'vision-toggle']) {
      byId(id).addEventListener('change', readControls);
    }
    byId('pause-button').addEventListener('click', () => { state.paused = true; });
    byId('resume-button').addEventListener('click', () => { state.paused = false; });
    byId('step-button').addEventListener('click', () => { state.paused = true; state.stepRequested = true; });
    byId('reset-button').addEventListener('click', reset);
    byId('export-button').addEventListener('click', exportCsv);
  }

  function applyParameters() {
    for (const system of state.systems) {
      system.agent.maxSpeed = state.maxSpeed;
      system.agent.baseMaxSpeed = state.maxSpeed;
      system.agent.maxForce = state.maxForce;
      const targets = system.targets.length ? system.targets : [system.target];
      for (const target of targets) {
        target.visionRadius = state.visionRadius;
        if (target instanceof BouncingBall) continue;
        target.maxSpeed = Math.max(target.vel.mag() + 0.1, state.preySpeed);
        target.baseMaxSpeed = target.maxSpeed;
        target.maxForce = state.preyForce;
      }
    }
  }

  function tickSystem(system) {
    const behavior = system.behavior;
    const targets = system.targets.length ? system.targets : [system.target];
    const target = system.targets.length ? closestTargetTo(system.agent, system.targets) : system.target;
    if (state.scenario === 'chase') {
      const force = system.agent.steer('pursuit', target, state.predictionFrames);
      system.agent.applyForce(force);
      system.agent.applyForce(system.agent.boundaries(45));
      system.agent.update();
      target.update([system.agent], { visionMode: 'radius', predictionFrames: state.predictionFrames });
      wrapToroidal(system.agent);
      wrapToroidal(target);
    } else {
      const force = system.agent.steer(behavior, target, state.predictionFrames);
      system.agent.applyForce(force);
      system.agent.update();
      if (system.bounds) wrapInPane(system.agent, system.bounds);
      else wrapToroidal(system.agent);
      for (const item of targets) {
        item.update([], { idle: true });
        if (item instanceof BouncingBall) continue;
        if (system.bounds) wrapInPane(item, system.bounds);
        else wrapToroidal(item);
      }
    }

    const distance = p5.Vector.dist(system.agent.pos, target.pos);
    system.totalDistance += distance;
    system.samples++;
    if (distance < system.agent.r + target.r) {
      system.captures++;
      system.lastCaptureFrame = state.frame;
      const anchor = target.spawnAnchor || { x: canvasWidth * 0.72, y: canvasHeight * 0.35, vx: 1.5, vy: 0.7 };
      target.pos.set(anchor.x, anchor.y);
      target.vel.set(anchor.vx, anchor.vy);
    }
    state.history.push({ frame: state.frame, label: system.label, behavior, distance: distance.toFixed(4), captures: system.captures });
  }

  function wrapInPane(entity, bounds) {
    let wrapped = false;
    if (entity.pos.x > bounds.right + entity.r) { entity.pos.x = bounds.left - entity.r; wrapped = true; }
    else if (entity.pos.x < bounds.left - entity.r) { entity.pos.x = bounds.right + entity.r; wrapped = true; }
    if (entity.pos.y > canvasHeight + entity.r) { entity.pos.y = -entity.r; wrapped = true; }
    else if (entity.pos.y < -entity.r) { entity.pos.y = canvasHeight + entity.r; wrapped = true; }
    if (wrapped && entity.trail) entity.trail.length = 0;
  }

  function wrapToroidal(entity) {
    const previousX = entity.pos.x, previousY = entity.pos.y;
    entity.edges();
    if (Math.abs(entity.pos.x - previousX) > canvasWidth / 2 || Math.abs(entity.pos.y - previousY) > canvasHeight / 2) {
      if (entity.trail) entity.trail.length = 0;
    }
  }

  function tick() {
    state.frame++;
    state.systems.forEach(tickSystem);
    const selected = state.systems[state.selectedIndex] || state.systems[0];
    if (selected) {
      const closest = selected.targets.length ? closestTargetTo(selected.agent, selected.targets) : selected.target;
      state.distanceTotal += p5.Vector.dist(selected.agent.pos, closest.pos);
      state.distanceSamples++;
      state.captures = state.systems.reduce((sum, item) => sum + item.captures, 0);
      const latest = state.systems.map(item => item.lastCaptureFrame).filter(Number.isFinite);
      state.lastCaptureFrame = latest.length ? Math.max(...latest) : null;
    }
  }

  function render(fps) {
    PursuitLabRenderer.render(state, canvasWidth, canvasHeight);
    updateMetrics(fps);
  }

  function updateMetrics(fps = frameRate()) {
    byId('fps-value').textContent = Number.isFinite(fps) ? Math.round(fps) : '—';
    byId('frame-value').textContent = state.frame;
    byId('capture-value').textContent = state.captures;
    const system = state.systems[state.selectedIndex] || state.systems[0];
    const target = system && (system.targets.length ? closestTargetTo(system.agent, system.targets) : system.target);
    const distance = system && target ? p5.Vector.dist(system.agent.pos, target.pos) : null;
    byId('distance-value').textContent = distance === null ? '—' : `${distance.toFixed(1)} px`;
    byId('prediction-value').textContent = `${state.predictionFrames} frames`;
    byId('mean-distance').textContent = state.distanceSamples ? `${(state.distanceTotal / state.distanceSamples).toFixed(1)} px` : '—';
    byId('capture-time').textContent = state.lastCaptureFrame === null ? '—' : `${state.lastCaptureFrame} frames`;
    byId('selected-agent').textContent = system ? `Agent : ${system.label}` : 'Agent : —';
  }

  function selectAt(x, y) {
    let nearestIndex = -1, best = Infinity;
    state.systems.forEach((system, index) => {
      const d = p5.Vector.dist(system.agent.pos, createVector(x, y));
      if (d < Math.max(25, system.agent.r * 2) && d < best) { nearestIndex = index; best = d; }
    });
    if (nearestIndex >= 0) { state.selectedIndex = nearestIndex; updateMetrics(); }
  }

  function exportCsv() {
    const rows = ['frame,agent,behavior,distance,captures', ...state.history.map(row =>
      `${row.frame},${row.label},${row.behavior},${row.distance},${row.captures}`)];
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = 'pursuit-evade-experiment.csv'; link.click();
    URL.revokeObjectURL(link.href);
  }

  function init() { dimensions(); bindControls(); readControls(); reset(); }
  function drawFrame(fps) {
    if (!state.paused) for (let i = 0; i < state.simSpeed; i++) tick();
    else if (state.stepRequested) { tick(); state.stepRequested = false; }
    render(fps);
  }
  function resize() { const size = dimensions(); resizeCanvas(size.width, size.height); reset(); }
  function mousePressed(x, y) { selectAt(x, y); }

  return { init, reset, drawFrame, resize, mousePressed, get state() { return state; } };
})();
