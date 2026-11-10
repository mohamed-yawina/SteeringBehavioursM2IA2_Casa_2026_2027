// =====================================================================
// PowerUp — sous-classe de Vehicle (objet animé, donc Vehicle mère).
// Utilise ARRIVE (comportement vu page 22) pour flotter vers le doyen.
// =====================================================================
class PowerUp extends Vehicle {
  constructor(x, y, type) {
    super(x, y, null, 1, { r: 12, maxSpeed: 1, maxForce: 0.05 });
    this.type = type;      // 'shield' | 'energy' | 'speed'
    this.life = 600;
    this.age = 0;
    this.dna = null;
    this.color = type === 'shield' ? color(110, 200, 255)
               : type === 'energy' ? color(110, 240, 176)
                                   : color(255, 220, 60);

    // Comportement ARRIVE vers le doyen (si présent)
    this.behaviors.add('arrive', (ctx) => {
      const champ = ctx.champion;
      if (!champ) return createVector(0, 0);
      return this.arrive(champ.pos, 60, 20);
    }, 0.5);

    // Flottement wander subtil
    this._theta = { theta: random(TWO_PI) };
    this.behaviors.add('wander', (ctx) => this.wander(this._theta, 30, 15, 0.1), 0.3);
  }

  update() {
    super.update();
    this.age++;
  }
  dead() { return this.age > this.life; }

  display() {
    push();
    translate(this.pos.x, this.pos.y);
    const pulse = 1 + 0.15 * sin(frameCount * 0.15 + this.age * 0.05);
    noFill(); strokeWeight(2); stroke(this.color);
    circle(0, 0, this.r * 2 * pulse);
    noStroke(); fill(this.color);
    circle(0, 0, 6);
    pop();
  }
}