import { Vector, positive, finite, point } from '../math/vector.js';
import { raySegment } from '../math/geometry.js';

export class SensorSystem {
  constructor({ range = 190, angles = [-90, -60, -30, 0, 30, 60, 90].map(a => a * Math.PI / 180) } = {}) {
    this.range = positive(range, 'range');
    if (!Array.isArray(angles) || angles.length === 0) throw new RangeError('At least one sensor is required');
    this.angles = angles.map(angle => finite(angle, 'sensor angle'));
    this.readings = [];
  }

  scan(position, orientation, walls) {
    position = point(position); finite(orientation, 'orientation');
    this.readings = this.angles.map(angle => {
      const direction = Vector.fromAngle(orientation + angle);
      let distance = this.range, hit = false;
      for (const wall of walls) {
        const d = raySegment(position, direction, wall.a, wall.b, this.range);
        if (d !== null && d <= distance) { distance = d; hit = true; }
      }
      return { distance, proximity: 1 - distance / this.range, hit,
        end: position.copy().add(direction.mult(distance)) };
    });
    return this.readings;
  }
}
