import { vec, point, positive, finite, clamp, angleWrap } from '../math/vector.js';
import { at } from '../math/geometry.js';

// New independent locomotion base, not a copy of the teaching Vehicle.
// Units: world pixels, seconds, unit mass. Only this class integrates movement.
export class Vehicle {
  constructor({ position = vec(), orientation = 0, maxSpeed = 220, maxAcceleration = 160 } = {}) {
    this.position = point(position);
    this.previousPosition = this.position.copy();
    this.velocity = vec();
    this.acceleration = vec();
    this.orientation = angleWrap(finite(orientation, 'orientation'));
    this.maxSpeed = positive(maxSpeed, 'maxSpeed');
    this.maxAcceleration = positive(maxAcceleration, 'maxAcceleration');
    this.maxForce = this.maxAcceleration;
    this.active = true;
    this.crashed = false;
    this.distanceTravelled = 0;
  }

  get speed() { return this.velocity.mag(); }

  applyForce(force) {
    if (!this.active) return;
    this.acceleration.add(point(force)).limit(this.maxAcceleration);
  }

  crash() {
    this.active = false;
    this.crashed = true;
    this.velocity.set(0, 0);
    this.acceleration.set(0, 0);
  }

  update(dt, resolveCollision = () => null) {
    finite(dt, 'dt');
    if (dt < 0 || dt > 0.1) throw new RangeError('dt must be between 0 and 0.1 seconds');
    if (!this.active || dt === 0) return;
    point(this.position); point(this.velocity); point(this.acceleration);
    this.previousPosition = this.position.copy();
    this.velocity.add(this.acceleration.copy().limit(this.maxAcceleration).mult(dt)).limit(this.maxSpeed);
    const candidate = this.position.copy().add(this.velocity.copy().mult(dt));
    const contact = resolveCollision(this.position, candidate);
    if (contact !== null && (!Number.isFinite(contact) || contact < 0 || contact > 1)) {
      throw new RangeError('Invalid collision fraction');
    }
    const fraction = contact === null ? 1 : clamp(contact - 1e-7, 0, 1);
    this.position = at(this.position, candidate, fraction);
    this.distanceTravelled += this.position.dist(this.previousPosition);
    if (this.speed > 1e-8) this.orientation = angleWrap(this.velocity.heading());
    this.acceleration.set(0, 0);
    if (contact !== null) this.crash();
  }
}
