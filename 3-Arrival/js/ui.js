// DOM bindings and validated settings. The simulation stays in Game.
const $ = id => document.getElementById(id);

const UI = {
  sliders: {},

  init() {
    const ids = ['slow', 'stop', 'speed', 'force', 'simSpeed', 'agentCount', 'spacing', 'density'];
    for (const id of ids) this.sliders[id] = $(id);

    const labels = {
      slow: ['slowVal', value => `${Math.round(value)} px`],
      stop: ['stopVal', value => `${Math.round(value)} px`],
      speed: ['speedVal', value => Number(value).toFixed(1)],
      force: ['forceVal', value => Number(value).toFixed(2)],
      simSpeed: ['simSpeedVal', value => `${Number(value).toFixed(2)}×`],
      agentCount: ['agentCountVal', value => `${Math.round(value)}`],
      spacing: ['spacingVal', value => `${Math.round(value)} px`],
      density: ['densityVal', value => `${Math.round(value)} px`]
    };

    for (const [key, slider] of Object.entries(this.sliders)) {
      if (!slider) continue;
      const [labelId, format] = labels[key];
      const update = () => {
        if (key === 'slow' && this.sliders.stop) {
          this.sliders.stop.max = String(Math.max(0, Number(slider.value) - 1));
          if (Number(this.sliders.stop.value) >= Number(slider.value)) {
            this.sliders.stop.value = String(Math.max(0, Number(slider.value) - 1));
          }
        }
        const label = $(labelId);
        if (label) label.textContent = format(slider.value);
        if (key === 'agentCount') Game.syncAgentCount();
        if (key === 'density' && Game.settings.mode === 'text') this.rebuildText();
        Game.applySettings();
      };
      slider.addEventListener('input', update);
      update();
    }

    document.querySelectorAll('.mode-btn').forEach(button => {
      button.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        Game.setMode(button.dataset.mode);
      });
    });

    this.bind('addBtn', 'click', () => Game.addVehicle());
    this.bind('clearBtn', 'click', () => Game.clearAll());
    this.bind('pauseBtn', 'click', () => Game.togglePause(true));
    this.bind('resumeBtn', 'click', () => Game.togglePause(false));
    this.bind('stepBtn', 'click', () => Game.stepOnce());
    this.bind('resetBtn', 'click', () => Game.reset());
    this.bind('exportBtn', 'click', () => Game.exportCsv());
    this.bind('compareBtn', 'click', event => {
      Game.toggleComparison();
      event.currentTarget.setAttribute('aria-pressed', String(Game.comparisonActive));
      event.currentTarget.textContent = Game.comparisonActive ? 'Quitter la comparaison' : 'Comparer Seek / Arrive';
    });
    this.bind('scenario', 'change', event => Game.reset(Number(event.target.value) || 1337));
    this.bind('formation', 'change', event => { Game.settings.formation = event.target.value; });
    this.bind('difficulty', 'change', event => {
      const presets = { easy: [6, 4, 36], normal: [12, 6, 28], hard: [22, 8, 18] };
      const [count, speed, spacing] = presets[event.target.value] || presets.normal;
      if (this.sliders.agentCount) this.sliders.agentCount.value = String(count);
      if (this.sliders.speed) this.sliders.speed.value = String(speed);
      if (this.sliders.spacing) this.sliders.spacing.value = String(spacing);
      for (const [id, value] of [['agentCountVal', count], ['speedVal', speed.toFixed(1)], ['spacingVal', `${spacing} px`]]) {
        const label = $(id); if (label) label.textContent = value;
      }
      Game.syncAgentCount();
      Game.applySettings();
    });
    this.bind('palette', 'change', event => { Game.settings.palette = event.target.value; this.applyPalette(); });
    this.bind('selectedAgent', 'input', event => {
      Game.selectedAgentIndex = Math.max(0, Math.min(Game.vehicles.length - 1, Number(event.target.value) || 0));
    });

    this.bind('textInput', 'input', event => {
      event.target.value = event.target.value.toUpperCase().slice(0, 12);
      if (Game.settings.mode === 'text') this.rebuildText();
    });

    this.bind('showTrails', 'change', event => Game.settings.showTrails = event.target.checked);
    this.bind('showSlowRadius', 'change', event => Game.settings.showSlowRadius = event.target.checked);
    this.bind('showStopRadius', 'change', event => Game.settings.showStopRadius = event.target.checked);
    this.bind('showVelocity', 'change', event => Game.settings.showVelocity = event.target.checked);
    this.bind('showSteering', 'change', event => Game.settings.showSteering = event.target.checked);
  },

  bind(id, eventName, handler) {
    const element = $(id);
    if (element) element.addEventListener(eventName, handler);
  },

  rebuildText() {
    const input = $('textInput');
    Game.rebuildTextVehicles(input ? input.value || 'MIAGE' : 'MIAGE');
  },

  applyPalette() {
    const palettes = {
      aurora: [188, 212, 244, 276, 326],
      ember: [8, 24, 42, 4, 350],
      ocean: [188, 198, 210, 222, 236]
    };
    const hues = palettes[Game.settings.palette] || palettes.aurora;
    Game.vehicles.forEach((vehicle, index) => {
      const hue = hues[index % hues.length];
      vehicle.color = `hsl(${hue}, 78%, 66%)`;
      vehicle.trailColor = `hsla(${hue}, 78%, 66%, 0.35)`;
    });
  },

  getSettings() {
    const read = (key, fallback) => {
      const value = Number(this.sliders[key] && this.sliders[key].value);
      return Number.isFinite(value) ? value : fallback;
    };
    const slowRadius = Math.max(1, read('slow', 150));
    return {
      slowRadius,
      stopDistance: Math.max(0, Math.min(slowRadius - 1, read('stop', 0))),
      maxSpeed: Math.max(0.1, read('speed', 6)),
      maxForce: Math.max(0.001, read('force', 0.4)),
      simulationSpeed: Math.max(0.1, Math.min(3, read('simSpeed', 1))),
      agentCount: Math.max(1, Math.min(600, Math.round(read('agentCount', 20)))),
      formationSpacing: Math.max(8, Math.min(160, read('spacing', 24))),
      textDensity: Math.max(3, Math.min(24, read('density', 8)))
    };
  },

  updateStats(vehicles, avgSpeed, targetDist, fps, formationError, time) {
    const values = {
      count: vehicles.length,
      avgSpeed: avgSpeed.toFixed(2),
      targetDist: Math.round(targetDist),
      fps,
      stability: Number.isFinite(formationError) ? `${formationError.toFixed(1)} px` : '—',
      simTime: `${time.toFixed(1)} s`,
      simState: Game.paused ? 'PAUSED' : 'RUNNING'
    };
    for (const [id, value] of Object.entries(values)) {
      const node = $(id);
      if (node) node.textContent = value;
    }
    const seekDistance = $('seekDistance');
    const arriveDistance = $('arriveDistance');
    const seekGroup = Game.comparisonGroups.find(group => group.behavior === 'seek');
    const arriveGroup = Game.comparisonGroups.find(group => group.behavior === 'arrive');
    if (seekDistance) seekDistance.textContent = seekGroup ? `${seekGroup.distance.toFixed(1)} px` : '—';
    if (arriveDistance) arriveDistance.textContent = arriveGroup ? `${arriveGroup.distance.toFixed(1)} px` : '—';

    const selector = $('selectedAgent');
    if (selector) {
      selector.max = String(Math.max(0, vehicles.length - 1));
      Game.selectedAgentIndex = Math.max(0, Math.min(Game.selectedAgentIndex, vehicles.length - 1));
      selector.value = String(Game.selectedAgentIndex);
    }
    const indexLabel = $('selectedAgentVal');
    if (indexLabel) indexLabel.textContent = vehicles.length ? String(Game.selectedAgentIndex + 1) : '—';
    const diagnostic = Game.diagnosticScratch;
    const selected = vehicles[Game.selectedAgentIndex];
    if (selected) selected.copySteeringDiagnosticsTo(diagnostic);
    const valid = !!selected && diagnostic.valid;
    const formatVector = vector => `(${vector.x.toFixed(2)}, ${vector.y.toFixed(2)})`;
    const distanceNode = $('diagnosticDistance');
    const desiredSpeedNode = $('desiredSpeed');
    const effectiveSpeedNode = $('effectiveSpeed');
    const currentVectorNode = $('currentVector');
    const desiredVectorNode = $('desiredVector');
    const steeringVectorNode = $('steeringVector');
    if (distanceNode) distanceNode.textContent = valid ? `${diagnostic.distance.toFixed(1)} px` : '—';
    if (desiredSpeedNode) desiredSpeedNode.textContent = valid ? diagnostic.desiredSpeed.toFixed(2) : '—';
    if (effectiveSpeedNode) effectiveSpeedNode.textContent = valid ? diagnostic.effectiveSpeed.toFixed(2) : '—';
    if (currentVectorNode) currentVectorNode.textContent = valid ? formatVector(diagnostic.currentVelocity) : '—';
    if (desiredVectorNode) desiredVectorNode.textContent = valid ? formatVector(diagnostic.desiredVelocity) : '—';
    if (steeringVectorNode) steeringVectorNode.textContent = valid ? formatVector(diagnostic.steering) : '—';
  }
};
