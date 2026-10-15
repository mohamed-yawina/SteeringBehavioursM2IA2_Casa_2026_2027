// ============================================
// Classe Target - PROIE (sous-classe de Vehicle)
// ============================================
class Target extends Vehicle {
  constructor(x, y, type = 'basic') {
    super(x, y);

    this.type = type;
    this.r = 12;
    this.color = color(255, 80, 150);
    this.vel = p5.Vector.random2D().mult(random(1, 3));

    this.visionRadius = 200;
    this.visionCone = PI / 2.5;
    this.isAlerted = false;
    this.alertTimer = 0;
    this.alertFlash = 0;

    this.trail = [];

    if (type === 'fast') {
      this.maxSpeed = 7;
      this.maxForce = 0.4;
      this.r = 10;
      this.color = color(255, 220, 50);
      this.visionRadius = 220;
    } else if (type === 'slow') {
      this.maxSpeed = 3;
      this.maxForce = 0.15;
      this.r = 18;
      this.color = color(180, 80, 255);
      this.visionRadius = 160;
    } else if (type === 'shield') {
      this.maxSpeed = 4;
      this.maxForce = 0.25;
      this.r = 16;
      this.color = color(80, 255, 180);
      this.visionRadius = 180;
      this.hasShield = true;
    }

    // Vehicle.update() uses baseMaxSpeed while applying temporary boosts.
    this.baseMaxSpeed = this.maxSpeed;
  }

  update(pursuers = [], options = {}) {
    const closest = closestTargetTo(this, pursuers);
    const minDist = closest ? p5.Vector.dist(this.pos, closest.pos) : Infinity;
    const inRange = minDist < this.visionRadius;
    let inCone = false;

    if (closest && inRange) {
      let toHunter = p5.Vector.sub(closest.pos, this.pos).normalize();
      let forward = this.vel.copy().normalize();
      let angle = p5.Vector.angleBetween(forward, toHunter);
      inCone = angle < this.visionCone;
    }

    let wasAlerted = this.isAlerted;
    // The radius-only variant serves the perception exercise; the default
    // cone rule preserves the existing Challenge behavior.
    this.isAlerted = options.visionMode === 'radius'
      ? inRange
      : inRange && (inCone || minDist < 80);

    if (this.isAlerted && !wasAlerted) {
      this.alertFlash = 20;
      if (typeof soundFX !== 'undefined' && soundFX) soundFX.alert();
    }

    if (this.isAlerted) this.alertTimer = 30;
    else if (this.alertTimer > 0) this.alertTimer--;

    if (this.alertFlash > 0) this.alertFlash--;

    let force = createVector(0, 0);
    if (options.idle) {
      // Used by controlled lab trials to move a target at constant velocity.
    } else if (this.isAlerted && closest) {
      const predict = options.predictive !== false
        && (options.visionMode === 'radius' || minDist >= 100);
      force = predict
        ? this.evade(closest, options.predictionFrames ?? 15)
        : this.flee(closest.pos);
    } else {
      force = this.wander();
      force.mult(0.5);
    }

    if (!options.idle) force.add(this.boundaries(80));
    force.limit(this.maxForce);
    this.applyForce(force);
    super.update();
    if (this.trail.length > 15) this.trail.shift();
    return { closest, distance: minDist, inRange, isAlerted: this.isAlerted, force };
  }

  show() {
    if ((typeof showVision === 'undefined' || showVision) && this.vel.mag() > 0.5) {
      push();
      translate(this.pos.x, this.pos.y);
      let heading = this.vel.heading();
      rotate(heading);

      noStroke();
      let alpha = this.isAlerted ? 80 : 25;
      fill(red(this.color), green(this.color), blue(this.color), alpha);
      arc(0, 0, this.visionRadius * 2, this.visionRadius * 2,
          -this.visionCone, this.visionCone, PIE);
      pop();
    }

    push();
    noStroke();
    for (let i = 0; i < this.trail.length; i++) {
      let t = this.trail[i];
      let alpha = map(i, 0, this.trail.length, 0, 100);
      fill(red(this.color), green(this.color), blue(this.color), alpha);
      circle(t.x, t.y, 6);
    }
    pop();

    push();
    translate(this.pos.x, this.pos.y);

    if (this.isAlerted) {
      noStroke();
      let pulseSize = this.r * 4 + sin(frameCount * 0.3) * 10;
      fill(255, 50, 100, 60);
      circle(0, 0, pulseSize);
    }

    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), 60);
    circle(0, 0, this.r * 3);

    fill(20, 20, 40);
    stroke(this.color);
    strokeWeight(2.5);
    circle(0, 0, this.r * 2);

    noStroke();
    fill(255);
    circle(-4, -3, 5);
    circle(4, -3, 5);
    fill(0);
    circle(-4, -3, 2.5);
    circle(4, -3, 2.5);

    if (this.isAlerted) {
      noFill();
      stroke(255);
      strokeWeight(1.5);
      arc(0, 5, 10, 8, 0, PI);
    }

    if (this.alertFlash > 0) {
      fill(255, 50, 50, this.alertFlash * 12);
      textSize(24);
      textAlign(CENTER, CENTER);
      textStyle(BOLD);
      text('!', 0, -this.r - 18);
      textStyle(NORMAL);
    }

    pop();
  }
}
