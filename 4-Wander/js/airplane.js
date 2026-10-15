// ============================================
// Classe Airplane - extends Vehicle
//
// ✅ Conforme au cours : sous-classe de Vehicle
// Comportement personnalisé : vol, altitude,
// anti-collision, waypoints, météo
// ============================================

class Airplane extends Vehicle {
  constructor(x, y, options = {}) {
    // Couleur aléatoire (compagnie aérienne)
    const hue = options.hue !== undefined ? options.hue : Math.random() * 360;
    const color = `hsl(${hue}, 75%, 65%)`;

    super(x, y, {
      maxSpeed: Number.isFinite(options.maxSpeed) && options.maxSpeed >= 0 ? options.maxSpeed : 4,
      maxForce: Number.isFinite(options.maxForce) && options.maxForce >= 0 ? options.maxForce : 0.15,
      size: options.size || 14,
      color: color,
      circleDistance: options.circleDistance || 80,
      circleRadius: options.circleRadius || 40,
      angleVariation: options.angleVariation || 0.2,
      maxTrailLength: 80
    });

    // Identifiant (numéro de vol)
    this.callsign = 'AF' + String(Math.floor(100 + Math.random() * 900));

    // Altitude simulée (affecte la taille visuelle)
    this.altitude = 0.7 + Math.random() * 0.6;

    // Séparation anti-collision
    this.separationDistance = options.separationDistance || 80;

    // Cible (waypoint ou autre avion)
    this.target = null;
    this.targetIndex = 0;

    // Mode de vol
    this.mode = options.mode || 'wander';

    // État d'alerte
    this.alertLevel = 0;  // 0 = OK, 1 = attention, 2 = collision imminente

    // Vitesse initiale
    const angle = Math.random() * Math.PI * 2;
    this.vel.set(Math.cos(angle) * this.maxSpeed, Math.sin(angle) * this.maxSpeed);
  }

  // ✅ Comportement personnalisé : choisit le comportement
  update(time, bounds, allAirplanes, waypoints, weatherZones, mode) {
    this.wanderDebug = null;
    let force = new p5.Vector(0, 0);

    // === 1. Comportement principal selon le mode ===
    switch (mode) {
      case 'waypoints':
        force = this.followWaypoints(waypoints);
        break;

      case 'formation':
        force = this.formationFlight(allAirplanes);
        break;

      case 'patrol':
        force = this.patrol(time, bounds);
        break;

      case 'wander':
      default:
        force = this.wander();
        break;
    }

    // === 2. Anti-collision (separation) ===
    const sep = this.separate(allAirplanes);
    force.add(sep.copy().mult(2));

    // === 3. Éviter les zones météo ===
    if (weatherZones.length > 0) {
      const weather = this.avoidWeather(weatherZones);
      force.add(weather.copy().mult(1.5));
    }

    // === 4. Éviter les bords ===
    const bound = this.boundaries(bounds, 60);
    force.add(bound.copy().mult(3));

    // Applique la force
    this.applyForce(force.limit(this.maxForce));
    if (this.wanderDebug) this.wanderDebug.totalForce = force.copy();

    // Physique héritée
    super.update();
  }

  // Observe the inherited calculation, without duplicating Wander or drawing it again.
  wander() {
    this.capturingWander = true;
    try {
      const force = super.wander();
      if (this.wanderDebug) this.wanderDebug.wanderForce = force.copy();
      return force;
    } finally {
      this.capturingWander = false;
    }
  }

  seek(target) {
    const force = super.seek(target);
    if (this.capturingWander) {
      const direction = this.vel.mag() > 0.1 ? this.vel.copy().normalize() : new p5.Vector(1, 0);
      this.wanderDebug = {
        origin: this.pos.copy(), velocity: this.vel.copy(), target: target.copy(),
        center: this.pos.copy().add(direction.mult(this.circleDistance)),
        radiusX: this.circleRadius, radiusY: this.circleRadius,
        wanderForce: force.copy(), totalForce: force.copy()
      };
    }
    return force;
  }

  showWanderDebug(ctx) {
    const d = this.wanderDebug;
    if (!d) return;
    const line = (from, to, color) => {
      ctx.strokeStyle = color;
      ctx.beginPath(); ctx.moveTo(from.x, from.y); ctx.lineTo(to.x, to.y); ctx.stroke();
    };
    const arrow = (vector, scale, color) => {
      const end = d.origin.copy().add(vector.copy().mult(scale));
      line(d.origin, end, color);
      if (vector.magSq() === 0) return;
      const angle = Math.atan2(vector.y, vector.x);
      for (const side of [-1, 1]) line(end, new p5.Vector(
        end.x - 6 * Math.cos(angle + side * 0.5), end.y - 6 * Math.sin(angle + side * 0.5)), color);
    };
    ctx.save();
    ctx.lineWidth = 2;
    line(d.origin, d.center, '#5ec8ff');
    ctx.strokeStyle = '#5ec8ff';
    ctx.beginPath(); ctx.ellipse(d.center.x, d.center.y, d.radiusX, d.radiusY, 0, 0, Math.PI * 2); ctx.stroke();
    line(d.center, d.target, '#ffd166');
    for (const [point, color] of [[d.center, '#5ec8ff'], [d.target, '#ffd166']]) {
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(point.x, point.y, 4, 0, Math.PI * 2); ctx.fill();
    }
    arrow(d.velocity, 12, '#ffffff');
    arrow(d.totalForce, 240, '#ff657a');
    arrow(d.wanderForce, 240, '#68f0a4');
    ctx.fillStyle = '#ffffff'; ctx.font = '12px monospace'; ctx.textAlign = 'left';
    ctx.fillText(`Wander observé : ${this.callsign}`, d.origin.x + 10, d.origin.y + 20);
    ctx.restore();
  }

  // === Suit une liste de waypoints ===
  followWaypoints(waypoints) {
    if (waypoints.length === 0) return this.wander();

    // Cible actuelle
    const target = waypoints[this.targetIndex % waypoints.length];
    const d = p5.Vector.dist(this.pos, target.pos);

    // Si assez proche, passe au suivant
    if (d < 40) {
      this.targetIndex++;
    }

    // ✅ Utilise arrive() hérité pour ralentir à l'approche
    return this.arrive(target.pos, 80);
  }

  // === Vol en formation (suit le leader) ===
  formationFlight(allAirplanes) {
    // Trouve le leader (le premier avion)
    const leader = allAirplanes[0];

    if (leader === this) {
      // Le leader fait un wander
      return this.wander();
    }

    // Les autres suivent le leader avec un offset
    const offsetIndex = allAirplanes.indexOf(this);
    const side = offsetIndex % 2 === 0 ? 1 : -1;
    const row = Math.ceil(offsetIndex / 2);

    // Calcule la position cible
    const leaderAngle = Math.atan2(leader.vel.y, leader.vel.x);
    const backX = -Math.cos(leaderAngle) * row * 50;
    const backY = -Math.sin(leaderAngle) * row * 50;
    const sideX = -Math.sin(leaderAngle) * side * row * 40;
    const sideY = Math.cos(leaderAngle) * side * row * 40;

    const targetX = leader.pos.x + backX + sideX;
    const targetY = leader.pos.y + backY + sideY;

    // ✅ Utilise arrive() hérité
    return this.arrive(new p5.Vector(targetX, targetY), 60);
  }

  // === Patrouille (Seek vers une cible sur une ellipse prédéfinie) ===
  patrol(time, bounds = { x: 0, y: 0, w: 1000, h: 625 }) {
    // L'orbite garde les proportions de la scène historique 1000 × 625.
    const centerX = bounds.x + bounds.w * 0.4;
    const centerY = bounds.y + bounds.h * 0.48;
    const radiusX = bounds.w * 0.2;
    const radiusY = bounds.h * 0.192;
    const angle = (time * 0.0003) + (this.callsign.charCodeAt(2) * 0.5);

    const targetX = centerX + Math.cos(angle) * radiusX;
    const targetY = centerY + Math.sin(angle) * radiusY;

    // ✅ Utilise seek() hérité
    return this.seek(new p5.Vector(targetX, targetY));
  }

  // === Anti-collision (separation) ===
  separate(others) {
    const steeringDirection = new p5.Vector(0, 0);
    let count = 0;
    let minDist = Infinity;

    for (const other of others) {
      if (other === this) continue;

      const d = p5.Vector.dist(this.pos, other.pos);

      if (d < minDist) minDist = d;

      if (d > 0 && d < this.separationDistance) {
        const difference = p5.Vector.sub(this.pos, other.pos).div(d);
        // Plus l'avion est proche, plus la force est forte
        const weight = 1 - (d / this.separationDistance);
        steeringDirection.add(difference.mult(weight));
        count++;
      }
    }

    // Niveau d'alerte
    if (minDist < 40) this.alertLevel = 2;
    else if (minDist < this.separationDistance) this.alertLevel = 1;
    else this.alertLevel = 0;

    if (count > 0) {
      steeringDirection.div(count);
      if (steeringDirection.magSq() > 0) {
        steeringDirection.normalize().mult(this.maxSpeed).sub(this.vel).limit(this.maxForce);
      }
    }
    return steeringDirection;
  }

  // === Éviter les zones météo ===
  avoidWeather(zones) {
    const steering = new p5.Vector(0, 0);
    let count = 0;

    for (const zone of zones) {
      const d = p5.Vector.dist(this.pos, zone.pos);
      const dangerRadius = zone.radius + 50;

      if (d < dangerRadius) {
        // ✅ Utilise flee() hérité
        const force = this.flee(zone.pos);
        const weight = 1 - (d / dangerRadius);
        steering.add(force.mult(weight * 3));
        count++;
      }
    }

    if (count > 0) {
      steering.div(count);
    }
    return steering;
  }

  // === Dessin spécifique aux avions ===
  show(ctx, options = {}) {
    const { showTrail, showSeparation, showInfo } = options;

    // Traînée de condensation
    if (showTrail && this.trail.length > 1) {
      ctx.strokeStyle = `hsla(${this._hue()}, 80%, 65%, 0.25)`;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();
    }

    // Zone de séparation (anti-collision)
    if (showSeparation && this.alertLevel > 0) {
      const color = this.alertLevel === 2
        ? 'rgba(255, 101, 122, 0.8)'
        : 'rgba(255, 209, 102, 0.5)';

      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.arc(this.pos.x, this.pos.y, this.separationDistance, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Avion (triangle orienté)
    const angle = Math.atan2(this.vel.y, this.vel.x);
    const size = this.size * this.altitude;

    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(angle);

    // Halo
    ctx.shadowColor = this.color;
    ctx.shadowBlur = this.alertLevel === 2 ? 20 : 8;

    // Corps (triangle)
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.moveTo(size, 0);
    ctx.lineTo(-size * 0.7, -size * 0.5);
    ctx.lineTo(-size * 0.5, 0);
    ctx.lineTo(-size * 0.7, size * 0.5);
    ctx.closePath();
    ctx.fill();

    // Ailes
    ctx.beginPath();
    ctx.moveTo(size * 0.2, -size * 0.7);
    ctx.lineTo(-size * 0.2, -size * 0.7);
    ctx.lineTo(-size * 0.3, 0);
    ctx.lineTo(size * 0.2, 0);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(size * 0.2, size * 0.7);
    ctx.lineTo(-size * 0.2, size * 0.7);
    ctx.lineTo(-size * 0.3, 0);
    ctx.lineTo(size * 0.2, 0);
    ctx.closePath();
    ctx.fill();

    // Cockpit
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(size * 0.3, 0, size * 0.15, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();

    // Callsign (numéro de vol)
    if (showInfo) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.font = '9px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(this.callsign, this.pos.x, this.pos.y - size - 6);
    }
  }

  // === Utilitaires ===
  _hue() {
    const match = this.color.match(/hsl\((\d+)/);
    return match ? parseInt(match[1]) : 200;
  }

  contains(x, y) {
    return p5.Vector.dist(this.pos, new p5.Vector(x, y)) < this.size * this.altitude + 8;
  }
}
