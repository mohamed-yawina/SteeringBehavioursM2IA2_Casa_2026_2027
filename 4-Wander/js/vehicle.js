// ============================================
// Classe Vehicle - CLASSE DE BASE
// Tous les comportements de steering sont ICI
// ============================================

class Vehicle {
  constructor(x, y, options = {}) {
    this.pos = new p5.Vector(x, y);
    this.vel = new p5.Vector(0, 0);
    this.acc = new p5.Vector(0, 0);
    // Zero is a meaningful limit (for example, for static entities).
    // Invalid or negative limits fall back to the established defaults.
    this.maxSpeed = Number.isFinite(options.maxSpeed) && options.maxSpeed >= 0
      ? options.maxSpeed : 3;
    this.maxForce = Number.isFinite(options.maxForce) && options.maxForce >= 0
      ? options.maxForce : 0.2;

    this.size = options.size || 12;
    this.color = options.color || '#5ec8ff';

    this.wanderAngle = Math.random() * Math.PI * 2;
    this.circleDistance = options.circleDistance || 80;
    this.circleRadius = options.circleRadius || 40;
    this.angleVariation = options.angleVariation || 0.2;
    this.noiseOffset = Math.random() * 1000;

    this.alive = true;
    this.trail = [];
    this.maxTrailLength = options.maxTrailLength || 60;
  }

  // ============================================
  // COMPORTEMENTS DE BASE
  // ============================================

  seek(target) {
    const desiredVelocity = p5.Vector.sub(target, this.pos);
    if (desiredVelocity.magSq() === 0) return new p5.Vector(0, 0);

    desiredVelocity.setMag(this.maxSpeed);
    return this._limit(desiredVelocity.sub(this.vel));
  }

  flee(target) {
    const desiredVelocity = p5.Vector.sub(this.pos, target);
    if (desiredVelocity.magSq() === 0) return new p5.Vector(0, 0);

    desiredVelocity.setMag(this.maxSpeed);
    return this._limit(desiredVelocity.sub(this.vel));
  }

  arrive(target, slowRadius = 100) {
    const desiredVelocity = p5.Vector.sub(target, this.pos);
    const distance = desiredVelocity.mag();
    if (distance === 0) return new p5.Vector(0, 0);

    const desiredSpeed = distance < slowRadius
      ? (distance / slowRadius) * this.maxSpeed
      : this.maxSpeed;
    desiredVelocity.setMag(desiredSpeed);
    return this._limit(desiredVelocity.sub(this.vel));
  }

  pursue(target, T = 10) {
    const futurePosition = target.pos.copy();
    if (target.vel) futurePosition.add(p5.Vector.mult(target.vel, T));
    return this.seek(futurePosition);
  }

  evade(target, T = 10) {
    const futurePosition = target.pos.copy();
    if (target.vel) futurePosition.add(p5.Vector.mult(target.vel, T));
    return this.flee(futurePosition);
  }

  // ============================================
  // WANDER
  // ============================================
  wander() {
    const velMag = this.vel.mag();
    const circleDirection = velMag > 0.1
      ? this.vel.copy().normalize()
      : new p5.Vector(1, 0);
    const circleCenter = circleDirection.mult(this.circleDistance).add(this.pos);

    this.wanderAngle += (Math.random() - 0.5) * this.angleVariation * 2;

    const displacement = new p5.Vector(
      Math.cos(this.wanderAngle) * this.circleRadius,
      Math.sin(this.wanderAngle) * this.circleRadius
    );
    return this.seek(circleCenter.add(displacement));
  }

  wanderNoise(time) {
    const velMag = this.vel.mag();
    const circleDirection = velMag > 0.1
      ? this.vel.copy().normalize()
      : new p5.Vector(1, 0);
    const circleCenter = circleDirection.mult(this.circleDistance).add(this.pos);

    const noiseValue = this._noise(
      this.pos.x * 0.005,
      this.pos.y * 0.005,
      time * 0.0005
    );
    const angle = noiseValue * Math.PI * 4;

    const displacement = new p5.Vector(
      Math.cos(angle) * this.circleRadius,
      Math.sin(angle) * this.circleRadius
    );
    return this.seek(circleCenter.add(displacement));
  }

  boundaries(bounds, margin = 40) {
    const desiredVelocity = this.vel.copy();
    let needsForce = false;

    if (this.pos.x < bounds.x + margin) { desiredVelocity.x = this.maxSpeed; needsForce = true; }
    else if (this.pos.x > bounds.x + bounds.w - margin) { desiredVelocity.x = -this.maxSpeed; needsForce = true; }
    if (this.pos.y < bounds.y + margin) { desiredVelocity.y = this.maxSpeed; needsForce = true; }
    else if (this.pos.y > bounds.y + bounds.h - margin) { desiredVelocity.y = -this.maxSpeed; needsForce = true; }

    if (!needsForce) return new p5.Vector(0, 0);

    if (desiredVelocity.magSq() === 0) return new p5.Vector(0, 0);

    desiredVelocity.setMag(this.maxSpeed);
    return this._limit(desiredVelocity.sub(this.vel));
  }

  avoid(obstacles) {
    const ahead = this.pos.copy().add(p5.Vector.mult(this.vel, 10));
    let threat = null;
    let minDist = Infinity;

    for (const obs of obstacles) {
      const obstaclePosition = obs.pos ?? obs;
      const d = p5.Vector.dist(ahead, obstaclePosition);
      if (d < obs.r && d < minDist) {
        minDist = d;
        threat = obs;
      }
    }

    if (threat) {
      const obstaclePosition = threat.pos ?? threat;
      const desiredVelocity = p5.Vector.sub(ahead, obstaclePosition);
      if (desiredVelocity.magSq() === 0) return new p5.Vector(0, 0);
      desiredVelocity.setMag(this.maxSpeed);
      return this._limit(desiredVelocity.sub(this.vel));
    }
    return new p5.Vector(0, 0);
  }

  // ============================================
  // PHYSIQUE
  // ============================================
  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    this.vel.add(this.acc).limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.set(0, 0);

    this.trail.push(this.pos.copy());
    if (this.trail.length > this.maxTrailLength) this.trail.shift();
  }

  // ============================================
  // UTILITAIRES
  // ============================================
  _limit(v) {
    return v.limit(this.maxForce);
  }

  _noise(x, y, z) {
    const n = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453;
    return n - Math.floor(n);
  }
}
