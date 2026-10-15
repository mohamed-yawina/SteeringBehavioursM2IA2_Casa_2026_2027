// ============================================
// Classe PowerUp - objet ramassable par le joueur
// ============================================
class PowerUp extends Vehicle {
  constructor(x, y, type) {
    super(x, y);
    this.type = type;
    this.r = 14;
    this.pulse = random(TWO_PI);
    this.life = 600; // 10 secondes à 60fps
    this.rotation = 0;

    // Configuration selon le type
    const configs = {
      heal:   { color: color(80, 255, 120),  symbol: '+' },
      speed:  { color: color(255, 220, 50),  symbol: '»' },
      shield: { color: color(80, 180, 255),  symbol: '◆' },
      triple: { color: color(255, 80, 120),  symbol: '≡' },
      bomb:   { color: color(255, 140, 40),  symbol: '✸' }
    };

    this.color = configs[type].color;
    this.symbol = configs[type].symbol;
  }

  update() {
    this.pulse += 0.15;
    this.rotation += 0.02;
    this.life--;
  }

  show() {
    push();
    translate(this.pos.x, this.pos.y);

    // Clignote quand il va bientôt disparaître
    let alpha = 255;
    if (this.life < 120) {
      alpha = 100 + sin(frameCount * 0.5) * 100;
    }

    // Halo pulsant
    noStroke();
    fill(red(this.color), green(this.color), blue(this.color), alpha * 0.3);
    let haloSize = (this.r + sin(this.pulse) * 4) * 3;
    circle(0, 0, haloSize);

    // Rotation pour les symboles
    rotate(this.rotation);

    // Corps hexagonal
    fill(red(this.color), green(this.color), blue(this.color), alpha);
    stroke(255, 255, 255, alpha);
    strokeWeight(2);
    beginShape();
    for (let i = 0; i < 6; i++) {
      let angle = TWO_PI / 6 * i;
      vertex(cos(angle) * this.r, sin(angle) * this.r);
    }
    endShape(CLOSE);

    // Symbole
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

  isDead() {
    return this.life <= 0;
  }

  collidesWith(player) {
    return p5.Vector.dist(this.pos, player.pos) < this.r + player.r + 5;
  }
}

// ============================================
// Fonction pour spawner un power-up aléatoire
// ============================================
function spawnRandomPowerUp() {
  const types = ['heal', 'heal', 'heal', 'speed', 'speed', 'shield', 'triple', 'bomb'];
  let type = random(types);

  let x, y;
  let attempts = 0;
  do {
    x = random(80, width - 80);
    y = random(80, height - 80);
    attempts++;
  } while (p5.Vector.dist(createVector(x, y), player.pos) < 150 && attempts < 20);

  return new PowerUp(x, y, type);
}
