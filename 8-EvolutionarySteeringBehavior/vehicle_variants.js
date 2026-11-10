// =====================================================================
// Sous-classes de Vehicle illustrant des COMPORTEMENTS COMPOSÉS.
// =====================================================================

// ---------------------------------------------------------------------
// LeaderVehicle — suit la souris avec ARRIVE et attire les suiveurs.
// ---------------------------------------------------------------------
class LeaderVehicle extends Vehicle {
  constructor(x, y) {
    super(x, y, null, 1, { r: 6, maxSpeed: 5, maxForce: 0.5 });
    this.dna = null;
    this.color = color(255, 220, 100);
    this.behaviors.add('arriveMouse', Behaviors.arriveMouse(this), 1);
    this.behaviors.add('boundaries', Behaviors.boundaries(this), 1.5);
  }
}

// ---------------------------------------------------------------------
// FollowerVehicle — suit un leader avec un comportement COMPOSÉ :
//   arrive derrière le leader + evade si devant + separation.
// ---------------------------------------------------------------------
class FollowerVehicle extends Vehicle {
  constructor(x, y, leader) {
    super(x, y, null, 1, { r: 5, maxSpeed: 4.5, maxForce: 0.4 });
    this.leader = leader;
    this.dna = null;
    this.color = color(110, 200, 255);

    // 1) ARRIVE sur un point DERRIÈRE le leader (offset -30 sur la direction)
    this.behaviors.add('arriveBehind', (ctx) => {
      if (!this.leader) return createVector(0, 0);
      const behind = p5.Vector.sub(this.leader.pos,
        this.leader.vel.copy().setMag(30));
      return this.arrive(behind, 80, 20);
    }, 1);

    // 2) EVADE le leader si on est DEVANT lui (zone de 40 px devant)
    this.behaviors.add('evadeLeader', (ctx) => {
      if (!this.leader) return createVector(0, 0);
      const ahead = p5.Vector.add(this.leader.pos,
        this.leader.vel.copy().setMag(60));
      const d = p5.Vector.dist(this.pos, ahead);
      if (d < 40) return this.flee(ahead);
      return createVector(0, 0);
    }, 1.2);

    // 3) SEPARATION avec les autres suiveurs
    this.behaviors.add('separation', (ctx) => this.separation(ctx.neighbors ?? []), 0.8);

    // 4) BOUNDARIES
    this.behaviors.add('boundaries', Behaviors.boundaries(this), 1.5);
  }
}

// ---------------------------------------------------------------------
// BoidVehicle — boids (flocking) : separation + alignment + cohesion.
// ---------------------------------------------------------------------
class BoidVehicle extends Vehicle {
  constructor(x, y) {
    super(x, y, null, 1, { r: 3, maxSpeed: 4, maxForce: 0.3 });
    this.dna = null;
    this.color = color(110, 240, 176);
    this.behaviors
      .add('separation', (ctx) => this.separation(ctx.neighbors ?? [], 25), 1.5)
      .add('alignment', (ctx) => this.alignment(ctx.neighbors ?? []), 1.0)
      .add('cohesion', (ctx) => this.cohesion(ctx.neighbors ?? []), 0.8)
      .add('boundaries', Behaviors.boundaries(this), 1.5);
  }
}