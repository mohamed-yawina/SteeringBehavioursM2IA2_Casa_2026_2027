// ============================================
// Classe Vehicle - CLASSE DE BASE
//
// ⚠️ CONFORME AU COURS (Michel Buffa, page 52) :
// "Tous les objets animés sont des sous-classes de Vehicle"
// "Tous les comportements de base sont dans Vehicle"
// "Seuls les comportements personnalisés ou multiples
//  sont dans les sous-classes"
//
// Ce fichier contient TOUS les comportements de steering :
//   - seek, flee, arrive
//   - pursue, evade
//   - wander
//   - boundaries, avoid
//
// Formule de Reynolds :
//   force = vitesse souhaitée - vitesse actuelle
// ============================================

class Vehicle {
  constructor(x, y, options = {}) {
    if (typeof p5 === 'undefined' || typeof p5.Vector !== 'function') {
      throw new Error('p5.Vector must be loaded before creating a Vehicle');
    }
    const Vector = p5.Vector;

    // --- Position et physique ---
    this.pos = new Vector(x, y, 0);
    this.vel = new Vector(0, 0, 0);
    this.acc = new Vector(0, 0, 0);
    // Reusable intermediates avoid constructing temporary vectors in each behavior.
    this._desiredVelocity = new Vector(0, 0, 0);
    this._steeringScratch = new Vector(0, 0, 0);
    this._targetScratch = new Vector(0, 0, 0);
    this.maxSpeed = options.maxSpeed || 6;
    this.maxForce = options.maxForce || 0.4;

    // --- Apparence ---
    this.size = options.size || 14;
    this.color = options.color || '#5ec8ff';
    this.trailColor = options.trailColor || 'rgba(94, 200, 255, 0.4)';

    // --- Wander ---
    this.wanderAngle = Math.random() * Math.PI * 2;
    this.circleDistance = options.circleDistance || 60;
    this.circleRadius = options.circleRadius || 30;
    this.angleVariation = options.angleVariation || 0.3;

    // --- État ---
    this.alive = true;
    this.trail = [];
    this.maxTrailLength = options.maxTrailLength || 40;

    // Scratch storage for the last steering calculation. The public copy method
    // never exposes these mutable references.
    this._steeringDiagnostics = {
      behavior: '',
      valid: false,
      distance: 0,
      desiredSpeed: 0,
      effectiveSpeed: 0,
      position: { x: 0, y: 0 },
      currentVelocity: { x: 0, y: 0 },
      desiredVelocity: { x: 0, y: 0 },
      steering: { x: 0, y: 0 }
    };
  }

  // ============================================
  // COMPORTEMENTS DE BASE (TOUS DANS VEHICLE)
  // ============================================

  // ----------------------------------------
  // SEEK : aller vers une cible
  // steering = desired - vel
  // ----------------------------------------
  seek(target) {
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    const d = Math.hypot(dx, dy);
    if (d === 0) {
      const force = this._zeroSteering();
      this._recordSteeringDiagnostics('seek', d, 0, 0, force);
      return force;
    }

    const desiredX = (dx / d) * this.maxSpeed;
    const desiredY = (dy / d) * this.maxSpeed;
    this._desiredVelocity.set(desiredX, desiredY, 0);
    const force = this._steeringFromDesired(this._desiredVelocity);
    this._recordSteeringDiagnostics('seek', d, desiredX, desiredY, force);
    return force;
  }

  // ----------------------------------------
  // FLEE : fuir une cible
  // On inverse la VITESSE SOUHAITÉE (pas la force)
  // ----------------------------------------
  flee(target) {
    const dx = this.pos.x - target.x;
    const dy = this.pos.y - target.y;
    const d = Math.hypot(dx, dy);
    if (d === 0) {
      const force = this._zeroSteering();
      this._recordSteeringDiagnostics('arrive', d, 0, 0, force);
      return force;
    }

    const desiredX = (dx / d) * this.maxSpeed;
    const desiredY = (dy / d) * this.maxSpeed;
    this._desiredVelocity.set(desiredX, desiredY, 0);
    const force = this._steeringFromDesired(this._desiredVelocity);
    this._recordSteeringDiagnostics('arrive', d, desiredX, desiredY, force);
    return force;
  }

  _recordSteeringDiagnostics(behavior, distance, desiredX, desiredY, steering) {
    const data = this._steeringDiagnostics;
    const finite = Number.isFinite;
    data.valid = finite(this.pos.x) && finite(this.pos.y) && finite(this.vel.x) && finite(this.vel.y) &&
      finite(desiredX) && finite(desiredY) && finite(steering.x) && finite(steering.y) && finite(distance);
    data.behavior = behavior;
    data.distance = finite(distance) ? distance : 0;
    data.desiredSpeed = Math.hypot(finite(desiredX) ? desiredX : 0, finite(desiredY) ? desiredY : 0);
    data.effectiveSpeed = Math.hypot(finite(this.vel.x) ? this.vel.x : 0, finite(this.vel.y) ? this.vel.y : 0);
    data.position.x = finite(this.pos.x) ? this.pos.x : 0;
    data.position.y = finite(this.pos.y) ? this.pos.y : 0;
    data.currentVelocity.x = finite(this.vel.x) ? this.vel.x : 0;
    data.currentVelocity.y = finite(this.vel.y) ? this.vel.y : 0;
    data.desiredVelocity.x = finite(desiredX) ? desiredX : 0;
    data.desiredVelocity.y = finite(desiredY) ? desiredY : 0;
    data.steering.x = finite(steering.x) ? steering.x : 0;
    data.steering.y = finite(steering.y) ? steering.y : 0;
  }

  _zeroSteering() {
    return this._steeringScratch.set(0, 0, 0).copy();
  }

  _steeringFromDesired(desiredVelocity) {
    // Reynolds: steering = desiredVelocity - currentVelocity.
    this._steeringScratch.set(desiredVelocity).sub(this.vel);
    return this._limit(this._steeringScratch).copy();
  }

  copySteeringDiagnosticsTo(output) {
    if (!output || typeof output !== 'object') throw new TypeError('A diagnostics output object is required');
    const source = this._steeringDiagnostics;
    if (!output.position || typeof output.position !== 'object') output.position = { x: 0, y: 0 };
    if (!output.currentVelocity || typeof output.currentVelocity !== 'object') output.currentVelocity = { x: 0, y: 0 };
    if (!output.desiredVelocity || typeof output.desiredVelocity !== 'object') output.desiredVelocity = { x: 0, y: 0 };
    if (!output.steering || typeof output.steering !== 'object') output.steering = { x: 0, y: 0 };
    output.position.x = source.position.x; output.position.y = source.position.y;
    output.currentVelocity.x = source.currentVelocity.x; output.currentVelocity.y = source.currentVelocity.y;
    output.desiredVelocity.x = source.desiredVelocity.x; output.desiredVelocity.y = source.desiredVelocity.y;
    output.steering.x = source.steering.x; output.steering.y = source.steering.y;
    output.behavior = source.behavior;
    output.valid = source.valid;
    output.distance = source.distance;
    output.desiredSpeed = source.desiredSpeed;
    output.effectiveSpeed = source.effectiveSpeed;
    return output;
  }

  resetSteeringDiagnostics() {
    const data = this._steeringDiagnostics;
    data.behavior = '';
    data.valid = false;
    data.distance = 0;
    data.desiredSpeed = 0;
    data.effectiveSpeed = 0;
    data.position.x = 0; data.position.y = 0;
    data.currentVelocity.x = 0; data.currentVelocity.y = 0;
    data.desiredVelocity.x = 0; data.desiredVelocity.y = 0;
    data.steering.x = 0; data.steering.y = 0;
  }

  // ----------------------------------------
  // ARRIVE : seek avec ralentissement
  //
  // C'est LE comportement clé de ce TD.
  //
  // slowRadius : distance à laquelle on commence à ralentir
  // stopDistance : distance d'arrêt (le véhicule s'arrête avant)
  //
  // Formule :
  //   si d < slowRadius :
  //       speed = map(d, stopDistance, slowRadius, 0, maxSpeed)
  //   sinon :
  //       speed = maxSpeed
  //   desired = normalize(target - pos) * speed
  //   steering = desired - vel
  // ----------------------------------------
  arrive(target, slowRadius = 150, stopDistance = 0) {
    const dx = target.x - this.pos.x;
    const dy = target.y - this.pos.y;
    const d = Math.hypot(dx, dy);
    if (d === 0) {
      const force = this._zeroSteering();
      this._recordSteeringDiagnostics('arrive', d, 0, 0, force);
      return force;
    }

    let speed = this.maxSpeed;

    if (d < slowRadius) {
      // Interpolation linéaire de 0 à maxSpeed
      const ratio = (d - stopDistance) / (slowRadius - stopDistance);
      speed = Math.max(0, Math.min(1, ratio)) * this.maxSpeed;
    }

    const desiredX = (dx / d) * speed;
    const desiredY = (dy / d) * speed;
    this._desiredVelocity.set(desiredX, desiredY, 0);
    const force = this._steeringFromDesired(this._desiredVelocity);
    this._recordSteeringDiagnostics('arrive', d, desiredX, desiredY, force);
    return force;
  }

  // ----------------------------------------
  // PURSUE : seek vers la position FUTURE
  // ----------------------------------------
  pursue(target, T = 10) {
    const futureX = target.pos.x + (target.vel?.x || 0) * T;
    const futureY = target.pos.y + (target.vel?.y || 0) * T;
    this._targetScratch.set(futureX, futureY, 0);
    return this.seek(this._targetScratch);
  }

  // ----------------------------------------
  // EVADE : flee depuis la position FUTURE
  // ----------------------------------------
  evade(target, T = 10) {
    const futureX = target.pos.x + (target.vel?.x || 0) * T;
    const futureY = target.pos.y + (target.vel?.y || 0) * T;
    this._targetScratch.set(futureX, futureY, 0);
    return this.flee(this._targetScratch);
  }

  // ----------------------------------------
  // WANDER : errance aléatoire
  // Cercle projeté devant + angle qui varie
  // ----------------------------------------
  wander() {
    const velMag = Math.hypot(this.vel.x, this.vel.y);
    const dirX = velMag > 0.1 ? this.vel.x / velMag : 1;
    const dirY = velMag > 0.1 ? this.vel.y / velMag : 0;

    const circleX = this.pos.x + dirX * this.circleDistance;
    const circleY = this.pos.y + dirY * this.circleDistance;

    this.wanderAngle += (Math.random() - 0.5) * this.angleVariation * 2;

    const dispX = Math.cos(this.wanderAngle) * this.circleRadius;
    const dispY = Math.sin(this.wanderAngle) * this.circleRadius;

    this._targetScratch.set(circleX + dispX, circleY + dispY, 0);
    return this.seek(this._targetScratch);
  }

  // ----------------------------------------
  // BOUNDARIES : rester dans les limites
  // ----------------------------------------
  boundaries(bounds, margin = 40) {
    let desiredX = this.vel.x;
    let desiredY = this.vel.y;
    let needsForce = false;

    if (this.pos.x < bounds.x + margin) {
      desiredX = this.maxSpeed;
      needsForce = true;
    } else if (this.pos.x > bounds.x + bounds.w - margin) {
      desiredX = -this.maxSpeed;
      needsForce = true;
    }

    if (this.pos.y < bounds.y + margin) {
      desiredY = this.maxSpeed;
      needsForce = true;
    } else if (this.pos.y > bounds.y + bounds.h - margin) {
      desiredY = -this.maxSpeed;
      needsForce = true;
    }

    if (!needsForce) return this._zeroSteering();

    const d = Math.hypot(desiredX, desiredY);
    if (d === 0) return this._zeroSteering();
    this._desiredVelocity.set((desiredX / d) * this.maxSpeed, (desiredY / d) * this.maxSpeed, 0);
    return this._steeringFromDesired(this._desiredVelocity);
  }

  // ----------------------------------------
  // AVOID : éviter des obstacles
  // ----------------------------------------
  avoid(obstacles) {
    const aheadX = this.pos.x + this.vel.x * 10;
    const aheadY = this.pos.y + this.vel.y * 10;

    let threat = null;
    let minDist = Infinity;

    for (const obs of obstacles) {
      const d = Math.hypot(aheadX - obs.x, aheadY - obs.y);
      if (d < obs.r && d < minDist) {
        minDist = d;
        threat = obs;
      }
    }

    if (threat) {
      const avoidX = aheadX - threat.x;
      const avoidY = aheadY - threat.y;
      const mag = Math.hypot(avoidX, avoidY) || 1;
      this._desiredVelocity.set((avoidX / mag) * this.maxSpeed, (avoidY / mag) * this.maxSpeed, 0);
      return this._steeringFromDesired(this._desiredVelocity);
    }

    return this._zeroSteering();
  }

  // ============================================
  // PHYSIQUE
  // ============================================

  applyForce(force) {
    this.acc.add(force.x, force.y, force.z || 0);
  }

  update() {
    this.vel.add(this.acc);

    const speed = Math.hypot(this.vel.x, this.vel.y);
    if (speed > this.maxSpeed) {
      this.vel.mult(this.maxSpeed / speed);
    }

    this.pos.add(this.vel);

    this.acc.set(0, 0, 0);

    // Traînée
    this.trail.push({ x: this.pos.x, y: this.pos.y });
    if (this.trail.length > this.maxTrailLength) this.trail.shift();
  }

  // Téléportation aux bords (désactivée par défaut)
  edges() {
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.y > height) this.pos.y = 0;
    if (this.pos.y < 0) this.pos.y = height;
  }

  // ============================================
  // UTILITAIRES
  // ============================================

  _limit(v) {
    const m = Math.hypot(v.x, v.y);
    if (m > this.maxForce) {
      v.mult(this.maxForce / m);
    }
    return v;
  }

  distanceTo(other) {
    return Math.hypot(this.pos.x - other.pos.x, this.pos.y - other.pos.y);
  }

  // Affichage par défaut (cercle)
  show(ctx, options = {}) {
    const { showTrail, showVelocity } = options;

    if (showTrail && this.trail.length > 1) {
      ctx.strokeStyle = this.trailColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();
    }

    if (showVelocity) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(this.pos.x + this.vel.x * 6, this.pos.y + this.vel.y * 6);
      ctx.stroke();
    }

    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
  }
}
