import { Vector, finite, clamp } from '../math/vector.js';

// Pure controller: returns a bounded force, never moves the entity.
export function manualSteering(car, input = {}, dt) {
  const throttle = clamp(finite(input.throttle ?? 0, 'throttle'), 0, 1);
  const brake = clamp(finite(input.brake ?? 0, 'brake'), 0, 1);
  const steeringAngle = clamp(finite(input.steer ?? 0, 'steer'), -1, 1) * car.maxSteeringAngle;
  const speed = car.speed;
  const desiredSpeed = brake > 0
    ? Math.max(0, speed - car.maxAcceleration * brake * dt)
    : clamp(speed + (throttle * car.maxAcceleration - 0.3 * speed) * dt, 0, car.maxSpeed);
  const desiredHeading = car.orientation + (speed / car.wheelbase) * Math.tan(steeringAngle) * dt;
  const desiredVelocity = Vector.fromAngle(desiredHeading).mult(desiredSpeed);
  // Desired-current velocity converted to acceleration for a seconds-based step.
  const force = Vector.sub(desiredVelocity, car.velocity).div(dt).limit(car.maxForce);
  return { force, steeringAngle };
}
