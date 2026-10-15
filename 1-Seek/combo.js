// ============================================
// Classe ComboManager - gère les combos de kills
// ============================================
class ComboManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.killCount = 0;
    this.timer = 0;
    this.maxTimer = 120;
    this.multiplier = 1;
    this.lastKillPos = null;
    this.flashTimer = 0;
  }

  registerKill(x, y) {
    this.killCount++;
    this.timer = this.maxTimer;
    this.lastKillPos = createVector(x, y);
    this.flashTimer = 15;

    if (this.killCount >= 8) this.multiplier = 5;
    else if (this.killCount >= 6) this.multiplier = 4;
    else if (this.killCount >= 4) this.multiplier = 3;
    else if (this.killCount >= 2) this.multiplier = 2;
    else this.multiplier = 1;
  }

  update() {
    if (this.timer > 0) {
      this.timer--;
      if (this.timer === 0) {
        this.killCount = 0;
        this.multiplier = 1;
      }
    }
    if (this.flashTimer > 0) this.flashTimer--;
  }

  applyMultiplier(baseScore) {
    return baseScore * this.multiplier;
  }

  draw() {
    if (this.multiplier <= 1) return;

    push();
    textAlign(RIGHT, TOP);

    let x = width - 30;
    let y = 130;

    // ⚠️ Ne PAS appeler cette variable "scale" (conflit avec p5.scale)
    let flashScale = 1;
    let col;
    if (this.flashTimer > 0) {
      flashScale = 1 + this.flashTimer * 0.05;
      col = color(255, 255, 100);
    } else {
      if (this.multiplier >= 5) col = color(255, 80, 80);
      else if (this.multiplier >= 4) col = color(255, 140, 50);
      else if (this.multiplier >= 3) col = color(255, 200, 50);
      else col = color(200, 220, 100);
    }

    translate(x, y);
    scale(flashScale);
    fill(col);
    textSize(32);
    textStyle(BOLD);
    text(`COMBO ×${this.multiplier}`, 0, 0);

    fill(255);
    textSize(14);
    textStyle(NORMAL);
    text(`${this.killCount} ennemis`, 0, 40);

    let barW = 180;
    let barH = 8;
    let ratio = this.timer / this.maxTimer;

    noStroke();
    fill(0, 0, 0, 150);
    rect(-barW, 65, barW, barH, 4);

    fill(col);
    rect(-barW, 65, barW * ratio, barH, 4);

    pop();
  }
}

// Instance globale
let comboManager;