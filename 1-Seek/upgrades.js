// ============================================
// Système d'améliorations (Vampire Survivors style)
// ⚠️ UPGRADES est une FONCTION car color() n'est dispo qu'après setup()
// ============================================

function getUpgrades() {
  return [
    {
      id: 'damage',
      name: 'Dégâts +',
      desc: '+25% de dégâts',
      icon: '⚔️',
      rarity: 'common',
      color: color(255, 80, 80),
      apply: (player) => { player.damageMultiplier *= 1.25; }
    },
    {
      id: 'fireRate',
      name: 'Cadence +',
      desc: '-15% temps entre tirs',
      icon: '🔥',
      rarity: 'common',
      color: color(255, 150, 50),
      apply: (player) => { player.fireRate = Math.max(4, player.fireRate * 0.85); }
    },
    {
      id: 'speed',
      name: 'Vitesse +',
      desc: '+15% vitesse max',
      icon: '💨',
      rarity: 'common',
      color: color(80, 200, 255),
      apply: (player) => {
        player.baseMaxSpeed *= 1.15;
        player.maxSpeed = player.baseMaxSpeed;
      }
    },
    {
      id: 'maxHp',
      name: 'Vie max +',
      desc: '+25 HP max et soigne 25 HP',
      icon: '❤️',
      rarity: 'common',
      color: color(255, 100, 150),
      apply: (player) => {
        player.maxHealth += 25;
        player.health = Math.min(player.maxHealth, player.health + 25);
      }
    },
    {
      id: 'regen',
      name: 'Régénération',
      desc: '+1 HP par seconde',
      icon: '💚',
      rarity: 'rare',
      color: color(80, 255, 120),
      apply: (player) => { player.regenRate += 1 / 60; }
    },
    {
      id: 'range',
      name: 'Portée +',
      desc: '+25% portée de tir',
      icon: '🎯',
      rarity: 'common',
      color: color(200, 200, 100),
      apply: (player) => { player.shootRange *= 1.25; }
    },
    {
      id: 'crit',
      name: 'Critique',
      desc: '+10% chance de critique (x2)',
      icon: '💥',
      rarity: 'rare',
      color: color(255, 220, 50),
      apply: (player) => { player.critChance = Math.min(0.75, player.critChance + 0.10); }
    },
    {
      id: 'pickupRange',
      name: 'Aimant',
      desc: '+50% rayon de ramassage',
      icon: '🧲',
      rarity: 'common',
      color: color(150, 100, 255),
      apply: (player) => { player.pickupRange *= 1.5; }
    },
    {
      id: 'shieldOnStart',
      name: 'Bouclier de départ',
      desc: '+2s de bouclier au début de chaque vague',
      icon: '🛡️',
      rarity: 'rare',
      color: color(80, 180, 255),
      apply: (player) => { player.startShieldDuration += 120; }
    },
    {
      id: 'explosive',
      name: 'Tirs explosifs',
      desc: 'Les ennemis tués explosent (dégâts de zone)',
      icon: '💣',
      rarity: 'epic',
      color: color(255, 100, 50),
      apply: (player) => { player.explosiveShots = true; }
    },
    {
      id: 'piercing',
      name: 'Tirs perforants',
      desc: 'Les tirs touchent plus d\'ennemis',
      icon: '🏹',
      rarity: 'epic',
      color: color(200, 100, 255),
      apply: (player) => { player.pierceCount += 1; }
    },
    {
      id: 'lifeSteal',
      name: 'Vol de vie',
      desc: '+1 HP par ennemi tué',
      icon: '🩸',
      rarity: 'epic',
      color: color(200, 50, 80),
      apply: (player) => { player.lifeSteal += 1; }
    }
  ];
}

// ============================================
// Gestionnaire d'upgrades
// ============================================
class UpgradeManager {
  constructor() {
    this.reset();
  }

  reset() {
    this.choices = [];
    this.selectedIndex = -1;
    this.hoverIndex = -1;
    this.animTimer = 0;
  }

  // Tire 3 upgrades aléatoires (avec rareté)
  rollChoices() {
    this.choices = [];

    // ⚠️ On appelle getUpgrades() à chaque fois pour avoir des couleurs fraîches
    let allUpgrades = getUpgrades();

    let available = allUpgrades.filter(u => {
      if (u.id === 'explosive' && player.explosiveShots) return false;
      return true;
    });

    for (let i = 0; i < 3 && available.length > 0; i++) {
      let pick = this.pickByRarity(available);
      this.choices.push(pick);
      available = available.filter(u => u.id !== pick.id);
    }

    this.animTimer = 30;
  }

  pickByRarity(pool) {
    let roll = Math.random();
    let targetRarity = 'common';
    if (roll < 0.10) targetRarity = 'epic';
    else if (roll < 0.40) targetRarity = 'rare';

    let filtered = pool.filter(u => u.rarity === targetRarity);
    if (filtered.length === 0) filtered = pool;

    return random(filtered);
  }

  applyChoice(index) {
    if (index < 0 || index >= this.choices.length) return;
    let upgrade = this.choices[index];
    upgrade.apply(player);
    this.choices = [];
    this.selectedIndex = -1;
  }

  // ============================================
  // DESSIN
  // ============================================
  draw() {
    fill(0, 0, 20, 200);
    noStroke();
    rect(0, 0, width, height);

    push();
    textAlign(CENTER, CENTER);

    fill(255, 220, 100);
    textSize(48);
    textStyle(BOLD);
    text('NIVEAU SUPÉRIEUR !', width / 2, 120);
    textStyle(NORMAL);

    fill(200);
    textSize(18);
    text('Choisis une amélioration', width / 2, 170);

    let animOffset = 0;
    let animAlpha = 255;
    if (this.animTimer > 0) {
      animOffset = map(this.animTimer, 0, 30, 0, 50);
      animAlpha = map(this.animTimer, 0, 30, 0, 255);
    }

    let cardW = 280;
    let cardH = 380;
    let gap = 30;
    let totalW = cardW * 3 + gap * 2;
    let startX = width / 2 - totalW / 2;
    let y = height / 2 - cardH / 2 + 40;

    for (let i = 0; i < this.choices.length; i++) {
      let x = startX + i * (cardW + gap);
      let hovered = this.isMouseOverCard(i, x, y, cardW, cardH);
      this.drawCard(this.choices[i], x, y + animOffset, cardW, cardH, hovered, animAlpha);
    }

    if (this.animTimer <= 0) {
      fill(180);
      textSize(14);
      text('Clique sur une carte pour l\'activer', width / 2, height - 60);
    }

    pop();

    if (this.animTimer > 0) this.animTimer--;
  }

  drawCard(upgrade, x, y, w, h, hovered, alpha) {
    push();
    translate(x, y);

    let lift = hovered ? -10 : 0;
    translate(0, lift);

    noStroke();
    fill(0, 0, 0, 100);
    rect(8, 8, w, h, 16);

    let bgColor;
    if (upgrade.rarity === 'epic') bgColor = color(80, 40, 120, alpha);
    else if (upgrade.rarity === 'rare') bgColor = color(40, 60, 120, alpha);
    else bgColor = color(30, 40, 70, alpha);

    fill(bgColor);
    rect(0, 0, w, h, 16);

    let borderColor = upgrade.color;
    if (hovered) borderColor = color(255, 255, 255);

    noFill();
    stroke(borderColor);
    strokeWeight(hovered ? 4 : 3);
    rect(0, 0, w, h, 16);

    noStroke();
    let rarityLabel = upgrade.rarity === 'epic' ? 'ÉPIQUE' :
                      upgrade.rarity === 'rare' ? 'RARE' : 'COMMUN';
    let rarityColor = upgrade.rarity === 'epic' ? color(255, 100, 255) :
                      upgrade.rarity === 'rare' ? color(100, 180, 255) : color(150, 150, 150);

    fill(rarityColor);
    rect(w / 2 - 60, 20, 120, 28, 8);
    fill(255);
    textAlign(CENTER, CENTER);
    textSize(12);
    textStyle(BOLD);
    text(rarityLabel, w / 2, 34);
    textStyle(NORMAL);

    textSize(72);
    text(upgrade.icon, w / 2, 130);

    fill(255);
    textSize(24);
    textStyle(BOLD);
    text(upgrade.name, w / 2, 220);
    textStyle(NORMAL);

    fill(220);
    textSize(15);
    textAlign(CENTER, TOP);
    text(upgrade.desc, w / 2, 260, w - 40);

    if (hovered) {
      fill(upgrade.color);
      textSize(14);
      textStyle(BOLD);
      text('► CLIQUER POUR ACTIVER ◄', w / 2, h - 40);
      textStyle(NORMAL);
    }

    pop();
  }

  isMouseOverCard(index, x, y, w, h) {
    let lift = this.hoverIndex === index ? -10 : 0;
    return mouseX > x && mouseX < x + w &&
           mouseY > y + lift && mouseY < y + lift + h;
  }

  getClickedCard() {
    let cardW = 280;
    let cardH = 380;
    let gap = 30;
    let totalW = cardW * 3 + gap * 2;
    let startX = width / 2 - totalW / 2;
    let y = height / 2 - cardH / 2 + 40;

    for (let i = 0; i < this.choices.length; i++) {
      let x = startX + i * (cardW + gap);
      let lift = this.isMouseOverCard(i, x, y, cardW, cardH) ? -10 : 0;
      if (mouseX > x && mouseX < x + cardW &&
          mouseY > y + lift && mouseY < y + lift + cardH) {
        return i;
      }
    }
    return -1;
  }
}

// Instance globale
let upgradeManager;