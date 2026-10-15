// ============================================
// Classe Target - ENNEMI
// Sous-classe de Vehicle : hérite de la physique et des comportements
// ============================================
class Target extends Vehicle {
  constructor(x, y, type = 'basic') {
    // --- Configure les options selon le type ---
    let options = {
      maxSpeed: 3,
      maxForce: 0.3,
      r: 14,
      health: 30,
      color: color(220, 60, 60)
    };

    if (type === 'fast') {
      options = {
        maxSpeed: 5,
        maxForce: 0.4,
        r: 10,
        health: 15,
        color: color(255, 200, 50)
      };
    } else if (type === 'tank') {
      options = {
        maxSpeed: 1.5,
        maxForce: 0.15,
        r: 22,
        health: 80,
        color: color(150, 60, 220)
      };
    } else if (type === 'sniper') {
      options = {
        maxSpeed: 2,
        maxForce: 0.2,
        r: 16,
        health: 40,
        color: color(80, 220, 220)
      };
    } else if (type === 'kamikaze') {
      options = {
        maxSpeed: 7,
        maxForce: 1,
        r: 12,
        health: 10,
        color: color(255, 100, 40)
      };
    } else if (type === 'splitter') {
      options = {
        maxSpeed: 2.5,
        maxForce: 0.3,
        r: 18,
        health: 50,
        color: color(100, 255, 100)
      };
    }

    super(x, y, options);

    this.type = type;
    this.pulse = random(TWO_PI);
    this.vel = p5.Vector.random2D().mult(random(1, 2));
    this.shootTimer = 0;
  }

  // --- Update spécifique par type ---
  update(vehicles) {
    let closest = null;
    let minDist = 200;
    for (let v of vehicles) {
      let d = p5.Vector.dist(this.pos, v.pos);
      if (d < minDist) {
        minDist = d;
        closest = v;
      }
    }

    if (closest) {
      if (this.type === 'kamikaze') {
        // Kamikaze : PURSUE le joueur
        let force = this.pursue(closest, 10);
        this.applyForce(force);
      } else if (this.type === 'sniper') {
        // Sniper : garde ses distances
        let d = p5.Vector.dist(this.pos, closest.pos);
        if (d < 250) {
          let force = this.flee(closest.pos);
          this.applyForce(force);
        }
        // Tire sur le joueur
        this.shootTimer++;
        if (this.shootTimer >= 90 && d < 500) {
          let dir = p5.Vector.sub(closest.pos, this.pos).normalize();
          let speed = 6;
          projectiles.push(new Projectile(
            this.pos.x, this.pos.y,
            dir.x * speed, dir.y * speed,
            8
          ));
          this.shootTimer = 0;
        }
      } else {
        // Comportement par défaut : FLEE
        let force = this.flee(closest.pos);
        this.applyForce(force);
      }
    }

    // La locomotion reste celle de Vehicle ; Target ne garde que ses rebonds.
    super.update();

    // Rebonds sur les bords
    if (this.pos.x < this.r || this.pos.x > width - this.r) this.vel.x *= -1;
    if (this.pos.y < this.r || this.pos.y > height - this.r) this.vel.y *= -1;

    this.pos.x = constrain(this.pos.x, this.r, width - this.r);
    this.pos.y = constrain(this.pos.y, this.r, height - this.r);
  }

  // --- Divise en 2 mini-ennemis (splitter) ---
  split() {
    for (let i = 0; i < 2; i++) {
      let angle = random(TWO_PI);
      let offset = createVector(cos(angle) * 20, sin(angle) * 20);
      let mini = new Target(
        this.pos.x + offset.x,
        this.pos.y + offset.y,
        'fast'
      );
      mini.health = 10;
      mini.maxHealth = 10;
      mini.r = 8;
      enemies.push(mini);
    }
  }

  // --- Affichage ---
  show() {
    push();
    translate(this.pos.x, this.pos.y);

    this.pulse += 0.1;
    let pulseSize = sin(this.pulse) * 4;

    // Halo
    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), 60);
    circle(0, 0, (this.r + pulseSize) * 2.5);

    // Corps
    fill(this.color);
    stroke(255);
    strokeWeight(2);
    circle(0, 0, this.r * 2);

    // Symbole selon le type
    stroke(255);
    strokeWeight(2);
    if (this.type === 'kamikaze') {
      // Étoile (kamikaze)
      line(-this.r * 0.6, 0, this.r * 0.6, 0);
      line(0, -this.r * 0.6, 0, this.r * 0.6);
      line(-this.r * 0.4, -this.r * 0.4, this.r * 0.4, this.r * 0.4);
      line(-this.r * 0.4, this.r * 0.4, this.r * 0.4, -this.r * 0.4);
    } else if (this.type === 'sniper') {
      // Cercle (sniper)
      noFill();
      circle(0, 0, this.r * 0.9);
      line(-this.r * 0.6, 0, this.r * 0.6, 0);
      line(0, -this.r * 0.6, 0, this.r * 0.6);
    } else if (this.type === 'splitter') {
      // Deux cercles (splitter)
      noFill();
      circle(-this.r * 0.3, 0, this.r * 0.5);
      circle(this.r * 0.3, 0, this.r * 0.5);
    } else {
      // Croix par défaut
      line(-this.r * 0.5, -this.r * 0.5, this.r * 0.5, this.r * 0.5);
      line(-this.r * 0.5, this.r * 0.5, this.r * 0.5, -this.r * 0.5);
    }

    // Barre de vie
    if (this.health < this.maxHealth) {
      noStroke();
      fill(0, 0, 0, 150);
      rect(-this.r, -this.r - 10, this.r * 2, 4, 2);
      fill(80, 220, 100);
      rect(-this.r, -this.r - 10, this.r * 2 * (this.health / this.maxHealth), 4, 2);
    }

    pop();
  }

  takeDamage(amount) {
    this.health -= amount;
    return this.health <= 0;
  }
}
