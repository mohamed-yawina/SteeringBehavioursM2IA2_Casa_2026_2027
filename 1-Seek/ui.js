// ============================================
// Variables globales pour l'UI
// ============================================
let bestScore = 0;
let newRecord = false;
let recordFlashTimer = 0;
let showClearConfirm = false;

// ============================================
// HUD
// ============================================

function drawHealthBar() {
  let x = 30, y = 30, w = 250, h = 28;

  noStroke();
  fill(0, 0, 0, 150);
  rect(x - 4, y - 4, w + 8, h + 8, 8);

  fill(40, 40, 60);
  rect(x, y, w, h, 6);

  let hpRatio = player.health / player.maxHealth;
  let hpColor;
  if (hpRatio > 0.6) hpColor = color(80, 220, 100);
  else if (hpRatio > 0.3) hpColor = color(255, 180, 50);
  else hpColor = color(230, 60, 60);

  fill(hpColor);
  rect(x, y, w * hpRatio, h, 6);

  fill(255);
  textAlign(CENTER, CENTER);
  textSize(14);
  text(`HP ${Math.max(0, Math.floor(player.health))} / ${player.maxHealth}`, x + w / 2, y + h / 2);
  textAlign(LEFT, BASELINE);
}

function drawActivePowerUps() {
  let x = 30;
  let y = 80;
  let size = 50;

  push();
  textAlign(CENTER, CENTER);
  textSize(12);
  textStyle(BOLD);

  if (player.speedBoostTimer > 0) {
    drawPowerUpIcon(x, y, color(255, 220, 50), '»', player.speedBoostTimer, 300);
    x += size + 10;
  }

  if (player.shieldTimer > 0) {
    drawPowerUpIcon(x, y, color(80, 180, 255), '◆', player.shieldTimer, 180);
    x += size + 10;
  }

  if (player.tripleShotTimer > 0) {
    drawPowerUpIcon(x, y, color(255, 80, 120), '≡', player.tripleShotTimer, 480);
    x += size + 10;
  }

  textStyle(NORMAL);
  pop();
}

function drawPowerUpIcon(x, y, col, symbol, currentTime, maxTime) {
  fill(0, 0, 0, 150);
  noStroke();
  rect(x - 20, y - 20, 40, 40, 6);

  fill(col);
  textSize(20);
  text(symbol, x, y - 2);

  let ratio = currentTime / maxTime;
  fill(col);
  rect(x - 18, y + 14, 36 * ratio, 3, 2);
}

function drawStats() {
  push();
  textAlign(RIGHT, TOP);
  fill(255);
  textSize(20);
  text(`SCORE : ${score}`, width - 30, 30);

  textSize(14);
  fill(180, 200, 255);
  text(`Vague ${level}`, width - 30, 60);

  // Rang
  let rank = survivalMode ? survivalMode.getRank(level) : 'D';
  let rankColors = {
    'S': color(255, 215, 0),
    'A': color(255, 100, 255),
    'B': color(80, 180, 255),
    'C': color(80, 255, 120),
    'D': color(200, 200, 200)
  };
  fill(rankColors[rank]);
  textSize(16);
  textStyle(BOLD);
  text(`RANG ${rank}`, width - 30, 82);
  textStyle(NORMAL);
  textSize(14);

  fill(180, 200, 255);
  text(`Ennemis : ${enemies.length}`, width - 30, 110);
  text(`Temps : ${Math.floor(gameTime / 60)}s`, width - 30, 130);

  // Bonus actifs
  textSize(11);
  fill(150, 220, 180);
  let y = 160;
  if (player.damageMultiplier > 1) {
    text(`⚔ DMG ×${player.damageMultiplier.toFixed(2)}`, width - 30, y);
    y += 14;
  }
  if (player.critChance > 0) {
    text(`💥 CRIT ${Math.floor(player.critChance * 100)}%`, width - 30, y);
    y += 14;
  }
  if (player.lifeSteal > 0) {
    text(`🩸 STEAL +${player.lifeSteal}`, width - 30, y);
    y += 14;
  }
  if (player.explosiveShots) {
    text(`💣 EXPLO`, width - 30, y);
    y += 14;
  }
  if (player.regenRate > 0) {
    text(`💚 REGEN +${(player.regenRate * 60).toFixed(1)}/s`, width - 30, y);
    y += 14;
  }

  // Best score
  fill(150, 180, 220);
  textSize(12);
  text(`BEST : ${Math.max(bestScore, score)}`, width - 30, y + 5);

  // Indicateur mute
  if (soundFX && soundFX.muted) {
    fill(255, 100, 100);
    textSize(11);
    textAlign(RIGHT, BOTTOM);
    text('🔇 [M] Son OFF', width - 30, height - 35);
  } else {
    fill(120, 140, 180);
    textSize(11);
    textAlign(RIGHT, BOTTOM);
    text('🔊 [M] Son ON', width - 30, height - 35);
  }

  // Indice pause
  fill(120, 140, 180);
  textSize(11);
  textAlign(RIGHT, BOTTOM);
  text('[Échap] Pause', width - 30, height - 15);
  textAlign(LEFT, BASELINE);
  pop();
}

// ============================================
// Menu principal
// ============================================

function drawStartMenu() {
  fill(0, 0, 20, 220);
  rect(0, 0, width, height);

  push();
  textAlign(CENTER, CENTER);
  fill(80, 180, 255);
  textSize(72);
  textStyle(BOLD);
  text('SWARM', width / 2, height / 2 - 220);
  fill(255, 100, 100);
  text('ATTACK', width / 2, height / 2 - 150);
  textStyle(NORMAL);

  if (bestScore > 0) {
    fill(255, 220, 100);
    textSize(22);
    textStyle(BOLD);
    text(`🏆 MEILLEUR SCORE : ${bestScore}`, width / 2, height / 2 - 80);
    textStyle(NORMAL);
  }

  fill(200);
  textSize(16);
  text('Mode SURVIE INFINIE', width / 2, height / 2 - 30);
  text('Le vaisseau suit ta souris automatiquement', width / 2, height / 2 - 5);
  text('Choisis une amélioration à chaque fin de vague', width / 2, height / 2 + 20);
  text('Boss toutes les 10 vagues !', width / 2, height / 2 + 45);
  text('Appuie sur Échap en jeu pour mettre en pause', width / 2, height / 2 + 70);

  fill(150);
  textSize(13);
  text('M : couper le son', width / 2, height / 2 + 95);

  fill(80, 180, 255);
  noStroke();
  rect(width / 2 - 120, height / 2 + 120, 240, 60, 12);
  fill(255);
  textSize(24);
  textStyle(BOLD);
  text('CLIQUE POUR JOUER', width / 2, height / 2 + 150);
  textStyle(NORMAL);

  // Top 10
  let top = getTopScores();
  if (top.length > 0) {
    let panelX = width - 320;
    let panelY = 120;

    fill(0, 0, 0, 180);
    noStroke();
    rect(panelX, panelY, 290, 400, 8);

    fill(255, 220, 100);
    textSize(20);
    textStyle(BOLD);
    textAlign(LEFT, TOP);
    text('🏆 TOP 10', panelX + 15, panelY + 12);

    textSize(13);
    textStyle(NORMAL);
    for (let i = 0; i < top.length; i++) {
      let entry = top[i];
      let y = panelY + 45 + i * 34;

      fill(180, 200, 255);
      text(`${i + 1}.`, panelX + 15, y);

      fill(255);
      text(`${entry.name}`, panelX + 40, y);

      textAlign(RIGHT, TOP);
      fill(255, 220, 100);
      text(`${entry.score}`, panelX + 275, y);
      textAlign(LEFT, TOP);

      fill(140);
      textSize(11);
      text(`V${entry.wave} • ${entry.time}s • ${entry.date}`, panelX + 40, y + 15);
      textSize(13);
    }
  }

  pop();
}

// ============================================
// Game over
// ============================================

function drawGameOver() {
  fill(0, 0, 20, 220);
  rect(0, 0, width, height);

  push();
  textAlign(CENTER, CENTER);

  if (newRecord) {
    let pulse = 1 + sin(frameCount * 0.2) * 0.05;
    let alpha = 255;
    if (recordFlashTimer > 0) {
      alpha = 150 + sin(frameCount * 0.5) * 100;
    }

    push();
    translate(width / 2, height / 2 - 150);
    scale(pulse);
    fill(255, 220, 100, alpha);
    textSize(60);
    textStyle(BOLD);
    text('🎉 NEW RECORD ! 🎉', 0, 0);
    pop();
  } else {
    fill(255, 80, 80);
    textSize(80);
    textStyle(BOLD);
    text('GAME OVER', width / 2, height / 2 - 150);
  }
  textStyle(NORMAL);

  fill(255);
  textSize(40);
  textStyle(BOLD);
  text(`Score : ${score}`, width / 2, height / 2 - 60);
  textStyle(NORMAL);

  let rank = survivalMode ? survivalMode.getRank(level) : 'D';
  let rankColors = {
    'S': color(255, 215, 0),
    'A': color(255, 100, 255),
    'B': color(80, 180, 255),
    'C': color(80, 255, 120),
    'D': color(200, 200, 200)
  };
  fill(rankColors[rank]);
  textSize(36);
  textStyle(BOLD);
  text(`RANG ${rank}`, width / 2, height / 2 - 10);
  textStyle(NORMAL);

  fill(255, 220, 100);
  textSize(18);
  if (score >= bestScore && score > 0) {
    text(`🏆 Nouveau meilleur score !`, width / 2, height / 2 + 30);
  } else {
    text(`🏆 Meilleur : ${bestScore}`, width / 2, height / 2 + 30);
  }

  fill(180);
  textSize(16);
  text(`Vague atteinte : ${level}`, width / 2, height / 2 + 60);
  text(`Temps survécu : ${Math.floor(gameTime / 60)}s`, width / 2, height / 2 + 85);

  let bw = 240, bh = 55;
  let bx = width / 2 - bw / 2;
  let by = height / 2 + 130;

  let hoverReplay = isMouseOver(bx, by, bw, bh);
  fill(hoverReplay ? color(100, 200, 255) : color(80, 180, 255));
  noStroke();
  rect(bx, by, bw, bh, 12);
  fill(255);
  textSize(22);
  textStyle(BOLD);
  text('🔄  REJOUER', width / 2, by + bh / 2);
  textStyle(NORMAL);

  by += bh + 15;
  bw = 200;
  bx = width / 2 - bw / 2;
  bh = 45;

  let hoverClear = isMouseOver(bx, by, bw, bh);
  fill(hoverClear ? color(200, 80, 80) : color(150, 60, 60));
  rect(bx, by, bw, bh, 10);
  fill(255);
  textSize(16);
  textStyle(BOLD);
  if (showClearConfirm) {
    text('⚠  CONFIRMER ?', width / 2, by + bh / 2);
  } else {
    text('🗑  EFFACER LES SCORES', width / 2, by + bh / 2);
  }
  textStyle(NORMAL);

  pop();
}

function drawFloatingMessage() {
  if (floatingMessage && floatingMessage.timer > 0) {
    push();
    textAlign(CENTER, CENTER);
    let alpha = min(255, floatingMessage.timer * 4);
    fill(255, 255, 100, alpha);
    textSize(48);
    textStyle(BOLD);
    text(floatingMessage.text, width / 2, 150);
    textStyle(NORMAL);
    pop();
    floatingMessage.timer--;
  }
}

// ============================================
// Pause
// ============================================

let pauseButtons = {
  resume: { x: 0, y: 0, w: 260, h: 60 },
  restart: { x: 0, y: 0, w: 260, h: 60 },
  menu: { x: 0, y: 0, w: 260, h: 60 }
};

function drawPauseMenu() {
  fill(0, 0, 20, 180);
  noStroke();
  rect(0, 0, width, height);

  push();
  textAlign(CENTER, CENTER);

  fill(80, 180, 255);
  textSize(72);
  textStyle(BOLD);
  text('PAUSE', width / 2, height / 2 - 180);
  textStyle(NORMAL);

  fill(200);
  textSize(18);
  text(`Score : ${score}`, width / 2, height / 2 - 100);
  text(`Vague : ${level}`, width / 2, height / 2 - 75);
  text(`Temps : ${Math.floor(gameTime / 60)}s`, width / 2, height / 2 - 50);

  let bw = 260, bh = 60;
  let bx = width / 2 - bw / 2;
  let by = height / 2;

  let hoverResume = isMouseOver(bx, by, bw, bh);
  fill(hoverResume ? color(100, 200, 255) : color(80, 180, 255));
  noStroke();
  rect(bx, by, bw, bh, 12);
  fill(255);
  textSize(24);
  textStyle(BOLD);
  text('▶  REPRENDRE', width / 2, by + bh / 2);
  textStyle(NORMAL);

  pauseButtons.resume = { x: bx, y: by, w: bw, h: bh };

  by += bh + 20;
  let hoverRestart = isMouseOver(bx, by, bw, bh);
  fill(hoverRestart ? color(255, 180, 100) : color(230, 140, 60));
  rect(bx, by, bw, bh, 12);
  fill(255);
  textSize(24);
  textStyle(BOLD);
  text('🔄  RECOMMENCER', width / 2, by + bh / 2);
  textStyle(NORMAL);

  pauseButtons.restart = { x: bx, y: by, w: bw, h: bh };

  by += bh + 20;
  let hoverMenu = isMouseOver(bx, by, bw, bh);
  fill(hoverMenu ? color(180, 180, 200) : color(140, 140, 160));
  rect(bx, by, bw, bh, 12);
  fill(255);
  textSize(24);
  textStyle(BOLD);
  text('🏠  MENU PRINCIPAL', width / 2, by + bh / 2);
  textStyle(NORMAL);

  pauseButtons.menu = { x: bx, y: by, w: bw, h: bh };

  fill(150);
  textSize(14);
  text('Appuie sur Échap pour reprendre', width / 2, height - 50);

  pop();
}

function isMouseOver(x, y, w, h) {
  return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
}

function refreshBestScore() {
  bestScore = getBestScore();
}