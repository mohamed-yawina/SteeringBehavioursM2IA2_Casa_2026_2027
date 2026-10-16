class Obstacle extends Vehicle {
  constructor(x, y, r, couleur) {
    super(x,y);
    this.maxSpeed=0;this.maxForce=0;
    this.r = r;
    this.color = couleur;
  }

  setGeometry(x,y,radius) {
    if(!finitePoint({x,y})||!Number.isFinite(radius)||radius<0||radius>250)return false;
    this.pos.set(x,y);this.r=radius;return true;
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