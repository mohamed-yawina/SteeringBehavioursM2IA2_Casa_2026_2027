// ============================================
// Power-ups
// ============================================
class PowerUp extends Vehicle {
  constructor(x, y, type) {
    super(x, y);
    this.type = type;
    this.r = 14;
    this.pulse = random(TWO_PI);
    this.life = 600;
    this.rotation = 0;

    const configs = {
      speed:   { color: color(255, 220, 50),  symbol: '»', label: 'VITESSE' },
      vision:  { color: color(80, 200, 255),  symbol: '👁', label: 'VISION' },
      freeze:  { color: color(150, 220, 255), symbol: '❄', label: 'FREEZE' },
      combo:   { color: color(255, 80, 120),  symbol: '★', label: 'COMBO' }
    };

    this.color = configs[type].color;
    this.symbol = configs[type].symbol;
    this.label = configs[type].label;
  }

  update() {
    this.pulse += 0.15;
    this.rotation += 0.03;
    this.life--;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);

    let alpha = 255;
    if (this.life < 120) alpha = 100 + sin(frameCount * 0.5) * 100;

    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), alpha * 0.3);
    circle(0, 0, (this.r + sin(this.pulse) * 5) * 3);

    rotate(this.rotation);
    fill(red(this.color), green(this.color), blue(this.color), alpha);
    stroke(255, 255, 255, alpha);
    strokeWeight(2);
    beginShape();
    for (let i = 0; i < 6; i++) {
      let a = TWO_PI / 6 * i;
      vertex(cos(a) * this.r, sin(a) * this.r);
    }
    endShape(CLOSE);

    rotate(-this.rotation);
    fill(255, 255, 255, alpha);
    noStroke();
    textAlign(CENTER, CENTER);
    textSize(16);
    textStyle(BOLD);
    text(this.symbol, 0, 1);
    textStyle(NORMAL);
    pop();
  }

  isDead() { return this.life <= 0; }

  collidesWith(v) {
    return p5.Vector.dist(this.pos, v.pos) < this.r + v.r + 10;
  }
}

function spawnRandomPowerUp(x, y) {
  const types = ['speed', 'vision', 'freeze', 'combo'];
  return new PowerUp(x, y, random(types));
}
