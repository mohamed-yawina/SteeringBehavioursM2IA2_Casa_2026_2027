// Cible autonome légère, Vehicle fournit état, applyForce, update et rendu de base.
class LabTarget extends Vehicle {
  constructor(x, y, randomFn = random) {
    // Paramètres fixés ici pour rester compatible avec les deux signatures de Vehicle.
    super(x, y);
    this.maxSpeed = 1.35;
    this.maxForce = 0.025;
    this.baseMaxSpeed = this.maxSpeed;
    this.r = 10;
    this.color = color(255, 173, 105);
    this.vel = p5.Vector.random2D().mult(randomFn(0.55, this.maxSpeed));
    this.randomFn = randomFn;
    this.turnIn = 0;
  }

  step(width, height) {
    // Petite dérive stochastique continue : pas de téléportation ni de trajectoire imposée.
    if (this.turnIn-- <= 0) {
      this.applyForce(p5.Vector.random2D().mult(this.maxForce));
      this.turnIn = 20 + Math.floor(this.randomFn(0, 35));
    }
    this.update();
    if (this.pos.x < this.r || this.pos.x > width - this.r) this.vel.x *= -1;
    if (this.pos.y < this.r || this.pos.y > height - this.r) this.vel.y *= -1;
    this.pos.x = constrain(this.pos.x, this.r, width - this.r);
    this.pos.y = constrain(this.pos.y, this.r, height - this.r);
  }

  placeRandomly(width, height) {
    this.pos.set(this.randomFn(this.r, Math.max(this.r, width - this.r)), this.randomFn(this.r, Math.max(this.r, height - this.r)));
    this.vel = p5.Vector.random2D().mult(this.randomFn(0.55, this.maxSpeed));
  }

  show() {
    push(); noFill(); stroke(255, 173, 105, 55); strokeWeight(1); circle(this.pos.x, this.pos.y, this.r * 4);
    noStroke(); fill(255, 173, 105, 35); circle(this.pos.x, this.pos.y, this.r * 2.8);
    fill(255, 190, 125); stroke(255, 238, 208); strokeWeight(1.5); circle(this.pos.x, this.pos.y, this.r * 1.25); pop();
  }
}
