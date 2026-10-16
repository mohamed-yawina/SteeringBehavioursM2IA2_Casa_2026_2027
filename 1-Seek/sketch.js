// ============================================
// SWARM ATTACK - Jeu principal
// ============================================

let player;
let enemies = [];
let particles = [];
let powerups = [];
let obstacles = [];
let floatingScores = [];

let score = 0;
let level = 1;
let gameTime = 0;
let pickupsTimer = 0;
let screenFlash = 0;

let gameState = 'menu';
let floatingMessage = null;

let stars = [];

function setup() {
  createCanvas(1200, 800);
  refreshBestScore();
  initializeStars();

  // Initialise les systèmes audio
  soundFX = new SoundFX();
  musicPlayer = new MusicPlayer();

  resetGame();
}

function initializeStars() {
  stars = [];
  for (let i = 0; i < 150; i++) {
    stars.push({
      x: random(width),
      y: random(height),
      size: random(0.5, 2.5),
      speed: random(0.05, 0.4),
      alpha: random(80, 255)
    });
  }
}

function resetGame() {
  player = new Vehicle(width / 2, height / 2);
  enemies = [];
  particles = [];
  powerups = [];
  obstacles = [];
  floatingScores = [];
  projectiles = [];
  boss = null;
  score = 0;
  level = 1;
  gameTime = 0;
  pickupsTimer = 0;
  screenFlash = 0;
  floatingMessage = null;
  comboManager = new ComboManager();
  upgradeManager = new UpgradeManager();
  survivalMode = new SurvivalMode();

  newRecord = false;
  recordFlashTimer = 0;
  showClearConfirm = false;

  // Démarre la musique du menu
  if (musicPlayer) {
    musicPlayer.playTrack('menu');
  }
}

// Keep the supplied Vehicle unchanged: cap its stronger avoidance locally,
// then cap the complete composition before its single application.
function calculatePlayerSteering(agent, target, sceneObstacles) {
  const force = agent.arrive(target, 100);
  force.add(agent.avoid(sceneObstacles).limit(agent.maxForce));
  force.add(agent.boundaries(80));
  return force.limit(agent.maxForce);
}

function draw() {
  // Met à jour la musique (avance dans les notes)
  if (musicPlayer) musicPlayer.update();

  if (gameState === 'menu') {
    drawBackground();
    refreshBestScore();
    drawStartMenu();
    if (musicPlayer && musicPlayer.currentTrack !== 'menu') {
      musicPlayer.playTrack('menu');
    }
    return;
  }

  if (gameState === 'gameover') {
    drawBackground();
    updateParticles();
    updateFloatingScores();
    drawGameOver();
    if (musicPlayer && musicPlayer.currentTrack !== 'menu') {
      musicPlayer.playTrack('menu');
    }
    return;
  }

  // --- LEVEL UP ---
  if (gameState === 'levelup') {
    drawBackground();
    for (let e of enemies) e.show();
    if (boss !== null) { boss.show(); boss.drawHealthBar(); }
    for (let p of projectiles) p.show();
    for (let pu of powerups) pu.show();
    updateParticles();
    player.show();
    drawCrosshair();
    drawHealthBar();
    drawActivePowerUps();
    drawStats();
    upgradeManager.draw();
    return;
  }

  if (gameState === 'paused') {
    drawBackground();
    for (let e of enemies) e.show();
    if (boss !== null) { boss.show(); boss.drawHealthBar(); }
    for (let p of projectiles) p.show();
    for (let obs of obstacles) drawObstacle(obs);
    for (let pu of powerups) pu.show();
    updateParticles();
    updateFloatingScores();
    player.show();
    drawCrosshair();
    drawHealthBar();
    drawActivePowerUps();
    drawStats();
    comboManager.draw();
    drawPauseMenu();
    return;
  }

  // ============================================
  // ÉTAT 'playing'
  // ============================================

  drawBackground();
  gameTime++;
  comboManager.update();
  survivalMode.update();
  if (recordFlashTimer > 0) recordFlashTimer--;

  // --- Détecte le passage en level up ---
  if (survivalMode.state === 'levelup' && gameState === 'playing') {
    gameState = 'levelup';
    return;
  }

  level = survivalMode.waveNumber;

  // --- Musique selon l'état du jeu ---
  if (musicPlayer) {
    if (boss !== null && !boss.isDead) {
      if (musicPlayer.currentTrack !== 'boss') {
        musicPlayer.playTrack('boss');
      }
    } else if (musicPlayer.currentTrack !== 'game') {
      musicPlayer.playTrack('game');
    }
  }

  let mouseTarget = createVector(mouseX, mouseY);
  player.applyForce(calculatePlayerSteering(player, mouseTarget, obstacles));

  player.updatePowerUps();
  player.update();

  pickupsTimer++;
  if (pickupsTimer > 240 && powerups.length < 3) {
    powerups.push(spawnRandomPowerUp());
    pickupsTimer = 0;
  }

  // --- Boss ---
  if (boss !== null) {
    boss.update(player);
    boss.show();
    boss.drawHealthBar();

    if (!boss.isDead && !boss.entering) {
      if (p5.Vector.dist(boss.pos, player.pos) < boss.r + player.r) {
        if (player.takeDamage(20)) {
          createExplosion(player.pos.x, player.pos.y, color(255, 100, 100), 12);
          if (soundFX) soundFX.hurt();
        }
      }
    }

    if (boss.isDead && boss.deathTimer > 120) {
      if (boss.deathTimer === 121) {
        createBigExplosion(boss.pos.x, boss.pos.y, boss.color, 80);
        screenFlash = 20;
        if (soundFX) soundFX.bigExplosion();
      }
      if (boss.deathTimer > 150) {
        boss = null;
        score += 1000;
      }
    }
  }

  // --- Ennemis ---
  for (let i = enemies.length - 1; i >= 0; i--) {
    let e = enemies[i];
    e.update([player]);

    if (p5.Vector.dist(e.pos, player.pos) < e.r + player.r) {
      if (e.type === 'kamikaze') {
        createBigExplosion(e.pos.x, e.pos.y, e.color, 25);
        if (soundFX) soundFX.bigExplosion();
        if (player.takeDamage(30)) {
          createExplosion(player.pos.x, player.pos.y, color(255, 100, 100), 12);
          if (soundFX) soundFX.hurt();
        }
        enemies.splice(i, 1);
        continue;
      }

      if (player.takeDamage(10)) {
        createExplosion(player.pos.x, player.pos.y, color(255, 100, 100), 8);
        score = max(0, score - 5);
        if (soundFX) soundFX.hurt();
      }
    }

    e.show();

    if (e.health <= 0) {
      createExplosion(e.pos.x, e.pos.y, e.color, 20);
      if (soundFX) soundFX.explosion();
      if (e.type === 'splitter') {
        e.split();
      }
      enemies.splice(i, 1);
    }
  }

  // --- Projectiles ---
  for (let i = projectiles.length - 1; i >= 0; i--) {
    let p = projectiles[i];
    p.update(player);
    p.show();

    if (p.collidesWith(player)) {
      if (player.takeDamage(p.damage)) {
        createExplosion(p.pos.x, p.pos.y, color(255, 100, 100), 10);
        score = max(0, score - 5);
        if (soundFX) soundFX.hurt();
      }
      projectiles.splice(i, 1);
      continue;
    }

    if (p.isDead()) projectiles.splice(i, 1);
  }

  // --- Power-ups ---
  for (let i = powerups.length - 1; i >= 0; i--) {
    let pu = powerups[i];
    pu.update();
    pu.show();

    if (p5.Vector.dist(pu.pos, player.pos) < pu.r + player.r + player.pickupRange) {
      player.activatePowerUp(pu.type);
      createExplosion(pu.pos.x, pu.pos.y, pu.color, 20);
      if (soundFX) soundFX.powerUp();
      powerups.splice(i, 1);
      score += 15;
      continue;
    }

    if (pu.isDead()) powerups.splice(i, 1);
  }

  for (let obs of obstacles) drawObstacle(obs);

  updateParticles();
  updateFloatingScores();

  // --- Son de tir (1 fois sur 3 pour ne pas saturer) ---
  if (frameCount % 3 === 0 && enemies.length > 0 && soundFX) {
    soundFX.shoot();
  }

  autoShoot();

  player.show();
  drawCrosshair();

  // --- UI ---
  drawHealthBar();
  drawActivePowerUps();
  drawStats();
  comboManager.draw();
  survivalMode.draw();
  drawFloatingMessage();

  // --- Game over ---
  if (player.health <= 0) {
    gameState = 'gameover';
    createExplosion(player.pos.x, player.pos.y, color(255, 100, 100), 40);
    if (soundFX) soundFX.gameOver();
    if (musicPlayer) musicPlayer.stop();

    let timeSeconds = Math.floor(gameTime / 60);
    newRecord = saveScore(score);
    let playerName = getPlayerName();
    addToTopScores(playerName, score, survivalMode.waveNumber, timeSeconds);
    bestScore = Math.max(bestScore, score);

    if (newRecord) {
      recordFlashTimer = 180;
    }
  }
}

// ============================================
// Fonctions auxiliaires
// ============================================

function drawBackground() {
  for (let i = 0; i < height; i += 4) {
    let inter = map(i, 0, height, 0, 1);
    let c = lerpColor(color(10, 10, 30), color(20, 15, 50), inter);
    stroke(c);
    line(0, i, width, i);
  }

  noStroke();
  for (let s of stars) {
    fill(255, 255, 255, s.alpha);
    circle(s.x, s.y, s.size);
    s.y += s.speed;
    if (s.y > height) {
      s.y = 0;
      s.x = random(width);
    }
  }

  if (screenFlash > 0) {
    noStroke();
    fill(255, 255, 255, screenFlash * 15);
    rect(0, 0, width, height);
    screenFlash--;
  }
}

function drawObstacle(obs) {
  push();
  translate(obs.pos.x, obs.pos.y);
  noStroke();
  fill(80, 80, 120, 100);
  circle(0, 0, obs.r * 2.2);
  fill(60, 60, 90);
  circle(0, 0, obs.r * 2);
  fill(40, 40, 60);
  circle(-obs.r * 0.3, -obs.r * 0.3, obs.r * 0.8);
  pop();
}

function drawCrosshair() {
  push();
  noFill();
  stroke(255, 200, 100, 150);
  strokeWeight(1.5);
  circle(mouseX, mouseY, 30);
  line(mouseX - 20, mouseY, mouseX - 10, mouseY);
  line(mouseX + 10, mouseY, mouseX + 20, mouseY);
  line(mouseX, mouseY - 20, mouseX, mouseY - 10);
  line(mouseX, mouseY + 10, mouseX, mouseY + 20);
  pop();
}

function autoShoot() {
  if (frameCount % Math.floor(player.fireRate) !== 0) return;

  // Cible le boss
  if (boss !== null && !boss.isDead && !boss.entering) {
    let damage = 15 * player.damageMultiplier;
    if (Math.random() < player.critChance) damage *= 2;
    boss.takeDamage(damage);
    stroke(255, 100, 100, 200);
    strokeWeight(3);
    line(player.pos.x, player.pos.y, boss.pos.x, boss.pos.y);
    return;
  }

  if (enemies.length === 0) return;

  let targets = [];
  if (player.hasTripleShot()) {
    let sorted = [...enemies].sort((a, b) => {
      return p5.Vector.dist(a.pos, player.pos) - p5.Vector.dist(b.pos, player.pos);
    });
    targets = sorted.slice(0, 3);
  } else {
    let closest = null;
    let minDist = Infinity;
    for (let e of enemies) {
      let d = p5.Vector.dist(e.pos, player.pos);
      if (d < minDist) {
        minDist = d;
        closest = e;
      }
    }
    if (closest) targets = [closest];
  }

  for (let target of targets) {
    if (p5.Vector.dist(target.pos, player.pos) > player.shootRange) continue;

    let damage = 10 * player.damageMultiplier;
    let isCrit = Math.random() < player.critChance;
    if (isCrit) damage *= 2;

    if (target.takeDamage(damage)) {
      // Son d'explosion (1 fois sur 2 pour ne pas saturer)
      if (frameCount % 2 === 0 && soundFX) soundFX.explosion();

      createExplosion(target.pos.x, target.pos.y, target.color, 25);
      let idx = enemies.indexOf(target);
      if (idx >= 0) enemies.splice(idx, 1);

      if (target.type === 'splitter') target.split();

      if (player.lifeSteal > 0) {
        player.health = Math.min(player.maxHealth, player.health + player.lifeSteal);
      }

      if (player.explosiveShots) {
        createBigExplosion(target.pos.x, target.pos.y, color(255, 140, 50), 20);
        for (let other of enemies) {
          if (other === target) continue;
          if (p5.Vector.dist(other.pos, target.pos) < 80) {
            other.takeDamage(damage * 0.5);
          }
        }
      }

      let baseScore = target.type === 'tank' ? 50 :
                      target.type === 'fast' ? 30 :
                      target.type === 'sniper' ? 40 :
                      target.type === 'kamikaze' ? 35 :
                      target.type === 'splitter' ? 45 : 20;
      let gained = comboManager.applyMultiplier(baseScore);
      score += gained;

      comboManager.registerKill(target.pos.x, target.pos.y);

      let pointsText = `+${gained}`;
      if (comboManager.multiplier > 1) {
        pointsText += ` ×${comboManager.multiplier}`;
      }
      addFloatingScore(target.pos.x, target.pos.y, pointsText, color(255, 220, 100));

      if (isCrit) {
        addFloatingScore(target.pos.x, target.pos.y - 20, 'CRIT !', color(255, 220, 50));
      }
    } else {
      createExplosion(target.pos.x, target.pos.y, target.color, 5);
    }

    stroke(255, 200, 100, 200);
    strokeWeight(2);
    line(player.pos.x, player.pos.y, target.pos.x, target.pos.y);
  }
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].show();
    if (particles[i].isDead()) particles.splice(i, 1);
  }
}

function triggerScreenBomb() {
  screenFlash = 15;
  createBigExplosion(player.pos.x, player.pos.y, color(255, 200, 100), 40);
  if (soundFX) soundFX.bigExplosion();

  projectiles = [];

  if (boss !== null && !boss.isDead) {
    boss.takeDamage(200);
  }

  for (let e of enemies) {
    createExplosion(e.pos.x, e.pos.y, e.color, 20);
    let baseScore = e.type === 'tank' ? 50 : e.type === 'fast' ? 30 : 20;
    let gained = comboManager.applyMultiplier(baseScore);
    score += gained;
    comboManager.registerKill(e.pos.x, e.pos.y);
    addFloatingScore(e.pos.x, e.pos.y, `+${gained}`, color(255, 220, 100));
  }
  enemies = [];
  score += 100;
}

function addFloatingScore(x, y, text, col) {
  floatingScores.push({
    pos: createVector(x, y),
    text: text,
    color: col,
    life: 60,
    maxLife: 60
  });
}

function updateFloatingScores() {
  for (let i = floatingScores.length - 1; i >= 0; i--) {
    let fs = floatingScores[i];
    fs.pos.y -= 1.5;
    fs.life--;

    let alpha = map(fs.life, 0, fs.maxLife, 0, 255);
    push();
    textAlign(CENTER, CENTER);
    fill(red(fs.color), green(fs.color), blue(fs.color), alpha);
    textSize(20);
    textStyle(BOLD);
    text(fs.text, fs.pos.x, fs.pos.y);
    textStyle(NORMAL);
    pop();

    if (fs.life <= 0) floatingScores.splice(i, 1);
  }
}

// ============================================
// Événements souris
// ============================================

function mousePressed() {
  // Force le démarrage de l'audio au premier clic
  if (typeof userStartAudio === 'function') {
    userStartAudio();
  }

  // --- Level up ---
  if (gameState === 'levelup') {
    let index = upgradeManager.getClickedCard();
    if (index >= 0) {
      upgradeManager.applyChoice(index);
      survivalMode.finishLevelUp();
      gameState = 'playing';
      if (soundFX) soundFX.levelUp();
    }
    return;
  }

  if (gameState === 'paused') {
    let r = pauseButtons.resume;
    let s = pauseButtons.restart;
    let m = pauseButtons.menu;

    if (isMouseOver(r.x, r.y, r.w, r.h)) {
      gameState = 'playing';
      return;
    }
    if (isMouseOver(s.x, s.y, s.w, s.h)) {
      resetGame();
      gameState = 'playing';
      return;
    }
    if (isMouseOver(m.x, m.y, m.w, m.h)) {
      resetGame();
      gameState = 'menu';
      return;
    }
    return;
  }

  if (gameState === 'menu') {
    resetGame();
    gameState = 'playing';
    return;
  }

  if (gameState === 'gameover') {
    let bw = 200, bh = 45;
    let bx = width / 2 - bw / 2;
    let by = height / 2 + 130 + 55 + 15;

    if (isMouseOver(bx, by, bw, bh)) {
      if (showClearConfirm) {
        clearAllScores();
        bestScore = 0;
        newRecord = false;
        showClearConfirm = false;
      } else {
        showClearConfirm = true;
      }
      return;
    }

    showClearConfirm = false;
    resetGame();
    gameState = 'playing';
    return;
  }

  if (mouseButton === RIGHT) {
    obstacles.push(new Obstacle(mouseX, mouseY, 40));
    return false;
  }
}

function mouseDragged() {
  if (gameState === 'playing' && mouseButton === LEFT) {
    enemies.push(new Target(mouseX, mouseY, 'basic'));
  }
}

// ============================================
// Clavier
// ============================================

function keyPressed() {
  // Mute / Unmute
  if (key === 'm' || key === 'M') {
    if (soundFX) {
      soundFX.toggleMute();
    }
    if (musicPlayer) {
      musicPlayer.toggleMute();
    }
    return;
  }

  if (key === 'Escape') {
    if (gameState === 'playing') {
      gameState = 'paused';
    } else if (gameState === 'paused') {
      gameState = 'playing';
    }
    return;
  }

  if (gameState !== 'playing') return;

  if (key === ' ') {
    powerups.push(spawnRandomPowerUp());
  }
  if (key === 'r' || key === 'R') {
    resetGame();
  }
  if (key === 'o' || key === 'O') {
    obstacles.push(new Obstacle(mouseX, mouseY, 40));
  }
  if (key === 'p' || key === 'P') {
    powerups.push(spawnRandomPowerUp());
  }
  if (key === 'b' || key === 'B') {
    boss = new Boss();
  }
}
