class Obstacle extends Vehicle {
  constructor(x, y, r, couleur) {
    super(x, y, { r, isStatic: true });
    this.color = couleur;
  }

  show() {
    push();
    fill(this.color);
    stroke(0)
    strokeWeight(3);
    ellipse(this.pos.x, this.pos.y, this.r * 2);
    fill(0);
    ellipse(this.pos.x, this.pos.y, 10);
    pop();
  }
}
