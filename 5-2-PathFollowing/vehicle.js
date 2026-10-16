// Path Following (Path Following)
// The Nature of Code
// The Coding Train / Daniel Shiffman
// https://youtu.be/LrnR6dc2IfM
// https://thecodingtrain.com/learning/nature-of-code/5.7-path-following.html

// Path Following: https://editor.p5js.org/codingtrain/sketches/dqM054vBV
// Complex Path: https://editor.p5js.org/codingtrain/sketches/2FFzvxwVt

// Project point a onto the infinite line from pos toward b; null if undefined.
function findProjection(pos, a, b) {
  const finite = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
  if (![pos, a, b].every(finite)) return null;
  let v1 = p5.Vector.sub(a, pos);
  let v2 = p5.Vector.sub(b, pos);
  if (![v1, v2].every(finite) || v2.mag() === 0 || !Number.isFinite(v2.mag())) return null;
  v2.normalize();
  let sp = v1.dot(v2);
  v2.mult(sp);
  v2.add(pos);
  return finite(v2) ? v2 : null;
}

class Vehicle {
  constructor(x, y) {
    this.pos = createVector(x, y);
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = 6;
    this.maxForce = 0.1;
    this.r = 16;
    this.predictionSteps = 20;
    this.followDiagnostics = null;
  }

  follow(path) {
    const finite = point => point && Number.isFinite(point.x) && Number.isFinite(point.y);
    const validInputs = [this.pos, this.vel, path?.start, path?.end].every(finite) &&
      Number.isFinite(path?.radius) && path.radius >= 0 &&
      Number.isFinite(this.predictionSteps) && this.predictionSteps >= 0 &&
      Number.isFinite(this.maxSpeed) && this.maxSpeed >= 0 && Number.isFinite(this.maxForce) && this.maxForce >= 0;
    let future = null, target = null, distance = null, active = false;
    let force = createVector(0, 0), status = 'invalid';
    if (validInputs) {
      future = this.vel.copy();
      future.mult(this.predictionSteps);
      future.add(this.pos);
      target = findProjection(path.start, future, path.end);
      status = target ? 'defined' : finite(future) && path.start.x === path.end.x && path.start.y === path.end.y ? 'undefined' : 'invalid';
      if (target) {
        distance = p5.Vector.dist(future, target);
        if (Number.isFinite(distance)) {
          active = distance > path.radius;
          if (active) force = this.seek(target);
          if (!finite(force)) { force = createVector(0, 0); status = 'invalid'; active = false; }
        } else { status = 'invalid'; target = null; distance = null; }
      }
    }
    this.followDiagnostics = {
      status, active,
      origin: finite(this.pos) ? this.pos.copy() : null,
      velocity: finite(this.vel) ? this.vel.copy() : null,
      start: finite(path?.start) ? path.start.copy() : null,
      end: finite(path?.end) ? path.end.copy() : null,
      future: finite(future) ? future.copy() : null,
      target: target ? target.copy() : null,
      distance, radius: validInputs ? path.radius : null,
      predictionSteps: validInputs ? this.predictionSteps : null, force: force.copy()
    };
    return force;
  }

  copyFollowDiagnostics() {
    if (!this.followDiagnostics) return null;
    return Object.fromEntries(Object.entries(this.followDiagnostics).map(([key, value]) =>
      [key, value && typeof value.copy === 'function' ? value.copy() : value]));
  }

  seek(target, arrival = false) {
    let force = p5.Vector.sub(target, this.pos);
    let desiredSpeed = this.maxSpeed;
    if (arrival) {
      let slowRadius = 100;
      let distance = force.mag();
      if (distance < slowRadius) {
        desiredSpeed = map(distance, 0, slowRadius, 0, this.maxSpeed);
      }
    }
    force.setMag(desiredSpeed);
    force.sub(this.vel);
    force.limit(this.maxForce);
    return force;
  }

  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    this.acc.set(0, 0);
  }

  show() {
    stroke(255);
    strokeWeight(2);
    fill(255);
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.vel.heading());
    triangle(-this.r, -this.r / 2, -this.r, this.r / 2, this.r, 0);
    pop();
  }

  edges() {
    if (this.pos.x > width + this.r) {
      this.pos.x = -this.r;
    } else if (this.pos.x < -this.r) {
      this.pos.x = width + this.r;
    }
    if (this.pos.y > height + this.r) {
      this.pos.y = -this.r;
    } else if (this.pos.y < -this.r) {
      this.pos.y = height + this.r;
    }
  }
}
