// ============================================
// Classe Vehicle - CLASSE DE BASE
// Tous les objets animés du jeu héritent de cette classe.
// ============================================
class Vehicle {
  constructor(x, y, options = {}) {
    // --- Physique ---
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = options.maxSpeed || 6;
    this.maxForce = options.maxForce || 0.4;

    // --- Apparence ---
    this.r = options.r || 12;
    this.color = options.color || color(80, 160, 255);

    // --- État ---
    this.health = options.health || 100;
    this.maxHealth = this.health;
    this.invincible = 0;

    // --- Power-ups (uniquement pour le joueur) ---
    this.speedBoostTimer = 0;
    this.shieldTimer = 0;
    this.tripleShotTimer = 0;
    this.baseMaxSpeed = this.maxSpeed;

    // --- Wander ---
    this.wanderAngle = random(TWO_PI);

    // --- Statistiques d'amélioration (Vampire Survivors style) ---
    this.damageMultiplier = 1;
    this.fireRate = 20;
    this.shootRange = 400;
    this.critChance = 0;
    this.pickupRange = 15;
    this.startShieldDuration = 0;
    this.explosiveShots = false;
    this.pierceCount = 0;
    this.lifeSteal = 0;
    this.regenRate = 0;
  }

  // ============================================
  // Physique
  // ============================================
  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);
    if (this.invincible > 0) this.invincible--;
  }

  // ============================================
  // Comportements de steering
  // ============================================
  seek(target) {
    let desired = p5.Vector.sub(target, this.pos);
    desired.setMag(this.maxSpeed);
    let steering = p5.Vector.sub(desired, this.vel);
    steering.limit(this.maxForce);
    return steering;
  }

  flee(target) {
    let desired = p5.Vector.sub(this.pos, target);
    desired.setMag(this.maxSpeed);
    let steering = p5.Vector.sub(desired, this.vel);
    steering.limit(this.maxForce);
    return steering;
  }

  arrive(target, slowRadius = 150) {
    let desired = p5.Vector.sub(target, this.pos);
    let d = desired.mag();
    if (d < slowRadius) {
      desired.setMag(map(d, 0, slowRadius, 0, this.maxSpeed));
    } else {
      desired.setMag(this.maxSpeed);
    }
    let steering = p5.Vector.sub(desired, this.vel);
    steering.limit(this.maxForce);
    return steering;
  }

  pursue(target, T = 10) {
    let futurePos = p5.Vector.add(target.pos, p5.Vector.mult(target.vel, T));
    return this.seek(futurePos);
  }

  evade(target, T = 10) {
    let futurePos = p5.Vector.add(target.pos, p5.Vector.mult(target.vel, T));
    return this.flee(futurePos);
  }

  wander() {
    this.wanderAngle += random(-0.3, 0.3);
    let circleCenter = this.vel.copy();
    circleCenter.setMag(80);
    let displacement = createVector(0, -1);
    displacement.setMag(30);
    displacement.rotate(this.wanderAngle);
    let target = p5.Vector.add(this.pos, p5.Vector.add(circleCenter, displacement));
    return this.seek(target);
  }

  boundaries(margin = 50) {
    let desired = null;
    if (this.pos.x < margin) desired = createVector(this.maxSpeed, this.vel.y);
    else if (this.pos.x > width - margin) desired = createVector(-this.maxSpeed, this.vel.y);
    if (this.pos.y < margin) desired = createVector(this.vel.x, this.maxSpeed);
    else if (this.pos.y > height - margin) desired = createVector(this.vel.x, -this.maxSpeed);

    if (desired) {
      desired.setMag(this.maxSpeed);
      let steering = p5.Vector.sub(desired, this.vel);
      steering.limit(this.maxForce);
      return steering;
    }
    return createVector(0, 0);
  }

  avoid(obstacles) {
    let ahead = this.vel.copy().setMag(60).add(this.pos);
    let ahead2 = this.vel.copy().setMag(30).add(this.pos);

    let mostThreatening = null;
    let minDist = Infinity;

    for (let obs of obstacles) {
      let d1 = p5.Vector.dist(ahead, obs.pos);
      let d2 = p5.Vector.dist(ahead2, obs.pos);
      let d3 = p5.Vector.dist(this.pos, obs.pos);

      if ((d1 < obs.r || d2 < obs.r || d3 < obs.r) && d3 < minDist) {
        minDist = d3;
        mostThreatening = obs;
      }
    }

    if (mostThreatening) {
      let avoidance = p5.Vector.sub(ahead, mostThreatening.pos);
      avoidance.setMag(this.maxSpeed);
      avoidance.sub(this.vel);
      avoidance.limit(this.maxForce);
      return avoidance;
    }
    return createVector(0, 0);
  }

  // ============================================
  // Power-ups
  // ============================================
  activatePowerUp(type) {
    switch (type) {
      case 'heal':
        this.health = min(this.maxHealth, this.health + 25);
        break;
      case 'speed':
        this.speedBoostTimer = 300;
        break;
      case 'shield':
        this.shieldTimer = 180;
        break;
      case 'triple':
        this.tripleShotTimer = 480;
        break;
      case 'bomb':
        triggerScreenBomb();
        break;
    }
  }

  updatePowerUps() {
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer--;
      this.maxSpeed = this.baseMaxSpeed * 1.6;
    } else {
      this.maxSpeed = this.baseMaxSpeed;
    }
    if (this.shieldTimer > 0) {
      this.shieldTimer--;
      this.invincible = max(this.invincible, 2);
    }
    if (this.tripleShotTimer > 0) {
      this.tripleShotTimer--;
    }

    // Régénération passive (upgrade)
    if (this.regenRate > 0) {
      this.health = Math.min(this.maxHealth, this.health + this.regenRate);
    }
  }

  hasTripleShot() { return this.tripleShotTimer > 0; }
  hasShield() { return this.shieldTimer > 0; }

  // ============================================
  // Affichage
  // ============================================
  show() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());

    if (this.invincible > 0 && !this.hasShield() && frameCount % 6 < 3) {
      pop();
      return;
    }

    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), 40);
    circle(0, 0, this.r * 3);

    if (this.shieldTimer > 0) {
      noFill();
      stroke(80, 180, 255, 200);
      strokeWeight(3);
      circle(0, 0, this.r * 4 + sin(frameCount * 0.2) * 5);
      stroke(80, 180, 255, 100);
      strokeWeight(6);
      circle(0, 0, this.r * 4 + sin(frameCount * 0.2) * 5);
    }

    fill(this.color);
    stroke(255);
    strokeWeight(1.5);
    triangle(
      this.r * 1.6, 0,
      -this.r, -this.r * 0.8,
      -this.r, this.r * 0.8
    );

    noStroke();
    fill(255, 180, 50, 200);
    triangle(
      -this.r * 0.9, -3,
      -this.r * 0.9, 3,
      -this.r * 1.8 - random(4), 0
    );

    pop();
  }

  takeDamage(amount) {
    if (this.invincible > 0) return false;
    this.health -= amount;
    this.invincible = 60;
    if (this.health < 0) this.health = 0;
    return true;
  }
}