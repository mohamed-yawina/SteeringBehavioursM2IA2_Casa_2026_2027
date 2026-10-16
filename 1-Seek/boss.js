// ============================================
// Classe Boss - le boss de la vague 10
// ============================================
class Boss extends Vehicle {
  constructor() {
    super(width / 2, -100, { r: 80, color: color(200, 40, 100), maxSpeed: 6, maxForce: 0.4 });
    this.targetY = 200;
    this.r = 80;

    this.maxHealth = 1000;
    this.health = this.maxHealth;

    this.phase = 1;
    this.entering = true;
    this.deathTimer = 0;
    this.isDead = false;

    this.shootTimer = 0;
    this.moveTimer = 0;
    this.spiralAngle = 0;
    this.color = color(200, 40, 100);

    this.hitFlash = 0;
  }

  update(player) {
    // --- Animation de mort ---
    if (this.isDead) {
      this.deathTimer++;
      if (this.deathTimer % 5 === 0 && this.deathTimer < 90) {
        let ex = this.pos.x + random(-this.r, this.r);
        let ey = this.pos.y + random(-this.r, this.r);
        createExplosion(ex, ey, this.color, 15);
      }
      return;
    }

    // --- Phase d'entrée ---
    if (this.entering) {
      const entryTarget = createVector(width / 2, this.targetY);
      this.steerToward(entryTarget, 80);
      if (p5.Vector.dist(this.pos, entryTarget) <= 2 && this.vel.mag() <= 0.25) {
        this.entering = false;
      }
      return;
    }

    // --- Détermine la phase actuelle ---
    let healthRatio = this.health / this.maxHealth;
    const nextPhase = healthRatio > 0.66 ? 1 : healthRatio > 0.33 ? 2 : 3;
    if (nextPhase === 3 && this.phase !== 3) this.holdPosition = this.pos.copy();
    this.phase = nextPhase;

    // --- Comportement selon la phase ---
    if (this.phase === 1) {
      this.updatePhase1(player);
    } else if (this.phase === 2) {
      this.updatePhase2(player);
    } else {
      this.updatePhase3(player);
    }

    if (this.hitFlash > 0) this.hitFlash--;
  }

  updatePhase1(player) {
    this.shootTimer++;

    const targetX = constrain(player.pos.x, this.r + 50, width - this.r - 50);
    // At maxSpeed 6, radius 1200 preserves the old 0.005 proportional response
    // away from the margins, while acceleration now remains force-limited.
    this.steerToward(createVector(targetX, this.targetY), 1200);

    if (this.shootTimer >= 60) {
      this.shootSpread(player, 3, 0.3);
      this.shootTimer = 0;
    }
  }

  updatePhase2(player) {
    this.moveTimer++;
    this.shootTimer++;

    let radius = 150;
    let angle = this.moveTimer * 0.02;
    let centerX = width / 2;
    let centerY = height / 2 - 50;
    const nextX = centerX + cos(angle) * radius;
    const nextY = centerY + sin(angle) * radius * 0.5;
    // The target follows the ellipse; the boss follows it reactively with Seek.
    this.steerToward(createVector(nextX, nextY));

    if (this.shootTimer >= 8) {
      this.spiralAngle += 0.4;
      let vx = cos(this.spiralAngle) * 5;
      let vy = sin(this.spiralAngle) * 5;
      projectiles.push(new Projectile(this.pos.x, this.pos.y, vx, vy));
      this.shootTimer = 0;
    }
  }

  updatePhase3(player) {
    this.moveTimer++;
    this.shootTimer++;

    if (this.moveTimer >= 120) {
      this.teleportForPhaseThree();
      this.moveTimer = 0;
    }

    this.steerToward(this.holdPosition || this.pos.copy(), 80);

    if (this.shootTimer >= 25) {
      let dir = p5.Vector.sub(player.pos, this.pos).normalize();
      let speed = 7;
      projectiles.push(new Projectile(
        this.pos.x, this.pos.y,
        dir.x * speed, dir.y * speed,
        15
      ));
      let dir2 = dir.copy().rotate(0.2);
      projectiles.push(new Projectile(
        this.pos.x, this.pos.y,
        dir2.x * speed, dir2.y * speed,
        15
      ));
      this.shootTimer = 0;
    }
  }

  // One inherited steering calculation and one inherited integration per live step.
  steerToward(target, slowRadius) {
    const force = slowRadius === undefined ? this.seek(target) : this.arrive(target, slowRadius);
    this.applyForce(force.limit(this.maxForce));
    super.update();
  }

  // Explicit gameplay relocation, separate from steering. Keep its original cadence.
  teleportForPhaseThree() {
    this.pos.set(random(this.r + 50, width - this.r - 50), random(this.r + 50, height / 2));
    this.vel.set(0, 0);
    this.acc.set(0, 0);
    this.holdPosition = this.pos.copy();
    createExplosion(this.pos.x, this.pos.y, color(200, 40, 100), 20);
  }

  shootSpread(player, count, spreadAngle) {
    let baseDir = p5.Vector.sub(player.pos, this.pos).normalize();

    for (let i = 0; i < count; i++) {
      let offset = map(i, 0, count - 1, -spreadAngle, spreadAngle);
      let dir = baseDir.copy().rotate(offset);
      let speed = 5;
      projectiles.push(new Projectile(
        this.pos.x, this.pos.y,
        dir.x * speed, dir.y * speed
      ));
    }
  }

  takeDamage(amount) {
    if (this.isDead) return false;
    this.health -= amount;
    this.hitFlash = 8;
    if (this.health <= 0) {
      this.health = 0;
      this.isDead = true;
      return true;
    }
    return false;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);

    let pulse = sin(frameCount * 0.1) * 5;
    let radius = this.r + pulse;

    noStroke();
    let c = this.hitFlash > 0 ? color(255, 255, 255) : this.color;
    fill(red(c), green(c), blue(c), 60);
    circle(0, 0, radius * 2.5);

    fill(red(c), green(c), blue(c));
    stroke(255);
    strokeWeight(3);
    beginShape();
    for (let i = 0; i < 12; i++) {
      let angle = TWO_PI / 12 * i;
      let r = radius * (1 + sin(angle * 3 + frameCount * 0.05) * 0.15);
      vertex(cos(angle) * r, sin(angle) * r);
    }
    endShape(CLOSE);

    noStroke();
    fill(255);
    circle(-25, -15, 20);
    circle(25, -15, 20);
    fill(0);
    let lookX = constrain((player.pos.x - this.pos.x) * 0.02, -6, 6);
    let lookY = constrain((player.pos.y - this.pos.y) * 0.02, -6, 6);
    circle(-25 + lookX, -15 + lookY, 10);
    circle(25 + lookX, -15 + lookY, 10);

    fill(0);
    if (this.phase === 3) {
      ellipse(0, 25, 40, 30);
    } else {
      arc(0, 20, 50, 30, 0, PI);
    }

    pop();
  }

  drawHealthBar() {
    if (this.isDead) return;

    push();
    let bw = width - 200;
    let bh = 30;
    let bx = 100;
    let by = 30;

    textAlign(CENTER, TOP);
    textSize(24);
    textStyle(BOLD);
    fill(255, 80, 80);
    text('👹 OVERLORD', width / 2, 8);

    noStroke();
    fill(0, 0, 0, 180);
    rect(bx - 4, by - 4, bw + 8, bh + 8, 8);

    fill(40, 20, 40);
    rect(bx, by, bw, bh, 6);

    let ratio = this.health / this.maxHealth;
    let healthColor;
    if (ratio > 0.66) healthColor = color(255, 100, 100);
    else if (ratio > 0.33) healthColor = color(255, 180, 50);
    else healthColor = color(255, 50, 50);

    if (this.hitFlash > 0) healthColor = color(255, 255, 255);

    fill(healthColor);
    rect(bx, by, bw * ratio, bh, 6);

    stroke(255, 200, 200, 100);
    strokeWeight(2);
    line(bx + bw * 0.33, by, bx + bw * 0.33, by + bh);
    line(bx + bw * 0.66, by, bx + bw * 0.66, by + bh);
    noStroke();

    fill(255);
    textAlign(CENTER, CENTER);
    textSize(16);
    text(`${Math.max(0, Math.ceil(this.health))} / ${this.maxHealth}`, width / 2, by + bh / 2);

    fill(255, 200, 100);
    textSize(14);
    textStyle(BOLD);
    text(`PHASE ${this.phase}`, width / 2, by + bh + 10);

    textStyle(NORMAL);
    pop();
  }
}

// Instance globale
let boss = null;
