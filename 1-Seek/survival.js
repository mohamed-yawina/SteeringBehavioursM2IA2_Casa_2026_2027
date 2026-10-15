// ============================================
// Mode Survie - Génération infinie de vagues
// ============================================
class SurvivalMode {
  constructor() {
    this.reset();
  }

  reset() {
    this.waveNumber = 1;
    this.state = 'intro';
    this.timer = 120;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.spawnInterval = 30;
    this.rewardMessage = null;
    this.rewardTimer = 0;
    this.isBossWave = false;
  }

  generateWave(n) {
    if (n % 10 === 0) {
      this.isBossWave = true;
      return [];
    }
    this.isBossWave = false;

    let queue = [];

    let basicCount = 3 + n * 2;
    let fastCount = n >= 2 ? Math.floor(n * 1.2) : 0;
    let tankCount = n >= 4 ? Math.floor((n - 2) / 2) : 0;
    let sniperCount = n >= 6 ? Math.floor((n - 4) / 3) : 0;
    let kamikazeCount = n >= 8 ? Math.floor((n - 6) / 2) : 0;
    let splitterCount = n >= 12 ? Math.floor((n - 10) / 3) : 0;

    for (let i = 0; i < basicCount; i++) queue.push('basic');
    for (let i = 0; i < fastCount; i++) queue.push('fast');
    for (let i = 0; i < tankCount; i++) queue.push('tank');
    for (let i = 0; i < sniperCount; i++) queue.push('sniper');
    for (let i = 0; i < kamikazeCount; i++) queue.push('kamikaze');
    for (let i = 0; i < splitterCount; i++) queue.push('splitter');

    for (let i = queue.length - 1; i > 0; i--) {
      let j = Math.floor(Math.random() * (i + 1));
      [queue[i], queue[j]] = [queue[j], queue[i]];
    }

    return queue;
  }

  getReward(n) {
    if (n % 10 === 0) {
      return { score: 1000, powerUp: true };
    }
    return {
      score: 50 * n,
      powerUp: n % 2 === 0
    };
  }

  update() {
    if (this.rewardTimer > 0) this.rewardTimer--;

    switch (this.state) {
      case 'intro':
        this.timer--;
        if (this.timer <= 0) {
          this.startSpawning();
        }
        break;

      case 'spawning':
        this.spawnTimer++;
        if (this.spawnTimer >= this.spawnInterval && this.spawnQueue.length > 0) {
          this.spawnNextEnemy();
          this.spawnTimer = 0;
        }
        if (this.spawnQueue.length === 0) {
          this.state = 'clearing';
        }
        break;

      case 'clearing':
        if (this.isBossWave) {
          if (boss === null) {
            this.completeWave();
          }
        } else {
          if (enemies.length === 0) {
            this.completeWave();
          }
        }
        break;

      case 'levelup':
        break;

      case 'complete':
        this.timer--;
        if (this.timer <= 0) {
          this.nextWave();
        }
        break;
    }
  }

  startSpawning() {
    // Bouclier de départ (upgrade)
    if (player.startShieldDuration > 0) {
      player.shieldTimer = max(player.shieldTimer, player.startShieldDuration);
    }

    // Son de démarrage de vague
    if (soundFX) soundFX.waveStart();

    if (this.waveNumber % 10 === 0) {
      boss = new Boss();
      this.isBossWave = true;
      this.state = 'clearing';
      if (soundFX) soundFX.bossAppear();
      return;
    }

    this.spawnQueue = this.generateWave(this.waveNumber);
    this.state = 'spawning';
    this.spawnTimer = 0;
  }

  spawnNextEnemy() {
    if (this.spawnQueue.length === 0) return;
    let type = this.spawnQueue.shift();
    spawnEnemyAtEdge(type);
  }

  completeWave() {
    let reward = this.getReward(this.waveNumber);
    score += reward.score;

    if (reward.powerUp) {
      powerups.push(spawnRandomPowerUp());
    }

    this.rewardMessage = `VAGUE ${this.waveNumber} TERMINÉE ! +${reward.score}`;
    this.rewardTimer = 180;

    // Son de fin de vague
    if (soundFX) soundFX.levelUp();

    // Vague normale → level up
    if (this.waveNumber % 10 !== 0) {
      this.state = 'levelup';
      upgradeManager.rollChoices();
      return;
    }

    // Après boss → passe directement
    this.state = 'complete';
    this.timer = 180;
  }

  nextWave() {
    this.waveNumber++;
    this.state = 'intro';
    this.timer = 120;
    this.rewardMessage = null;
  }

  finishLevelUp() {
    this.state = 'complete';
    this.timer = 180;
  }

  getRank(wave) {
    if (wave >= 30) return 'S';
    if (wave >= 20) return 'A';
    if (wave >= 10) return 'B';
    if (wave >= 5) return 'C';
    return 'D';
  }

  draw() {
    if (this.state === 'intro') {
      let alpha = 255;
      if (this.timer > 100) alpha = map(this.timer, 120, 100, 0, 255);
      else if (this.timer < 20) alpha = map(this.timer, 20, 0, 255, 0);
      alpha = constrain(alpha, 0, 255);

      push();
      textAlign(CENTER, CENTER);
      fill(0, 0, 20, 150 * (alpha / 255));
      rect(0, height / 2 - 80, width, 160);

      if (this.waveNumber % 10 === 0) {
        fill(255, 80, 80, alpha);
        textSize(72);
        textStyle(BOLD);
        text('⚠  BOSS  ⚠', width / 2, height / 2 - 20);
        fill(255, 200, 100, alpha);
        textSize(24);
        textStyle(NORMAL);
        text('Prépare-toi au combat final !', width / 2, height / 2 + 50);
      } else {
        fill(80, 180, 255, alpha);
        textSize(72);
        textStyle(BOLD);
        text(`VAGUE ${this.waveNumber}`, width / 2, height / 2 - 20);

        fill(200, 200, 255, alpha);
        textSize(20);
        textStyle(NORMAL);
        let totalEnemies = this.generateWave(this.waveNumber).length;
        text(`${totalEnemies} ennemis`, width / 2, height / 2 + 50);
      }
      pop();
    }

    if (this.rewardTimer > 0 && this.rewardMessage) {
      let alpha = min(255, this.rewardTimer * 3);
      if (this.rewardTimer > 150) alpha = map(this.rewardTimer, 180, 150, 0, 255);

      push();
      textAlign(CENTER, CENTER);
      fill(255, 220, 100, alpha);
      textSize(36);
      textStyle(BOLD);
      text(this.rewardMessage, width / 2, 200);

      if (this.getReward(this.waveNumber).powerUp) {
        fill(80, 255, 120, alpha);
        textSize(20);
        text('+ BONUS POWER-UP !', width / 2, 240);
      }
      textStyle(NORMAL);
      pop();
    }

    if ((this.state === 'spawning' || this.state === 'clearing') && !this.isBossWave) {
      push();
      textAlign(CENTER, TOP);
      fill(180, 200, 255);
      textSize(14);
      text(`VAGUE ${this.waveNumber}`, width / 2, 15);

      let total = this.generateWave(this.waveNumber).length;
      let killed = total - enemies.length - this.spawnQueue.length;
      let ratio = constrain(killed / total, 0, 1);

      let barW = 300;
      let barH = 6;
      noStroke();
      fill(0, 0, 0, 150);
      rect(width / 2 - barW / 2, 38, barW, barH, 3);
      fill(80, 180, 255);
      rect(width / 2 - barW / 2, 38, barW * ratio, barH, 3);
      pop();
    }
  }
}

let survivalMode;

function spawnEnemyAtEdge(type) {
  let edge = floor(random(4));
  let x, y;
  if (edge === 0) { x = random(width); y = -30; }
  else if (edge === 1) { x = width + 30; y = random(height); }
  else if (edge === 2) { x = random(width); y = height + 30; }
  else { x = -30; y = random(height); }

  enemies.push(new Target(x, y, type));
}