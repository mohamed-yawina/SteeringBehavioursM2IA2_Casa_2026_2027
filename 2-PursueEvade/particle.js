// ============================================
// Particules avancées
// ============================================
class Particle extends Vehicle {
  constructor(x, y, color, speed = 1, size = 3) {
    super(x, y);
    // Vehicle.update() owns integration; effects retain their original unbounded speed.
    this.maxSpeed = Infinity;
    this.baseMaxSpeed = Infinity;
    this.vel = p5.Vector.random2D().mult(random(1, 5) * speed);
    this.life = 255;
    this.maxLife = 255;
    this.color = color;
    this.size = random(2, size);
    this.gravity = 0;
  }

  update() {
    super.update();
    // Particle.show() does not render Vehicle trails; discard the inherited sample.
    this.trail.length = 0;
    this.vel.mult(0.94);
    this.vel.y += this.gravity;
    this.life -= 6;
  }

  show() {
    let alpha = map(this.life, 0, this.maxLife, 0, 255);
    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), alpha);
    circle(this.pos.x, this.pos.y, this.size);
  }

  isDead() { return this.life <= 0; }
}

// Onde de choc
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

// Explosion avancée
function explode(x, y, color, count = 20) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color, random(1, 2), 5));
  }
  shockwaves.push(new Shockwave(x, y, color, 120));
}
