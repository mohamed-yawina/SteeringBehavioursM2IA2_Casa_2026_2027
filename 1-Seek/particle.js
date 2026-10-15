// ============================================
// Classe Particle - effets visuels
// ============================================
class Particle extends Vehicle {
  constructor(x, y, color, speed = 1) {
    super(x, y);
    this.vel = p5.Vector.random2D().mult(random(1, 5) * speed);
    // Les explosions peuvent dépasser le maxSpeed d'un véhicule classique.
    this.maxSpeed = Infinity;
    this.life = 255;
    this.color = color;
    this.size = random(2, 5);
  }

  update() {
    super.update();
    this.vel.mult(0.95);
    this.life -= 8;
  }

  show() {
    noStroke();
    let c = color(red(this.color), green(this.color), blue(this.color), this.life);
    fill(c);
    circle(this.pos.x, this.pos.y, this.size);
  }

  isDead() {
    return this.life <= 0;
  }
}

// Crée une explosion normale
function createExplosion(x, y, color, count = 15) {
  for (let i = 0; i < count; i++) {
    particles.push(new Particle(x, y, color));
  }
}

// Crée une explosion massive (bombe)
function createBigExplosion(x, y, color, count = 60) {
  for (let i = 0; i < count; i++) {
    let p = new Particle(x, y, color);
    p.vel.mult(2.5);
    p.size = random(4, 10);
    particles.push(p);
  }
}
