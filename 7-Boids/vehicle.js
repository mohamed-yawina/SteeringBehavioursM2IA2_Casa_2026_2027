// Shared physical state and locomotion for visible entities in TD7.
// Behaviors and rendering remain the responsibility of subclasses.
class Vehicle {
  constructor(x, y, {
    maxSpeed = 0,
    maxForce = 0,
    r = 0,
    isStatic = false
  } = {}) {
    const finiteCoordinate = value => Number.isFinite(value) ? value : 0;
    const finiteNonNegative = value =>
      Number.isFinite(value) ? Math.max(0, value) : 0;

    this.pos = createVector(finiteCoordinate(x), finiteCoordinate(y));
    this.vel = createVector(0, 0);
    this.acc = createVector(0, 0);
    this.maxSpeed = finiteNonNegative(maxSpeed);
    this.maxForce = finiteNonNegative(maxForce);
    this.r = finiteNonNegative(r);
    this.isStatic = isStatic === true;
  }

  applyForce(force) {
    if (this.isStatic || !force) return;

    const forceX = force.x;
    const forceY = force.y;
    const forceZ = force.z === undefined ? 0 : force.z;
    if (!Number.isFinite(forceX) || !Number.isFinite(forceY) || !Number.isFinite(forceZ)) {
      return;
    }

    const nextX = this.acc.x + forceX;
    const nextY = this.acc.y + forceY;
    const nextZ = this.acc.z + forceZ;
    if (!Number.isFinite(nextX) || !Number.isFinite(nextY) || !Number.isFinite(nextZ)) {
      return;
    }

    // set() writes the accumulated result without mutating the supplied force.
    this.acc.set(nextX, nextY, nextZ);
  }

  update() {
    if (this.isStatic) return;

    // Preserve the historical TD7 integration order exactly.
    this.pos.add(this.vel);
    this.vel.add(this.acc);
    this.vel.limit(this.maxSpeed);
    this.acc.mult(0);
  }
}
