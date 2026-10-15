// ============================================
// État global + boucle
// ============================================

const FIXED_STEP_MS = 1000 / 60;
const MAX_SIMULATION_STEPS_PER_FRAME = 5;

const Game = {
  canvas: null,
  ctx: null,
  radarCanvas: null,
  radarCtx: null,

  airplanes: [],
  waypoints: [],
  weatherZones: [],

  atc: new ATC(),

  settings: {
    showTrails: true,
    showSeparation: true,
    showWaypoints: true,
    showWeather: true,
    showWanderDebug: false,
    mode: 'wander'
  },

  lastTime: null,
  accumulator: 0,
  fixedStepMs: FIXED_STEP_MS,
  maxSimulationStepsPerFrame: MAX_SIMULATION_STEPS_PER_FRAME,
  frames: 0,
  lastFpsUpdate: 0,
  currentFps: 60,

  time: 0,
  paused: false,

  init(canvas, radarCanvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.radarCanvas = radarCanvas;
    this.radarCtx = radarCanvas.getContext('2d');
    this.lastTime = null;
    this.accumulator = 0;

    this.resize();
    window.addEventListener('resize', () => this.resize());
    document.addEventListener('visibilitychange', () => {
      this.lastTime = null;
      this.accumulator = 0;
    });
    if (typeof ResizeObserver !== 'undefined') {
      this.resizeObserver = new ResizeObserver(() => this.resize());
      this.resizeObserver.observe(canvas);
      this.resizeObserver.observe(radarCanvas);
    }

    // Crée 6 avions
    for (let i = 0; i < 6; i++) this.addAirplane();

    // Crée 4 waypoints
    this.addDefaultWaypoints();

    // Crée 2 zones météo
    this.addWeather();
    this.addWeather();

    requestAnimationFrame(t => this.loop(t));
  },

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio;
    const dpr = Number.isFinite(ratio) && ratio > 0 ? Math.min(ratio, 2) : 1;
    const oldWidth = this.width;
    const oldHeight = this.height;
    const width = Number.isFinite(rect.width) ? Math.max(1, rect.width) : 1;
    const height = Number.isFinite(rect.height) ? Math.max(1, rect.height) : 1;

    // Les positions et historiques suivent la nouvelle taille du monde.
    // Vitesses, forces et rayons/distances de comportement restent en pixels.
    if ((width !== oldWidth || height !== oldHeight) && Number.isFinite(oldWidth) && oldWidth > 0 && Number.isFinite(oldHeight) && oldHeight > 0) {
      const scaleX = width / oldWidth;
      const scaleY = height / oldHeight;
      const resizePoint = point => {
        const scaledX = Number.isFinite(point.x) ? point.x * scaleX : width / 2;
        const scaledY = Number.isFinite(point.y) ? point.y * scaleY : height / 2;
        point.x = Math.max(0, Math.min(width, scaledX));
        point.y = Math.max(0, Math.min(height, scaledY));
      };
      const resizeEntity = entity => {
        resizePoint(entity.pos);
        for (const trailPoint of entity.trail || []) resizePoint(trailPoint);
        if (entity.wanderDebug) {
          // Preserve the previous-step diagram by an affine transformation.
          const d = entity.wanderDebug;
          for (const point of [d.origin, d.center, d.target]) {
            point.x *= scaleX; point.y *= scaleY;
          }
          d.radiusX *= scaleX; d.radiusY *= scaleY;
        }
      };

      this.airplanes.forEach(resizeEntity);
      this.waypoints.forEach(resizeEntity);
      this.weatherZones.forEach(resizeEntity);
      ParticleSystem.particles.forEach(resizeEntity);
    }

    if (this.canvas.width !== Math.max(1, Math.round(width * dpr))) this.canvas.width = Math.max(1, Math.round(width * dpr));
    if (this.canvas.height !== Math.max(1, Math.round(height * dpr))) this.canvas.height = Math.max(1, Math.round(height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = width;
    this.height = height;

    // Radar
    const radarRect = this.radarCanvas.getBoundingClientRect();
    const radarWidth = Number.isFinite(radarRect.width) ? Math.max(1, radarRect.width) : 1;
    const radarHeight = Number.isFinite(radarRect.height) ? Math.max(1, radarRect.height) : 1;
    if (this.radarCanvas.width !== Math.max(1, Math.round(radarWidth * dpr))) this.radarCanvas.width = Math.max(1, Math.round(radarWidth * dpr));
    if (this.radarCanvas.height !== Math.max(1, Math.round(radarHeight * dpr))) this.radarCanvas.height = Math.max(1, Math.round(radarHeight * dpr));
    this.radarCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.radarWidth = radarWidth;
    this.radarHeight = radarHeight;
  },

  addAirplane(x, y) {
    const s = UI.getSettings();

    x = this.initialCoordinate(x, this.width);
    y = this.initialCoordinate(y, this.height);

    const airplane = new Airplane(x, y, {
      maxSpeed: s.maxSpeed,
      maxForce: s.maxForce,
      separationDistance: s.separationDistance,
      circleDistance: s.circleDistance,
      circleRadius: s.circleRadius,
      angleVariation: s.angleVariation,
      mode: this.settings.mode
    });

    this.airplanes.push(airplane);
  },

  addWaypoint(x, y) {
    x = this.initialCoordinate(x, this.width);
    y = this.initialCoordinate(y, this.height);

    this.waypoints.push(new Waypoint(x, y, this.waypoints.length));
  },

  addDefaultWaypoints() {
    const w = this.width || 800;
    const h = this.height || 500;

    this.waypoints.push(new Waypoint(w * 0.2, h * 0.3, 0));
    this.waypoints.push(new Waypoint(w * 0.8, h * 0.3, 1));
    this.waypoints.push(new Waypoint(w * 0.8, h * 0.7, 2));
    this.waypoints.push(new Waypoint(w * 0.2, h * 0.7, 3));
  },

  addWeather(x, y) {
    x = this.initialCoordinate(x, this.width);
    y = this.initialCoordinate(y, this.height);

    this.weatherZones.push(new WeatherZone(x, y, 50 + Math.random() * 40));
  },

  removeAirplane(x, y) {
    for (let i = this.airplanes.length - 1; i >= 0; i--) {
      if (this.airplanes[i].contains(x, y)) {
        this.airplanes.splice(i, 1);
        return;
      }
    }
  },

  removeWaypoint(x, y) {
    for (let i = this.waypoints.length - 1; i >= 0; i--) {
      const w = this.waypoints[i];
      if (p5.Vector.dist(w.pos, new p5.Vector(x, y)) < 30) {
        this.waypoints.splice(i, 1);
        // Réindexe
        this.waypoints.forEach((wp, idx) => wp.index = idx);
        return;
      }
    }
  },

  removeWeather(x, y) {
    for (let i = this.weatherZones.length - 1; i >= 0; i--) {
      const z = this.weatherZones[i];
      if (p5.Vector.dist(z.pos, new p5.Vector(x, y)) < z.radius) {
        this.weatherZones.splice(i, 1);
        return;
      }
    }
  },

  clearAll() {
    this.airplanes = [];
    this.waypoints = [];
    this.weatherZones = [];
    ParticleSystem.clear();
  },

  setMode(mode) {
    this.settings.mode = mode;
    for (const a of this.airplanes) { a.mode = mode; a.wanderDebug = null; }
  },

  applySettings() {
    const s = UI.getSettings();
    for (const a of this.airplanes) {
      a.maxSpeed = s.maxSpeed;
      a.maxForce = s.maxForce;
      a.separationDistance = s.separationDistance;
      a.circleDistance = s.circleDistance;
      a.circleRadius = s.circleRadius;
      a.angleVariation = s.angleVariation;
    }
  },

  initialCoordinate(value, dimension) {
    if (value === undefined) {
      const margin = Math.min(100, dimension / 2);
      return margin + Math.random() * (dimension - 2 * margin);
    }
    return Number.isFinite(value) ? Math.max(0, Math.min(dimension, value)) : dimension / 2;
  },

  update() {
    // Une invocation correspond à un pas physique; les unités historiques sont
    // conservées par pas (positions en pixels, time en millisecondes simulées).
    this.time += FIXED_STEP_MS;
    this.applySettings();

    const bounds = { x: 0, y: 0, w: this.width, h: this.height };

    // Update météo
    for (const z of this.weatherZones) z.update();

    // Update waypoints
    for (const w of this.waypoints) w.update();

    // Update avions
    for (const a of this.airplanes) {
      a.update(
        this.time,
        bounds,
        this.airplanes,
        this.waypoints,
        this.weatherZones,
        this.settings.mode
      );
    }

    // Update ATC
    const newAlerts = this.atc.update(this.airplanes);
    if (newAlerts.length > this.atc.alerts.length) {
      // Nouvelle alerte, son
      // (optionnel)
    }

    // Particules
    ParticleSystem.update();
  },

  draw() {
    const ctx = this.ctx;

    // Fond ciel
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

    // Zones météo
    if (this.settings.showWeather) {
      for (const z of this.weatherZones) z.show(ctx);
    }

    // Waypoints
    if (this.settings.showWaypoints) {
      for (const w of this.waypoints) w.show(ctx);
    }

    // Avions
    for (const a of this.airplanes) {
      a.show(ctx, {
        showTrail: this.settings.showTrails,
        showSeparation: this.settings.showSeparation,
        showInfo: true
      });
    }

    // Particules
    ParticleSystem.draw(ctx);
    if (this.settings.showWanderDebug && this.airplanes[0]) this.airplanes[0].showWanderDebug(ctx);

    // ATC alerts
    this.atc.draw(ctx, this.width, this.height);

    // Dessine le radar
    this.drawRadar();
  },

  drawRadar() {
    const ctx = this.radarCtx;
    const w = this.radarWidth || 160;
    const h = this.radarHeight || 160;

    // Fond
    ctx.fillStyle = '#04101a';
    ctx.fillRect(0, 0, w, h);

    // Grille radar
    ctx.strokeStyle = 'rgba(94, 200, 255, 0.15)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 4; i++) {
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, (i / 4) * (w / 2), 0, Math.PI * 2);
      ctx.stroke();
    }

    // Ligne de balayage
    const sweepAngle = (this.time * 0.001) % (Math.PI * 2);
    ctx.strokeStyle = 'rgba(94, 200, 255, 0.4)';
    ctx.beginPath();
    ctx.moveTo(w / 2, h / 2);
    ctx.lineTo(
      w / 2 + Math.cos(sweepAngle) * w / 2,
      h / 2 + Math.sin(sweepAngle) * h / 2
    );
    ctx.stroke();

    // Avions (points rouges)
    const scaleX = w / this.width;
    const scaleY = h / this.height;

    for (const a of this.airplanes) {
      const x = a.pos.x * scaleX;
      const y = a.pos.y * scaleY;

      ctx.fillStyle = a.alertLevel === 2 ? '#ff657a' : '#5ec8ff';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Waypoints (points jaunes)
    for (const wp of this.waypoints) {
      const x = wp.pos.x * scaleX;
      const y = wp.pos.y * scaleY;

      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
  },

  loop(now) {
    let elapsed = 0;
    if (!Number.isFinite(now)) {
      this.lastTime = null;
      this.accumulator = 0;
    } else if (this.lastTime === null) {
      this.lastTime = now;
    } else if (now >= this.lastTime) {
      elapsed = now - this.lastTime;
      this.lastTime = now;
    }
    // A decreasing timestamp is ignored: retain the last valid high-water mark.

    this.frames++;
    if (Number.isFinite(now) && now - this.lastFpsUpdate > 500) {
      this.currentFps = Math.round(this.frames * 1000 / (now - this.lastFpsUpdate));
      this.frames = 0;
      this.lastFpsUpdate = now;
    }

    if (this.paused || document.hidden) {
      this.accumulator = 0;
    } else {
      const maximumCatchUpMs = this.fixedStepMs * this.maxSimulationStepsPerFrame;
      this.accumulator = Math.min(this.accumulator + elapsed, maximumCatchUpMs);
      let steps = 0;
      while (this.accumulator + 1e-9 >= this.fixedStepMs && steps < this.maxSimulationStepsPerFrame) {
        this.update(this.fixedStepMs);
        this.accumulator -= this.fixedStepMs;
        steps++;
      }
      if (this.accumulator < 1e-9) this.accumulator = 0;
    }
    this.draw();

    UI.updateStats(this.airplanes, this.atc.alerts, this.currentFps);

    requestAnimationFrame(t => this.loop(t));
  },

  handleClick(x, y, button) {
    if (button === 0) {
      // Clic gauche : ajouter un avion
      this.addAirplane(x, y);
    } else if (button === 2) {
      // Clic droit : retirer (avion en priorité, puis waypoint, puis météo)
      for (let i = this.airplanes.length - 1; i >= 0; i--) {
        if (this.airplanes[i].contains(x, y)) {
          this.airplanes.splice(i, 1);
          return;
        }
      }
      this.removeWaypoint(x, y);
      this.removeWeather(x, y);
    }
  },

  togglePause() {
    this.paused = !this.paused;
    this.accumulator = 0;
    // Rebasing prevents a pause interval from becoming elapsed simulation time.
    this.lastTime = null;
  }
};
