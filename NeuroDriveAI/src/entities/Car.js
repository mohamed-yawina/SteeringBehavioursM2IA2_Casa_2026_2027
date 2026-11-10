import { Vehicle } from '../core/Vehicle.js';
import { finite, positive } from '../math/vector.js';
import { manualSteering } from '../controls/manualSteering.js';
import { SensorSystem } from '../sensors/SensorSystem.js';

export class Car extends Vehicle {
  constructor(options = {}) {
    super(options);
    this.length = positive(options.length ?? 26, 'length');
    this.width = positive(options.width ?? 14, 'width');
    this.collisionRadius = Math.hypot(this.length, this.width) / 2;
    this.wheelbase = positive(options.wheelbase ?? 24, 'wheelbase');
    this.maxSteeringAngle = positive(options.maxSteeringAngle ?? 0.55, 'maxSteeringAngle');
    if (this.maxSteeringAngle >= Math.PI / 2) throw new RangeError('Steering angle must be below pi/2');
    this.steeringAngle = 0;
    this.sensors = new SensorSystem(options.sensors);
  }

  control(input, dt) {
    finite(dt, 'dt');
    if (dt <= 0 || dt > 0.1) throw new RangeError('Control dt must be in (0, 0.1]');
    if (!this.active) return;
    const result = manualSteering(this, input, dt);
    this.steeringAngle = result.steeringAngle;
    this.applyForce(result.force);
  }
}
