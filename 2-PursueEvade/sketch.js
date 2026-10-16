// ============================================
// PREY vs PREDATOR - Jeu principal
// ============================================

// --- Variables globales du jeu ---
let hunter;
let hunters = [];
let targets = [];
let particles = [];
let shockwaves = [];
let powerups = [];
let obstacles = [];

let comboManager;

let score = 0;
let caught = 0;
let gameTime = 0;
let gameDuration = 60 * 60;
let screenFlash = 0;
let screenShake = 0;

let gameState = 'menu';
// ⚠️ NE PAS redéclarer newRecord ni bestScore ici (ils sont dans ui.js)

let hunterMode = 'pursue';
let showVision = true;
let challengeHunterCount = 1;
let challengePreyCount = 5;
let challengeDifficulty = 'normal';
let captureHistory = [];

let spawnTimer = 0;
let powerupTimer = 0;

// soundFX et musicPlayer sont déclarés dans audio.js

function setup() {
  createCanvas(1200, 800);
  bindChallengeControls();
  refreshBest();
  soundFX = new SoundFX();
  musicPlayer = new MusicPlayer();
  resetGame();
}

function resetGame() {
  hunters = [];
  const tuning = difficultyTuning();
  for (let i = 0; i < challengeHunterCount; i++) {
    const hunterAgent = new Vehicle(width / 2 + (i - (challengeHunterCount - 1) / 2) * 36, height / 2);
    hunterAgent.maxSpeed *= tuning.hunterSpeed;
    hunterAgent.baseMaxSpeed = hunterAgent.maxSpeed;
    hunters.push(hunterAgent);
  }
  hunter = hunters[0];
  targets = [];
  particles = [];
  shockwaves = [];
  powerups = [];
  obstacles = [];
  score = 0;
  caught = 0;
  captureHistory = [];
  gameTime = 0;
  spawnTimer = 0;
  powerupTimer = 0;
  screenFlash = 0;
  screenShake = 0;
  newRecord = false;
  comboManager = new ComboManager();

  for (let i = 0; i < challengePreyCount; i++) spawnTarget();

  if (musicPlayer) musicPlayer.play('menu');
}

function spawnTarget() {
  let x, y;
  let attempts = 0;
  do {
    x = random(80, width - 80);
    y = random(80, height - 80);
    attempts++;
  } while (p5.Vector.dist(createVector(x, y), hunter.pos) < 200 && attempts < 20);

  let r = random();
  let type = 'basic';
  if (r < 0.15) type = 'fast';
  else if (r > 0.9) type = 'slow';
  else if (r > 0.75) type = 'shield';

  const prey = new Target(x, y, type);
  const tuning = difficultyTuning();
  prey.maxSpeed *= tuning.preySpeed;
  prey.baseMaxSpeed = prey.maxSpeed;
  targets.push(prey);
}

function difficultyTuning() {
  if (challengeDifficulty === 'easy') return { hunterSpeed: 0.9, preySpeed: 0.82 };
  if (challengeDifficulty === 'hard') return { hunterSpeed: 1.2, preySpeed: 1.15 };
  return { hunterSpeed: 1, preySpeed: 1 };
}

function bindChallengeControls() {
  const bindRange = (id, outputId, update) => {
    const input = document.getElementById(id);
    const output = document.getElementById(outputId);
    if (!input || !output) return;
    const sync = () => { output.value = input.value; output.textContent = input.value; update(Number(input.value)); };
    input.addEventListener('input', sync);
    sync();
  };
  bindRange('hunter-count', 'hunter-count-value', value => { challengeHunterCount = value; });
  bindRange('prey-count', 'prey-count-value', value => { challengePreyCount = value; });
  const difficulty = document.getElementById('difficulty-select');
  if (difficulty) difficulty.addEventListener('change', () => { challengeDifficulty = difficulty.value; });
  const reset = document.getElementById('challenge-reset');
  if (reset) reset.addEventListener('click', () => { resetGame(); gameState = 'playing'; });
}

function wrapAgentWithoutTrailSeam(agent) {
  const previousX = agent.pos.x;
  const previousY = agent.pos.y;
  agent.edges();
  if (Math.abs(agent.pos.x - previousX) > width / 2 || Math.abs(agent.pos.y - previousY) > height / 2) {
    agent.trail.length = 0;
  }
}

function updateChallengeStats() {
  const setText = (id, value) => {
    const element = document.getElementById(id);
    if (element) element.textContent = value;
  };
  let nearestDistance = Infinity;
  for (const hunterAgent of hunters) for (const prey of targets) {
    nearestDistance = Math.min(nearestDistance, p5.Vector.dist(hunterAgent.pos, prey.pos));
  }
  setText('challenge-fps', String(Math.round(frameRate())));
  setText('challenge-captures', String(caught));
  setText('challenge-time', `${(gameTime / 60).toFixed(1)} s`);
  setText('challenge-distance', Number.isFinite(nearestDistance) ? `${nearestDistance.toFixed(1)} px` : '—');
  const lastCapture = captureHistory[captureHistory.length - 1];
  setText('challenge-last-capture', lastCapture ? `${(lastCapture.frame / 60).toFixed(1)} s` : '—');
}

function composeHunterSteering(agent, primaryForce, sceneObstacles) {
  return primaryForce.copy()
    .add(agent.avoid(sceneObstacles).limit(agent.maxForce))
    .add(agent.boundaries(80))
    .limit(agent.maxForce);
}

function draw() {
  if (musicPlayer) musicPlayer.update();
  updateChallengeStats();

  // --- MENU ---
  if (gameState === 'menu') {
    refreshBest();
    drawStartMenu();
    return;
  }

  // --- GAME OVER ---
  if (gameState === 'gameover') {
    drawBackground();
    updateParticles();
    drawGameOver();
    return;
  }

  // --- JEU ACTIF ---
  push();
  if (screenShake > 0) {
    translate(random(-screenShake, screenShake), random(-screenShake, screenShake));
    screenShake *= 0.9;
    if (screenShake < 0.5) screenShake = 0;
  }

  drawBackground();
  gameTime++;
  comboManager.update();

  if (musicPlayer && musicPlayer.currentTrack !== 'game') {
    musicPlayer.play('game');
  }

  // --- Chasseur ---
  let mouseTarget = createVector(mouseX, mouseY);
  for (const hunterAgent of hunters) {
    const closest = closestTargetTo(hunterAgent, targets);
    const force = hunterMode === 'pursue' && closest
      ? hunterAgent.pursue(closest, 12)
      : hunterMode === 'seek'
        ? hunterAgent.arrive(mouseTarget, 100)
        : hunterMode === 'wander'
          ? hunterAgent.wander()
          : hunterAgent.arrive(mouseTarget, 100);
    hunterAgent.applyForce(composeHunterSteering(hunterAgent, force, obstacles));
    hunterAgent.update();
    wrapAgentWithoutTrailSeam(hunterAgent);
  }

  // --- Proies ---
  for (let i = targets.length - 1; i >= 0; i--) {
    let t = targets[i];
    t.update(hunters);
    wrapAgentWithoutTrailSeam(t);
    t.show();

    const capturingHunter = capturingHunterFor(t, hunters);
    if (capturingHunter) {
      let baseScore = t.type === 'fast' ? 30 :
                      t.type === 'slow' ? 20 :
                      t.type === 'shield' ? 40 : 15;
      let gained = comboManager.apply(baseScore);
      score += gained;
      caught++;
      captureHistory.push({ frame: gameTime, preyType: t.type, score: gained });

      comboManager.registerKill(t.pos.x, t.pos.y);
      explode(t.pos.x, t.pos.y, t.color, 25);

      if (soundFX) soundFX.capture();
      if (comboManager.multiplier >= 3 && soundFX) soundFX.combo();

      screenFlash = 8;
      screenShake = 6;

      if (caught === 1) {
        if (unlockAchievement('first_blood')) if (soundFX) soundFX.achievement();
      }

      if (random() < 0.10) {
        powerups.push(spawnRandomPowerUp(t.pos.x, t.pos.y));
      }

      targets.splice(i, 1);
    }
  }

  // --- Respawn ---
  spawnTimer++;
  if (spawnTimer > 80 && targets.length < Math.min(12, challengePreyCount + 3)) {
    spawnTarget();
    spawnTimer = 0;
  }

  // --- Power-ups ---
  for (let i = powerups.length - 1; i >= 0; i--) {
    let pu = powerups[i];
    pu.update();
    pu.show();

    const collectingHunter = hunters.find(agent => pu.collidesWith(agent));
    if (collectingHunter) {
      if (pu.type === 'speed') collectingHunter.speedBoostTimer = 300;
      else if (pu.type === 'vision') showVision = true;
      else if (pu.type === 'freeze') {
        for (let t of targets) t.vel.mult(0.3);
      } else if (pu.type === 'combo') {
        comboManager.multiplier = min(comboManager.multiplier + 1, 10);
        comboManager.timer = comboManager.maxTimer;
      }

      explode(pu.pos.x, pu.pos.y, pu.color, 20);
      if (soundFX) soundFX.powerUp();
      powerups.splice(i, 1);
      score += 25;
    }

    if (pu.isDead()) powerups.splice(i, 1);
  }

  // --- Obstacles ---
  for (let obs of obstacles) drawObstacle(obs);

  // --- Particules ---
  updateParticles();

  // --- Dessin ---
  hunters.forEach(agent => agent.show());
  drawCrosshair();

  // --- HUD ---
  drawHUD();
  comboManager.draw();

  // --- Flash ---
  if (screenFlash > 0) {
    noStroke();
    fill(255, 255, 255, screenFlash * 15);
    rect(-20, -20, width + 40, height + 40);
    screenFlash--;
  }

  pop();

  // --- Fin ---
  if (gameTime >= gameDuration) {
    gameState = 'gameover';
    newRecord = saveBestScore(score);
    let name = getPlayerName();
    addToTopScores(name, score, caught, comboManager.bestCombo);
    if (soundFX) soundFX.gameOver();
    if (musicPlayer) musicPlayer.stop();

    if (score >= 500) unlockAchievement('score_500');
    if (score >= 1000) unlockAchievement('score_1000');
  }
}

// ============================================
// Background et helpers
// ============================================

function drawBackground() {
  for (let i = 0; i < height; i += 4) {
    let inter = map(i, 0, height, 0, 1);
    let c = lerpColor(color(10, 10, 30), color(25, 15, 50), inter);
    stroke(c);
    line(0, i, width, i);
  }

  stroke(30, 60, 100, 60);
  strokeWeight(1);
  for (let x = 0; x < width; x += 80) line(x, 0, x, height);
  for (let y = 0; y < height; y += 80) line(0, y, width, y);
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
  stroke(0, 220, 255, 150);
  strokeWeight(1.5);
  circle(mouseX, mouseY, 30);
  line(mouseX - 20, mouseY, mouseX - 10, mouseY);
  line(mouseX + 10, mouseY, mouseX + 20, mouseY);
  line(mouseX, mouseY - 20, mouseX, mouseY - 10);
  line(mouseX, mouseY + 10, mouseX, mouseY + 20);
  pop();
}

function updateParticles() {
  for (let i = particles.length - 1; i >= 0; i--) {
    particles[i].update();
    particles[i].show();
    if (particles[i].isDead()) particles.splice(i, 1);
  }
  for (let i = shockwaves.length - 1; i >= 0; i--) {
    shockwaves[i].update();
    shockwaves[i].show();
    if (shockwaves[i].isDead()) shockwaves.splice(i, 1);
  }
}

// ============================================
// Événements
// ============================================

function mousePressed() {
  if (typeof userStartAudio === 'function') userStartAudio();

  if (gameState === 'menu') {
    let btnW = 280, btnH = 70;
    let bx = width / 2 - btnW / 2;
    let by = height / 2 + 140;
    if (isMouseOver(bx, by, btnW, btnH)) {
      resetGame();
      gameState = 'playing';
    }
    return;
  }

  if (gameState === 'gameover') {
    let btnW = 260, btnH = 60;
    let bx = width / 2 - btnW / 2;
    let by = height / 2 + 150;
    if (isMouseOver(bx, by, btnW, btnH)) {
      resetGame();
      gameState = 'playing';
    }
    return;
  }

  if (mouseButton === RIGHT) {
    obstacles.push(new Obstacle(mouseX, mouseY, 40));
    return false;
  }
}

function keyPressed() {
  if (key === 'p' || key === 'P') hunterMode = 'pursue';
  if (key === 's' || key === 'S') hunterMode = 'seek';
  if (key === 'w' || key === 'W') hunterMode = 'wander';
  if (key === 'v' || key === 'V') showVision = !showVision;
  if (key === 'r' || key === 'R') resetGame();
  if (key === 'm' || key === 'M') {
    if (soundFX) soundFX.toggleMute();
    if (musicPlayer) musicPlayer.toggleMute();
  }
}
