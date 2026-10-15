// Obstacle statique de l'arène, avec l'état commun fourni par Vehicle.
// Il n'exécute pas update() : aucune locomotion n'est appliquée aux obstacles.
class Obstacle extends Vehicle {
  constructor(x, y, radius = 40) {
    super(x, y, { r: radius });
    this.r = radius;
  }
}
