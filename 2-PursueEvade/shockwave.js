// Static origin; only the visual radius and lifetime change.
class Shockwave extends Vehicle {
  constructor(x, y, color, maxR = 100) {
    super(x, y);
    this.r = 5;
    this.maxR = maxR;
    this.color = color;
    this.life = 255;
  }

  update() {
    this.r += 8;
    this.life -= 10;
  }

  show() {
    let alpha = map(this.life, 0, 255, 0, 255);
    noFill();
    stroke(red(this.color), green(this.color), blue(this.color), alpha);
    strokeWeight(3);
    circle(this.pos.x, this.pos.y, this.r * 2);
  }

  isDead() { return this.life <= 0 || this.r > this.maxR; }
}
