// ============================================
// Interface utilisateur
// ============================================

const $ = id => document.getElementById(id);

const UI = {
  sliders: {},

  init() {
    // Sliders
    this.sliders.speed = $('speed');
    this.sliders.force = $('force');
    this.sliders.sep = $('sep');
    this.sliders.dist = $('dist');
    this.sliders.radius = $('radius');
    this.sliders.angle = $('angle');

    // Live update des labels
    this.sliders.speed.addEventListener('input', () => {
      $('speedVal').textContent = parseFloat(this.sliders.speed.value).toFixed(1);
    });
    this.sliders.force.addEventListener('input', () => {
      $('forceVal').textContent = parseFloat(this.sliders.force.value).toFixed(2);
    });
    this.sliders.sep.addEventListener('input', () => {
      $('sepVal').textContent = this.sliders.sep.value;
    });
    this.sliders.dist.addEventListener('input', () => {
      $('distVal').textContent = this.sliders.dist.value;
    });
    this.sliders.radius.addEventListener('input', () => {
      $('radiusVal').textContent = this.sliders.radius.value;
    });
    this.sliders.angle.addEventListener('input', () => {
      $('angleVal').textContent = parseFloat(this.sliders.angle.value).toFixed(2);
    });

    // Mode buttons
    document.querySelectorAll('.mode-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Game.setMode(btn.dataset.mode);
      });
    });

    // Action buttons
    $('addBtn').addEventListener('click', () => Game.addAirplane());
    $('addWaypointBtn').addEventListener('click', () => Game.addWaypoint());
    $('addWeatherBtn').addEventListener('click', () => Game.addWeather());
    $('clearBtn').addEventListener('click', () => Game.clearAll());

    // Toggles
    $('showTrails').addEventListener('change', e => Game.settings.showTrails = e.target.checked);
    $('showSeparation').addEventListener('change', e => Game.settings.showSeparation = e.target.checked);
    $('showWaypoints').addEventListener('change', e => Game.settings.showWaypoints = e.target.checked);
    $('showWeather').addEventListener('change', e => Game.settings.showWeather = e.target.checked);
    $('showWanderDebug').addEventListener('change', e => Game.settings.showWanderDebug = e.target.checked);
  },

  getSettings() {
    return {
      maxSpeed: parseFloat(this.sliders.speed.value),
      maxForce: parseFloat(this.sliders.force.value),
      separationDistance: parseFloat(this.sliders.sep.value),
      circleDistance: parseFloat(this.sliders.dist.value),
      circleRadius: parseFloat(this.sliders.radius.value),
      angleVariation: parseFloat(this.sliders.angle.value)
    };
  },

  updateStats(airplanes, alerts, fps) {
    const descriptions = {
      wander: 'Wander : exploration par cible fluctuante. Paramètres Wander actifs sur tous les avions.',
      waypoints: 'Waypoints : Arrive vers les balises successives. Wander actif seulement si aucune balise ne reste.',
      formation: 'Formation : premier avion leader en Wander ; suiveurs en Arrive vers des emplacements distincts. Paramètres Wander actifs sur le leader.',
      patrol: 'Patrouille : Seek vers une cible mobile sur une ellipse prédéfinie. Paramètres Wander sans effet dans ce mode.'
    };
    $('modeDescription').textContent = descriptions[Game.settings.mode];
    $('simulationStatus').textContent = Game.paused ? 'En pause' : 'Simulation en cours';
    $('debugStatus').textContent = Game.settings.showWanderDebug
      ? (airplanes[0]?.wanderDebug ? `Avion observé : ${airplanes[0].callsign} (premier avion). Données du dernier pas physique.` : 'Aucun calcul Wander disponible : choisir Wander ou attendre un pas physique.')
      : 'Visualisation désactivée.';
    $('count').textContent = airplanes.length;

    if (airplanes.length === 0) {
      $('avgSpeed').textContent = '0.0';
      $('alerts').textContent = '0';
      $('fps').textContent = fps;
      return;
    }

    let totalSpeed = 0;
    for (const a of airplanes) {
      totalSpeed += a.vel.mag();
    }
    $('avgSpeed').textContent = (totalSpeed / airplanes.length).toFixed(2);
    $('alerts').textContent = alerts.filter(a => a.level === 'CRITICAL').length;
    $('fps').textContent = fps;
  }
};
