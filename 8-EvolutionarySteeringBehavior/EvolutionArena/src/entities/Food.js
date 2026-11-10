import { Vehicle } from '../core/courseVehicle.js';

export class Food extends Vehicle {
  constructor(x, y) {
    super(x, y);
    this.vel.set(0, 0);
    this.r = 3;
  }
}
