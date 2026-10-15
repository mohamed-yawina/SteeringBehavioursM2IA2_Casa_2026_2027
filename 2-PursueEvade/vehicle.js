// ============================================
// Classe Vehicle - CHASSEUR
// ============================================
class Vehicle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = 7;
    this.maxForce = 0.6;
    this.r = 15;
    this.color = color(0, 220, 255);

    this.wanderAngle = random(TWO_PI);

    this.trail = [];

    this.speedBoostTimer = 0;
    this.visionBoostTimer = 0;
    this.baseMaxSpeed = this.maxSpeed;
  }

  // ============================================
  // Comportements de steering
  // ============================================
  seek(target) {
    let d = p5.Vector.sub(target, this.pos);
    d.setMag(this.maxSpeed);
    let s = p5.Vector.sub(d, this.vel);
    s.limit(this.maxForce);
    return s;
  }

  flee(target) {
    let d = p5.Vector.sub(this.pos, target);
    d.setMag(this.maxSpeed);
    let s = p5.Vector.sub(d, this.vel);
    s.limit(this.maxForce);
    return s;
  }

  arrive(target, slowR = 150) {
    let d = p5.Vector.sub(target, this.pos);
    let dist = d.mag();
    if (dist < slowR) d.setMag(map(dist, 0, slowR, 0, this.maxSpeed));
    else d.setMag(this.maxSpeed);
    let s = p5.Vector.sub(d, this.vel);
    s.limit(this.maxForce);
    return s;
  }

  pursue(target, T = 10) {
    let f = p5.Vector.add(target.pos, p5.Vector.mult(target.vel, T));
    return this.seek(f);
  }

  evade(target, T = 10) {
    let f = p5.Vector.add(target.pos, p5.Vector.mult(target.vel, T));
    return this.flee(f);
  }

  wander() {
    this.wanderAngle += random(-0.3, 0.3);
    let c = this.vel.copy().setMag(80);
    let d = createVector(0, -1).setMag(30).rotate(this.wanderAngle);
    return this.seek(p5.Vector.add(this.pos, p5.Vector.add(c, d)));
  }

  boundaries(margin = 60) {
    let d = null;
    if (this.pos.x < margin) d = createVector(this.maxSpeed, this.vel.y);
    else if (this.pos.x > width - margin) d = createVector(-this.maxSpeed, this.vel.y);
    if (this.pos.y < margin) d = createVector(this.vel.x, this.maxSpeed);
    else if (this.pos.y > height - margin) d = createVector(this.vel.x, -this.maxSpeed);
    if (d) {
      d.setMag(this.maxSpeed);
      let s = p5.Vector.sub(d, this.vel);
      s.limit(this.maxForce);
      return s;
    }
    return createVector(0, 0);
  }

  avoid(obstacles) {
    let ahead = this.vel.copy().setMag(70).add(this.pos);
    let ahead2 = this.vel.copy().setMag(35).add(this.pos);
    let threat = null;
    let minD = Infinity;
    for (let obs of obstacles) {
      let d1 = p5.Vector.dist(ahead, obs.pos);
      let d2 = p5.Vector.dist(ahead2, obs.pos);
      let d3 = p5.Vector.dist(this.pos, obs.pos);
      if ((d1 < obs.r || d2 < obs.r || d3 < obs.r) && d3 < minD) {
        minD = d3;
        threat = obs;
      }
    }
    if (threat) {
      let a = p5.Vector.sub(ahead, threat.pos);
      a.setMag(this.maxSpeed);
      a.sub(this.vel);
      a.limit(this.maxForce * 3);
      return a;
    }
    return createVector(0, 0);
  }

  // ============================================
  // Physique
  // ============================================
  applyForce(f) { this.acc.add(f); }

  update() {
    if (this.speedBoostTimer > 0) {
      this.speedBoostTimer--;
      this.maxSpeed = this.baseMaxSpeed * 1.7;
    } else {
      this.maxSpeed = this.baseMaxSpeed;
    }

    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.mult(0);

    this.trail.push(this.pos.copy());
    if (this.trail.length > 20) this.trail.shift();
  }

  edges() {
    if (this.pos.x > width) this.pos.x = 0;
    if (this.pos.x < 0) this.pos.x = width;
    if (this.pos.y > height) this.pos.y = 0;
    if (this.pos.y < 0) this.pos.y = height;
  }

  // ============================================
  // Affichage avec traînée néon
  // ============================================
  show() {
    push();
    noFill();
    for (let i = 0; i < this.trail.length; i++) {
      let t = this.trail[i];
      let alpha = map(i, 0, this.trail.length, 0, 120);
      let w = map(i, 0, this.trail.length, 1, 8);
      stroke(red(this.color), green(this.color), blue(this.color), alpha);
      strokeWeight(w);
      point(t.x, t.y);
    }
    pop();

    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());

    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), 40);
    circle(0, 0, this.r * 4);

    fill(20, 20, 40);
    stroke(this.color);
    strokeWeight(2.5);
    triangle(
      this.r * 1.8, 0,
      -this.r, -this.r * 0.9,
      -this.r, this.r * 0.9
    );

    noStroke();
    let reactIntensity = this.speedBoostTimer > 0 ? 1.5 : 1;
    fill(0, 220, 255, 200);
    triangle(
      -this.r * 1.1, -3 * reactIntensity,
      -this.r * 1.1, 3 * reactIntensity,
      -this.r * (2.2 + random(6)) * reactIntensity, 0
    );

    fill(255, 255, 255, 200);
    circle(this.r * 0.5, 0, 5);

    pop();
  }
}