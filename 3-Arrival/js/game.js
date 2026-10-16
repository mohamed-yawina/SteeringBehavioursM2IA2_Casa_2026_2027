// ============================================
// État global + boucle
// ============================================

const Game = {
  canvas: null,
  ctx: null,

  vehicles: [],
  target: null,

  settings: {
    showTrails: true,
    showSlowRadius: true,
    showStopRadius: false,
    showVelocity: true,
    showSteering: true,
    mode: 'arrive',
    simulationSpeed: 1,
    formation: 'chain',
    formationSpacing: 20,
    textDensity: 8,
    palette: 'aurora'
  },

  lastTime: 0,
  frames: 0,
  lastFpsUpdate: 0,
  currentFps: 60,

  time: 0,
  paused: false,
  accumulator: 0,
  fixedStepMs: 1000 / 60,
  simulationSeed: 1,
  randomState: 1,
  tick: 0,
  metrics: [],
  lastMetricTick: -1,
  comparison: false,
  comparisonActive: false,
  comparisonGroups: [],
  stepRequested: false,
  selectedAgentIndex: 0,
  diagnosticScratch: {
    behavior: '', valid: false, distance: 0, desiredSpeed: 0, effectiveSpeed: 0,
    position: { x: 0, y: 0 }, currentVelocity: { x: 0, y: 0 },
    desiredVelocity: { x: 0, y: 0 }, steering: { x: 0, y: 0 }
  },

  init(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');

    this.resize();
    window.addEventListener('resize', () => this.resize());

    this.settings.mode = document.body.dataset.mode || 'arrive';
    this.simulationSeed = Number(document.body.dataset.seed) || 1337;
    this.randomState = this.simulationSeed >>> 0;
    this.mouseX = this.width / 2;
    this.mouseY = this.height / 2;
    this.paused = false;
    this.accumulator = 0;

    // Crée la cible
    this.target = new Target(this.width / 2, this.height / 2);

    this.setMode(this.settings.mode);

    requestAnimationFrame(t => this.loop(t));
  },

  random() {
    // Mulberry32: même seed => mêmes conditions initiales et mêmes scénarios.
    let t = this.randomState += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  },

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    this.canvas.width = Math.round(rect.width * dpr);
    this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = rect.width;
    this.height = rect.height;
  },

  // ============================================
  // MODES
  // ============================================

  setMode(mode) {
    if (!['arrive', 'seek', 'snake', 'text'].includes(mode)) return;
    if (this.comparisonActive) this.toggleComparison(false);
    this.settings.mode = mode;
    this.randomState = this.simulationSeed;
    this.vehicles = [];
    this.selectedAgentIndex = 0;
    this.diagnosticScratch.valid = false;
    ParticleSystem.clear();
    this.metrics = [];
    this.tick = 0;
    this.lastMetricTick = -1;

    switch (mode) {
      case 'arrive':
      case 'seek':
        this.buildArriveMode();
        break;
      case 'snake':
        this.buildSnakeMode();
        break;
      case 'text':
        const text = $('textInput').value.toUpperCase().substring(0, 12) || 'MIAGE';
        this.rebuildTextVehicles(text);
        break;
    }
  },

  buildArriveMode() {
    this.vehicles = [];
    const settings = UI.getSettings();
    const count = settings.agentCount;
    for (let i = 0; i < count; i++) {
      const hue = (i * 18) % 360;
      const v = new Vehicle(
        this.random() * this.width,
        this.random() * this.height,
        {
          maxSpeed: settings.maxSpeed,
          maxForce: settings.maxForce,
          size: 10 + this.random() * 8,
          color: `hsl(${hue}, 75%, 65%)`,
          trailColor: `hsla(${hue}, 75%, 65%, 0.3)`,
          maxTrailLength: 40
        }
      );
      this.vehicles.push(v);
    }
  },

  buildSnakeMode() {
    this.vehicles = [];
    const startX = this.width / 2;
    const startY = this.height / 2;

    const settings = UI.getSettings();
    for (let i = 0; i < settings.agentCount; i++) {
      const v = new Trailer(startX - i * settings.formationSpacing, startY, i, {
        maxSpeed: settings.maxSpeed,
        maxForce: settings.maxForce,
        size: 14
      });
      this.vehicles.push(v);
    }
  },

  rebuildTextVehicles(text) {
    const existingVehicles = this.settings.mode === 'text' ? this.vehicles.slice() : [];
    const settings = UI.getSettings();
    const fontSize = Math.min(this.width, this.height) * 0.25;
    const points = this.getTextPoints(text, fontSize, settings.textDensity);

    // Crée un TextVehicle pour chaque point (max 200)
    const maxVehicles = Math.min(points.length, settings.agentCount, 600);
    this.vehicles = existingVehicles.slice(0, maxVehicles);
    for (let i = 0; i < maxVehicles; i++) {
      const p = points[i];
      let v = this.vehicles[i];
      if (!v) {
        v = new TextVehicle(this.random() * this.width, this.random() * this.height, p, i, {
          maxSpeed: settings.maxSpeed,
          maxForce: settings.maxForce,
          size: 6 + this.random() * 4
        });
        this.vehicles.push(v);
      }
      v.setTargetPoint(p);
      v.index = i;
      v.resetSteeringDiagnostics();
      v.appliedSteering = null;
    }
    UI.applyPalette();
  },

  getTextPoints(text, fontSize, step = 8) {
    // Utilise l'API Canvas pour obtenir les points du texte
    const ctx = this.ctx;

    // Dessine le texte sur un canvas temporaire
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = this.width;
    tempCanvas.height = this.height;
    const tempCtx = tempCanvas.getContext('2d');

    tempCtx.fillStyle = 'white';
    tempCtx.font = `bold ${fontSize}px Arial`;
    tempCtx.textAlign = 'center';
    tempCtx.textBaseline = 'middle';
    tempCtx.fillText(text, this.width / 2, this.height / 2);

    // Récupère les pixels
    const imageData = tempCtx.getImageData(0, 0, this.width, this.height);
    const data = imageData.data;

    const points = [];
    step = Math.max(3, Math.min(24, Math.round(Number(step) || 8)));

    for (let y = 0; y < this.height; y += step) {
      for (let x = 0; x < this.width; x += step) {
        const idx = (y * this.width + x) * 4;
        const alpha = data[idx + 3];
        if (alpha > 128) {
          points.push({ x, y });
        }
      }
    }

    return points;
  },

  addVehicle() {
    const settings = UI.getSettings();
    if (this.settings.mode === 'snake') {
      const v = new Trailer(0, 0, this.vehicles.length, {
        maxSpeed: settings.maxSpeed,
        maxForce: settings.maxForce,
        size: 14
      });
      v.pos.x = this.random() * this.width;
      v.pos.y = this.random() * this.height;
      this.vehicles.push(v);
    } else if (this.settings.mode === 'text') {
      // Ajoute un TextVehicle avec une cible au hasard
      const p = {
        x: this.random() * this.width,
        y: this.random() * this.height
      };
      const v = new TextVehicle(
        this.random() * this.width,
        this.random() * this.height,
        p,
        this.vehicles.length
      );
      this.vehicles.push(v);
    } else {
      const hue = this.random() * 360;
      const v = new Vehicle(
        this.random() * this.width,
        this.random() * this.height,
        {
          maxSpeed: UI.getSettings().maxSpeed,
          maxForce: UI.getSettings().maxForce,
          size: 10 + this.random() * 8,
          color: `hsl(${hue}, 75%, 65%)`,
          trailColor: `hsla(${hue}, 75%, 65%, 0.3)`
        }
      );
      this.vehicles.push(v);
    }
  },

  clearAll() {
    this.vehicles = [];
    this.selectedAgentIndex = 0;
    ParticleSystem.clear();
  },

  syncAgentCount() {
    if (!this.canvas) return;
    const desiredCount = UI.getSettings().agentCount;
    if (this.settings.mode === 'text') {
      const input = $('textInput');
      this.rebuildTextVehicles(input ? input.value || 'MIAGE' : 'MIAGE');
      return;
    }
    while (this.vehicles.length > desiredCount) this.vehicles.pop();
    while (this.vehicles.length < desiredCount) this.addVehicle();
    this.selectedAgentIndex = Math.min(this.selectedAgentIndex, this.vehicles.length - 1);
    if (this.comparisonActive) this.toggleComparison(true);
  },

  applySettings() {
    const s = UI.getSettings();
    for (const v of this.vehicles) {
      v.maxSpeed = s.maxSpeed;
      v.maxForce = s.maxForce;
    }
  },

  reset(seed = this.simulationSeed) {
    const restoreComparison = this.comparisonActive;
    this.simulationSeed = Number(seed) >>> 0 || 1337;
    this.randomState = this.simulationSeed;
    this.accumulator = 0;
    this.time = 0;
    this.tick = 0;
    this.metrics = [];
    this.lastMetricTick = -1;
    this.paused = false;
    this.mouseX = this.width / 2;
    this.mouseY = this.height / 2;
    this.target = new Target(this.width / 2, this.height / 2);
    this.setMode(this.settings.mode);
    if (restoreComparison) this.toggleComparison(true);
  },

  stepOnce() {
    if (!this.paused) return;
    this.update();
    this.draw();
    this.updateMeasurements();
  },

  measureFormationError() {
    if (this.settings.mode !== 'snake' || this.vehicles.length < 2) return NaN;
    let total = 0;
    for (let i = 1; i < this.vehicles.length; i++) {
      const goal = this.formationPoint(i);
      total += Math.hypot(this.vehicles[i].pos.x - goal.x, this.vehicles[i].pos.y - goal.y);
    }
    return total / (this.vehicles.length - 1);
  },

  formationPoint(index) {
    const leader = this.vehicles[0];
    const speed = Math.hypot(leader.vel.x, leader.vel.y);
    const ux = speed > 0.01 ? leader.vel.x / speed : 1;
    const uy = speed > 0.01 ? leader.vel.y / speed : 0;
    const back = { x: -ux, y: -uy };
    const side = { x: -uy, y: ux };
    const spacing = UI.getSettings().formationSpacing;
    let row = index;
    let lateral = 0;
    if (this.settings.formation === 'line') {
      row = 0;
      lateral = index % 2 ? Math.ceil(index / 2) : -Math.ceil(index / 2);
    } else if (this.settings.formation === 'vee') {
      row = Math.ceil(index / 2);
      lateral = index % 2 ? -row : row;
    } else if (this.settings.formation === 'arc') {
      const angle = (index / Math.max(1, this.vehicles.length - 1) - 0.5) * Math.PI;
      return {
        x: leader.pos.x + (back.x * Math.cos(angle) + side.x * Math.sin(angle)) * spacing * 2,
        y: leader.pos.y + (back.y * Math.cos(angle) + side.y * Math.sin(angle)) * spacing * 2
      };
    }
    return {
      x: leader.pos.x + back.x * row * spacing + side.x * lateral * spacing,
      y: leader.pos.y + back.y * row * spacing + side.y * lateral * spacing
    };
  },

  updateMeasurements() {
    const comparisonArrive = this.comparisonGroups.find(group => group.behavior === 'arrive');
    const measuredVehicles = this.comparisonActive && comparisonArrive ? comparisonArrive.vehicles : this.vehicles;
    let totalSpeed = 0;
    if (this.comparisonActive) {
      for (const group of this.comparisonGroups) for (const vehicle of group.vehicles) totalSpeed += Math.hypot(vehicle.vel.x, vehicle.vel.y);
    } else {
      for (const vehicle of measuredVehicles) totalSpeed += Math.hypot(vehicle.vel.x, vehicle.vel.y);
    }
    const measuredCount = this.comparisonActive ? this.comparisonGroups.reduce((sum, group) => sum + group.vehicles.length, 0) : measuredVehicles.length;
    const averageSpeed = measuredCount ? totalSpeed / measuredCount : 0;
    const distance = this.comparisonActive && comparisonArrive
      ? comparisonArrive.distance
      : this.vehicles.length
      ? Math.hypot(this.vehicles[0].pos.x - this.target.pos.x, this.vehicles[0].pos.y - this.target.pos.y)
      : 0;
    UI.updateStats(measuredVehicles, averageSpeed, distance, this.currentFps, this.measureFormationError(), this.time);
    if (this.tick > 0 && this.tick % 6 === 0 && this.tick !== this.lastMetricTick) {
      const seekDistance = this.comparisonGroups.find(group => group.behavior === 'seek')?.distance;
      const arriveDistance = this.comparisonGroups.find(group => group.behavior === 'arrive')?.distance;
      this.metrics.push({ time: this.time, distance, averageSpeed, formationError: this.measureFormationError(), seekDistance, arriveDistance });
      if (this.metrics.length > 3600) this.metrics.shift();
      this.lastMetricTick = this.tick;
    }
  },

  exportCsv() {
    const rows = [['time_seconds', 'distance_pixels', 'average_speed_pixels_per_tick', 'formation_error_pixels', 'seek_distance_pixels', 'arrive_distance_pixels']];
    for (const sample of this.metrics) rows.push([sample.time, sample.distance, sample.averageSpeed, Number.isFinite(sample.formationError) ? sample.formationError : '', sample.seekDistance ?? '', sample.arriveDistance ?? '']);
    const csv = rows.map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `arrival-${this.simulationSeed}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  },

  toggleComparison(force) {
    this.comparisonActive = typeof force === 'boolean' ? force : !this.comparisonActive;
    if (!this.comparisonActive) {
      this.comparisonGroups = [];
      return;
    }
    this.randomState = this.simulationSeed;
    const settings = UI.getSettings();
    const initial = Array.from({ length: settings.agentCount }, () => ({
      x: this.random() * this.width / 2,
      y: this.random() * this.height
    }));
    this.comparisonGroups = ['seek', 'arrive'].map(behavior => ({
      behavior,
      vehicles: initial.map((position, index) => new Vehicle(position.x, position.y, {
        maxSpeed: settings.maxSpeed,
        maxForce: settings.maxForce,
        size: 10,
        color: behavior === 'seek' ? '#5ec8ff' : '#72dfd0',
        trailColor: behavior === 'seek' ? 'rgba(94,200,255,.35)' : 'rgba(114,223,208,.35)'
      })),
      distance: 0
    }));
    const target = {
      x: Math.max(0, Math.min(this.width / 2, (this.mouseX ?? this.width / 2) / this.width * (this.width / 2))),
      y: this.mouseY ?? this.height / 2
    };
    for (const group of this.comparisonGroups) {
      group.distance = group.vehicles.length
        ? Math.min(...group.vehicles.map(vehicle => Math.hypot(vehicle.pos.x - target.x, vehicle.pos.y - target.y)))
        : 0;
    }
    this.metrics = [];
    this.tick = 0;
    this.lastMetricTick = -1;
  },

  updateComparison(settings) {
    const halfWidth = this.width / 2;
    const target = { x: Math.max(0, Math.min(halfWidth, (this.mouseX ?? this.width / 2) / this.width * halfWidth)), y: this.mouseY ?? this.height / 2 };
    for (const group of this.comparisonGroups) {
      for (const vehicle of group.vehicles) {
        vehicle.maxSpeed = settings.maxSpeed;
        vehicle.maxForce = settings.maxForce;
        const force = group.behavior === 'seek'
          ? vehicle.seek(target)
          : vehicle.arrive(target, settings.slowRadius, settings.stopDistance);
        vehicle.lastSteering = force;
        this.recordAppliedSteering(vehicle, force);
        vehicle.applyForce(force);
        vehicle.update();
      }
      group.distance = group.vehicles.length
        ? Math.min(...group.vehicles.map(vehicle => Math.hypot(vehicle.pos.x - target.x, vehicle.pos.y - target.y)))
        : 0;
    }
  },

  drawComparison() {
    const ctx = this.ctx;
    const inspected = this.comparisonGroups.flatMap(g => g.vehicles)[this.selectedAgentIndex];
    const halfWidth = this.width / 2;
    const targetX = Math.max(0, Math.min(halfWidth, (this.mouseX ?? this.width / 2) / this.width * halfWidth));
    const targetY = this.mouseY ?? this.height / 2;
    const settings = UI.getSettings();
    ctx.fillStyle = '#07121c';
    ctx.fillRect(0, 0, this.width, this.height);
    this.comparisonGroups.forEach((group, index) => {
      const offset = index * halfWidth;
      ctx.save();
      ctx.beginPath(); ctx.rect(offset, 0, halfWidth, this.height); ctx.clip();
      ctx.translate(offset, 0);
      ctx.fillStyle = '#091722'; ctx.fillRect(0, 0, halfWidth, this.height);
      ctx.strokeStyle = 'rgba(94,200,255,.045)'; ctx.lineWidth = 1;
      for (let x = 0; x < halfWidth; x += 50) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, this.height); ctx.stroke(); }
      for (let y = 0; y < this.height; y += 50) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(halfWidth, y); ctx.stroke(); }
      ctx.strokeStyle = 'rgba(255,209,102,.28)'; ctx.setLineDash([7, 6]); ctx.beginPath(); ctx.arc(targetX, targetY, settings.slowRadius, 0, Math.PI * 2); ctx.stroke(); ctx.setLineDash([]);
      for (const vehicle of group.vehicles) {
        vehicle.show(ctx, { showTrail: this.settings.showTrails, showVelocity: false });
        this.drawAgentSteering(vehicle, vehicle === inspected);
      }
      ctx.fillStyle = '#ffd166'; ctx.beginPath(); ctx.arc(targetX, targetY, 6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#e6f0f7'; ctx.font = '700 13px system-ui'; ctx.fillText(group.behavior === 'seek' ? 'SEEK' : 'ARRIVE', 14, 22);
      ctx.font = '11px system-ui'; ctx.fillStyle = '#9aacb8'; ctx.fillText(`distance ${Number.isFinite(group.distance) ? group.distance.toFixed(1) : '—'} px`, 14, 40);
      ctx.restore();
    });
    ctx.strokeStyle = '#34505e'; ctx.beginPath(); ctx.moveTo(halfWidth, 0); ctx.lineTo(halfWidth, this.height); ctx.stroke();
  },

  // ============================================
  // UPDATE
  // ============================================

  update() {
    this.time += this.fixedStepMs / 1000;
    this.tick++;
    const s = UI.getSettings();
    this.applySettings();

    // Update cible (suit la souris)
    this.target.update(this.mouseX ?? this.width / 2, this.mouseY ?? this.height / 2);

    if (this.comparisonActive) {
      this.updateComparison(s);
      ParticleSystem.update();
      return;
    }

    // Update véhicules selon le mode
    if (this.settings.mode === 'arrive' || this.settings.mode === 'seek') {
      for (const v of this.vehicles) {
        const force = this.settings.mode === 'seek'
          ? v.seek(this.target.pos)
          : v.arrive(this.target.pos, s.slowRadius, s.stopDistance);
        v.lastSteering = force.copy();
        const bounds = { x: 0, y: 0, w: this.width, h: this.height };
        const boundaryForce = v.boundaries(bounds, 60);
        const totalForce = force.copy().add(boundaryForce).limit(v.maxForce);
        this.recordAppliedSteering(v, totalForce);
        v.applyForce(totalForce);

        // Physique héritée
        v.update();
      }

    } else if (this.settings.mode === 'snake') {
      // Le premier véhicule suit la cible
      if (this.vehicles.length > 0) {
        const head = this.vehicles[0];
        const force = head.arrive(this.target.pos, s.slowRadius, s.stopDistance);
        head.lastSteering = force;
        head.applyForce(force);
        head.update();
      }

      // Les suiveurs visent des emplacements relatifs au leader, sans déplacement téléporté.
      for (let i = 1; i < this.vehicles.length; i++) {
        const v = this.vehicles[i];
        if (this.settings.formation === 'chain') {
          v.update(this.vehicles[i - 1], Math.max(35, s.formationSpacing * 2), s.formationSpacing);
        } else {
          v.update({ pos: this.formationPoint(i) }, Math.max(35, s.formationSpacing), 2);
        }
      }

    } else if (this.settings.mode === 'text') {
      for (const v of this.vehicles) {
        // ✅ Utilise arrive() hérité de Vehicle
        v.update(s.slowRadius, s.stopDistance);
      }
    }

    // Other modes keep their existing single behavior, without added boundaries.
    if (this.settings.mode !== 'arrive' && this.settings.mode !== 'seek') {
      for (const v of this.vehicles) this.recordAppliedSteering(v, v.lastSteering);
    }

    // Particules
    ParticleSystem.update();
  },

  recordAppliedSteering(vehicle, totalForce) {
    const d = vehicle.copySteeringDiagnosticsTo({});
    vehicle.appliedSteering = d.valid && totalForce ? {
      origin: new p5.Vector(d.position.x, d.position.y),
      velocity: new p5.Vector(d.currentVelocity.x, d.currentVelocity.y),
      desired: new p5.Vector(d.desiredVelocity.x, d.desiredVelocity.y),
      primary: new p5.Vector(d.steering.x, d.steering.y),
      total: totalForce.copy()
    } : null;
  },

  selectAgent(index) {
    const count = this.comparisonActive ? this.comparisonGroups.reduce((n, g) => n + g.vehicles.length, 0) : this.vehicles.length;
    this.selectedAgentIndex = Math.max(0, Math.min(count - 1, index));
    this.diagnosticScratch.valid = false;
  },

  drawAgentSteering(vehicle, selected) {
    const d = vehicle.appliedSteering;
    if (!d) return;
    if (this.settings.showVelocity) {
      this.drawDiagnosticVector(d.origin, d.velocity, '#ffffff', 6);
      if (selected) this.drawDiagnosticVector(d.origin, d.desired, '#ffd166', 6);
    }
    if (this.settings.showSteering) {
      this.drawDiagnosticVector(d.origin, d.total, '#ff6c9b', 45);
      if (selected) this.drawDiagnosticVector(d.origin, d.primary, '#72dfd0', 45);
    }
  },

  // ============================================
  // DRAW
  // ============================================

  draw() {
    const ctx = this.ctx;
    const s = UI.getSettings();
    if (this.comparisonActive) {
      this.drawComparison();
      return;
    }

    // Fond
    const grad = ctx.createLinearGradient(0, 0, 0, this.height);
    grad.addColorStop(0, '#0a1a2a');
    grad.addColorStop(1, '#060e18');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, this.width, this.height);

    // Grille
    ctx.strokeStyle = 'rgba(94, 200, 255, 0.05)';
    ctx.lineWidth = 1;
    for (let x = 0; x < this.width; x += 50) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, this.height);
      ctx.stroke();
    }
    for (let y = 0; y < this.height; y += 50) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(this.width, y);
      ctx.stroke();
    }

    // Cercle slowRadius
    if (this.settings.showSlowRadius) {
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.2)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([8, 6]);
      ctx.beginPath();
      ctx.arc(this.target.pos.x, this.target.pos.y, s.slowRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Cercle stopDistance
    if (this.settings.showStopRadius && s.stopDistance > 0) {
      ctx.strokeStyle = 'rgba(255, 101, 122, 0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(this.target.pos.x, this.target.pos.y, s.stopDistance, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ligne du snake
    if (this.settings.mode === 'snake' && this.vehicles.length > 1) {
      for (let i = 0; i < this.vehicles.length - 1; i++) {
        Trailer.drawLink(ctx, this.vehicles[i], this.vehicles[i + 1]);
      }
    }

    // Dessine les véhicules
    for (const v of this.vehicles) {
      v.show(ctx, {
        showTrail: this.settings.showTrails,
        showVelocity: false
      });
      this.drawAgentSteering(v, v === this.vehicles[this.selectedAgentIndex]);
    }

    // Cible
    this.target.show(ctx);

    // Particules
    ParticleSystem.draw(ctx);
  },

  drawDiagnosticVector(origin, vector, color, scale) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(origin.x, origin.y);
    ctx.lineTo(origin.x + vector.x * scale, origin.y + vector.y * scale);
    ctx.stroke();
  },

  // ============================================
  // BOUCLE
  // ============================================

  loop(now) {
    if (this.lastTime === 0) this.lastTime = now;
    const deltaTime = Math.min(50, now - this.lastTime);
    this.lastTime = now;

    this.frames++;
    if (this.lastFpsUpdate === 0) this.lastFpsUpdate = now;
    if (now - this.lastFpsUpdate > 500) {
      this.currentFps = Math.round(this.frames * 1000 / (now - this.lastFpsUpdate));
      this.frames = 0;
      this.lastFpsUpdate = now;
    }

    if (!this.paused) {
      this.accumulator += deltaTime * UI.getSettings().simulationSpeed;
      let steps = 0;
      while (this.accumulator + 1e-9 >= this.fixedStepMs && steps < 10) {
        this.update();
        this.accumulator -= this.fixedStepMs;
        steps++;
      }
      if (steps === 10) this.accumulator = 0;
    } else {
      this.accumulator = 0;
    }
    this.draw();
    this.updateMeasurements();

    requestAnimationFrame(t => this.loop(t));
  },

  handleMouseMove(x, y) {
    this.mouseX = x;
    this.mouseY = y;
  },

  handleClick(x, y, button) {
    if (button === 0) {
      this.addVehicle();
      ParticleSystem.spawn(x, y, '#5ec8ff', 8);
    }
  },

  togglePause(force) {
    this.paused = typeof force === 'boolean' ? force : !this.paused;
  }
};
