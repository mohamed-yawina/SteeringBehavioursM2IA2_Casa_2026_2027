// =====================================================================
// Predator — sous-classe de Vehicle (exigence page 52 du cours).
// Utilise son BehaviorManager pour chasser + wander.
// =====================================================================
class Predator extends Vehicle {
  constructor(x, y, level = 1) {
    super(x, y, null, 1, {
      r: 9 + level * 1.2,
      maxSpeed: 3.6 + level * 0.25,
      maxForce: 0.18 + level * 0.02,
    });
    this.perception = 170 + level * 15;
    this.energy = 1;
    this.level = level;
    this.dna = null;      // pas d'ADN évolutif côté prédateur
    this.color = color(255, 160, 30);

    // --- BehaviorManager branché ---
    this.behaviors
      .add('pursue', Behaviors.pursuePrey(this), 1)
      .add('wander', Behaviors.wander(this), 0.7)
      .add('boundaries', Behaviors.boundaries(this), 1.5);
    // wander désactivé par défaut : activé dynamiquement si pas de cible
  }

  hunt(prey) {
    // Comportement dynamique : si proie détectée → pursue, sinon wander
    const target = prey.find(p => p5.Vector.dist(this.pos, p.pos) < this.perception);
    if (target) {
      this.behaviors.deactivate('wander').activate('pursue');
    } else {
      this.behaviors.activate('wander').deactivate('pursue');
    }

    // Capture directe
    let kills = 0;
    for (let i = prey.length - 1; i >= 0; i--) {
      const d = this.pos.dist(prey[i].pos);
      if (d < this.r + prey[i].r) {
        if (prey[i].shield > 0) {
          prey[i].shield = 0; this.energy -= 0.15;
          prey.splice(i, 1); game.score += 5;
        } else {
          prey.splice(i, 1);
          this.energy = min(1, this.energy + 0.45);
          kills++; game.score = max(0, game.score - 3);
        }
      }
    }
    return kills;
  }

  update() {
    super.update();
    this.energy -= 0.0008;
  }

  dead() { return this.energy <= 0; }

  display() {
    push();
    translate(this.pos.x, this.pos.y);
    if (CFG.debug) {
      noFill(); stroke(255, 170, 40, 80);
      circle(0, 0, this.perception * 2);
    }
    rotate(this.vel.heading());
    const a = map(this.energy, 0, 1, 110, 255);
    noStroke(); fill(255, 150, 20, 40); circle(0, 0, this.r * 4);
    fill(255, 160, 30, a); stroke(255, 210, 120, a); strokeWeight(1);
    beginShape();
    vertex(this.r * 1.5, 0);
    vertex(-this.r, -this.r);
    vertex(-this.r * 0.4, 0);
    vertex(-this.r, this.r);
    endShape(CLOSE);
    if (this.level > 1) {
      pop(); push();
      translate(this.pos.x, this.pos.y - this.r * 2 - 4);
      noStroke(); fill(255, 170, 40, 200);
      textAlign(CENTER, CENTER); textSize(9);
      text('Lv' + this.level, 0, 0);
    }
    pop();
  }
}