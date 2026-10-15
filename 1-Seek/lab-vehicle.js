// Agent du laboratoire : la décision de direction reste distincte de la locomotion héritée.
class LabVehicle extends Vehicle {
  constructor(x, y) {
    // Ne dépend pas de l'extension d'options présente dans la version Swarm de Vehicle.
    super(x, y);
    this.maxSpeed = 4;
    this.maxForce = 0.1;
    this.r = 7;
    this.color = color(118, 169, 255);
    this.trail = [];
    this.vectors = { desired: createVector(0, 0), velocity: createVector(0, 0), steering: createVector(0, 0), distance: 0, origin: this.pos.copy(), target: this.pos.copy(), visible: false };
  }

  calculateSteering(target, behavior, detectionRadius = Infinity) {
    const targetPosition = target.copy();
    const toward = p5.Vector.sub(targetPosition, this.pos);
    const distance = toward.mag();
    // Flee ne réagit que dans son voisinage de perception, comme une règle locale.
    if (behavior === 'flee' && distance > detectionRadius) {
      const currentVelocity = this.vel.copy();
      this.vectors = { desired: currentVelocity.copy(), velocity: currentVelocity, steering: createVector(0, 0), distance, origin: this.pos.copy(), target: targetPosition, visible: true };
      return createVector(0, 0);
    }
    const desired = distance > 0 ? toward.setMag(this.maxSpeed) : createVector(0, 0);
    if (behavior === 'flee') desired.mult(-1);
    const currentVelocity = this.vel.copy();
    const steering = p5.Vector.sub(desired, currentVelocity).limit(this.maxForce);
    this.vectors = { desired: desired.copy(), velocity: currentVelocity, steering: steering.copy(), distance, origin: this.pos.copy(), target: targetPosition, visible: true };
    return steering;
  }

  step(target, behavior, bounds, keepTrail, detectionRadius = Infinity) {
    this.applyForce(this.calculateSteering(target, behavior, detectionRadius));
    this.update();
    const crossedEdge = this.wrap(bounds.width, bounds.height);
    if (crossedEdge) this.trail.length = 0;
    if (keepTrail) {
      this.trail.push(this.pos.copy());
      if (this.trail.length > 45) this.trail.shift();
    } else if (this.trail.length) this.trail.length = 0;
  }

  wrap(width, height) {
    const beforeX = this.pos.x, beforeY = this.pos.y;
    if (this.pos.x > width + this.r) this.pos.x = -this.r;
    else if (this.pos.x < -this.r) this.pos.x = width + this.r;
    if (this.pos.y > height + this.r) this.pos.y = -this.r;
    else if (this.pos.y < -this.r) this.pos.y = height + this.r;
    return this.pos.x !== beforeX || this.pos.y !== beforeY;
  }

  clearSample() {
    this.vectors = { desired: createVector(0, 0), velocity: this.vel.copy(), steering: createVector(0, 0), distance: 0, origin: this.pos.copy(), target: this.pos.copy(), visible: false };
  }
}
