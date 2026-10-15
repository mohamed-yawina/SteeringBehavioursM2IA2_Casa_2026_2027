// Bouncing-ball exercise entity. Target owns behavior and shared locomotion.
class BouncingBall extends Target {
  constructor(x, y, speed = 4) {
    super(x, y, 'basic');
    this.r = 10;
    this.maxSpeed = speed;
    this.baseMaxSpeed = speed;
    this.maxForce = 0.35;
    this.color = color(80, 190, 255);
    this.vel = p5.Vector.random2D().mult(speed);
  }

  update(pursuers = [], options = {}) {
    super.update(pursuers, options);
    this.testeCollisionAvecBordsDuCanvas();
  }

  testeCollisionAvecBordsDuCanvas() {
    if (this.pos.x + this.r >= width) {
      this.pos.x = width - this.r;
      if (this.vel.x > 0) this.vel.x = -this.vel.x;
    }
    if (this.pos.x - this.r <= 0) {
      this.pos.x = this.r;
      if (this.vel.x < 0) this.vel.x = -this.vel.x;
    }
    if (this.pos.y + this.r >= height) {
      this.pos.y = height - this.r;
      if (this.vel.y > 0) this.vel.y = -this.vel.y;
    }
    if (this.pos.y - this.r <= 0) {
      this.pos.y = this.r;
      if (this.vel.y < 0) this.vel.y = -this.vel.y;
    }
  }
}
