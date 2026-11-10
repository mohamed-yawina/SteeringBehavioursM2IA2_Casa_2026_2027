import { Vehicle } from '../core/courseVehicle.js';

export class Poison extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.vel.set(0, 0);
    this.r = 4;
  }
}
