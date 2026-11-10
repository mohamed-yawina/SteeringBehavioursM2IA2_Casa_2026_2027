import { Vehicle } from '../core/courseVehicle.js';

export class ProtectionZone extends Vehicle {
  constructor(x, y, radius, expiresAt) {
    super(x, y);
    this.vel.set(0, 0);
    this.radius = radius;
    this.expiresAt = expiresAt;
  }

  contains(position, time) {
    return time < this.expiresAt && this.pos.dist(position) < this.radius;
  }
}
