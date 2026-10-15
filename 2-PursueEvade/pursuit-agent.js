// Laboratory agent: Vehicle remains responsible for steering and locomotion.
// This subclass exposes the exact vectors used by the lab visualizations.
class PursuitAgent extends Vehicle {
  predictedPosition(target, predictionFrames) {
    const frames = Number.isFinite(predictionFrames) ? predictionFrames : 0;
    return p5.Vector.add(target.pos, p5.Vector.mult(target.vel, frames));
  }

  steer(behavior, target, predictionFrames = 10) {
    const origin = this.pos.copy();
    const velocity = this.vel.copy();
    const future = behavior === 'pursuit' || behavior === 'evade'
      ? this.predictedPosition(target, predictionFrames)
      : null;
    const goal = future || (target.pos ? target.pos.copy() : target.copy());
    const fleeing = behavior === 'flee' || behavior === 'evade';
    const desiredVelocity = p5.Vector.sub(goal, origin);
    if (fleeing) desiredVelocity.mult(-1);
    if (desiredVelocity.mag() > 0) desiredVelocity.setMag(this.maxSpeed);

    let force;
    switch (behavior) {
      case 'seek': force = this.seek(goal); break;
      case 'pursuit': force = this.pursue(target, predictionFrames); break;
      case 'flee': force = this.flee(goal); break;
      case 'evade': force = this.evade(target, predictionFrames); break;
      default: throw new RangeError(`Unknown steering behavior: ${behavior}`);
    }

    this.lastSteering = {
      behavior, origin, velocity, desiredVelocity, force: force.copy(),
      goal: goal.copy(), predictedPosition: future && future.copy(),
      distance: p5.Vector.dist(origin, goal),
    };
    return force;
  }
}
