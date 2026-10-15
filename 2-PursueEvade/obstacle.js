// Static collision entity: Vehicle supplies the shared p5.Vector state.
class Obstacle extends Vehicle {
  constructor(x, y, radius = 40) {
    super(x, y);
    this.r = radius;
  }
}
