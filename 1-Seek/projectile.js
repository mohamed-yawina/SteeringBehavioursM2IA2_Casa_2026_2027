// ============================================
// Classe Projectile - MISSILE DU BOSS
// Sous-classe de Vehicle : peut utiliser seek() pour missile à tête chercheuse
// ============================================
class Projectile extends Vehicle {
  constructor(x, y, vx, vy, damage = 10, homing = false) {
    super(x, y, {
      maxSpeed: 10,
      maxForce: 0.3,
      r: 8,
      color: color(255, 80, 80)
    });

    this.vel = createVector(vx, vy);
    this.acc = createVector(0, 0);
    this.damage = damage;
    this.life = 300;
    this.trail = [];
    this.homing = homing;
  }

  // Redéfinit update() pour inclure le seek si missile guidé
  update(target) {
    // Traînée visuelle
    this.trail.push(this.pos.copy());
    if (this.trail.length > 8) this.trail.shift();

    // Missile à tête chercheuse (utilise SEEK hérité de Vehicle)
    if (this.homing && target) {
      let force = this.seek(target.pos);
      this.applyForce(force);
    }

    // La locomotion et la limitation de vitesse sont centralisées dans Vehicle.
    super.update();

    this.life--;

    // Sortie d'écran
    if (this.pos.x < -50 || this.pos.x > width + 50 ||
        this.pos.y < -50 || this.pos.y > height + 50) {
      this.life = 0;
    }
  }

  // Redéfinit show() : cercle + traînée au lieu d'un triangle
  show() {
    push();
    noStroke();
    // Traînée
    for (let i = 0; i < this.trail.length; i++) {
      let t = this.trail[i];
      let alpha = map(i, 0, this.trail.length, 0, 150);
      fill(red(this.color), green(this.color), blue(this.color), alpha);
      circle(t.x, t.y, this.r * 0.8);
    }

    // Corps
    fill(this.color);
    stroke(255);
    strokeWeight(1.5);
    circle(this.pos.x, this.pos.y, this.r * 2);

    // Halo
    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), 80);
    circle(this.pos.x, this.pos.y, this.r * 3);

    pop();
  }

  collidesWith(entity) {
    return p5.Vector.dist(this.pos, entity.pos) < this.r + entity.r;
  }

  isDead() {
    return this.life <= 0;
  }
}

let projectiles = [];
