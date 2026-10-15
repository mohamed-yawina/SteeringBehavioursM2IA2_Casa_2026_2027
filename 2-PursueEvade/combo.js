// ============================================
// Combo multiplicateur
// ============================================
class ComboManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.count = 0;
    this.timer = 0;
    this.maxTimer = 150;
    this.multiplier = 1;
    this.flashTimer = 0;
    this.bestCombo = 0;
  }

  registerKill(x, y) {
    this.count++;
    this.timer = this.maxTimer;
    this.flashTimer = 15;

    if (this.count >= 10) this.multiplier = 10;
    else if (this.count >= 8) this.multiplier = 6;
    else if (this.count >= 6) this.multiplier = 4;
    else if (this.count >= 4) this.multiplier = 3;
    else if (this.count >= 2) this.multiplier = 2;
    else this.multiplier = 1;

    if (this.count > this.bestCombo) this.bestCombo = this.count;

    if (this.multiplier >= 5) unlockAchievement('combo_5');
    if (this.multiplier >= 10) unlockAchievement('combo_10');
  }

  update() {
    if (this.timer > 0) {
      this.timer--;
      if (this.timer === 0) {
        this.count = 0;
        this.multiplier = 1;
      }
    }
    if (this.flashTimer > 0) this.flashTimer--;
  }

  apply(baseScore) {
    return baseScore * this.multiplier;
  }

  draw() {
    if (this.multiplier <= 1) return;

    push();
    textAlign(CENTER, TOP);

    let flashScale = 1 + this.flashTimer * 0.05;
    let col;
    if (this.multiplier >= 10) col = color(255, 80, 80);
    else if (this.multiplier >= 6) col = color(255, 140, 50);
    else if (this.multiplier >= 4) col = color(255, 200, 50);
    else col = color(200, 220, 100);

    translate(width / 2, 100);
    scale(flashScale);
    fill(col);
    textSize(36);
    textStyle(BOLD);
    text(`×${this.multiplier}`, 0, 0);

    textSize(12);
    fill(255, 255, 255, 180);
    text(`${this.count} captures`, 0, 40);

    let barW = 200;
    let ratio = this.timer / this.maxTimer;
    noStroke();
    fill(0, 0, 0, 150);
    rect(-barW / 2, 60, barW, 6, 3);
    fill(col);
    rect(-barW / 2, 60, barW * ratio, 6, 3);

    pop();
  }
}