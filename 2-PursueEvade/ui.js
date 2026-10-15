// ============================================
// UI globale
// ============================================

// ⚠️ Ces deux variables sont déclarées ICI et NULLE PART ailleurs
let bestScore = 0;
let newRecord = false;

let titlePulse = 0;

function drawStartMenu() {
  titlePulse += 0.05;

  for (let i = 0; i < height; i += 4) {
    let inter = map(i, 0, height, 0, 1);
    let c = lerpColor(color(10, 5, 30), color(30, 10, 50), inter);
    stroke(c);
    line(0, i, width, i);
  }

  noStroke();
  for (let i = 0; i < 100; i++) {
    let x = (i * 137 + frameCount * (0.5 + i % 3)) % width;
    let y = (i * 53 + frameCount * 0.3) % height;
    let a = 100 + sin(frameCount * 0.05 + i) * 100;
    fill(200, 220, 255, a);
    circle(x, y, 2);
  }

  push();
  textAlign(CENTER, CENTER);

  let pulse = 1 + sin(titlePulse) * 0.03;

  push();
  translate(width / 2, height / 2 - 180);
  scale(pulse);

  fill(0, 100, 150, 100);
  textSize(72);
  textStyle(BOLD);
  text('PREY', 3, 3);

  fill(0, 220, 255);
  text('PREY', 0, 0);

  fill(255, 80, 150);
  textSize(40);
  text('vs', 0, 55);

  fill(255, 100, 150);
  textSize(72);
  text('PREDATOR', 0, 115);

  drawingContext.shadowBlur = 20;
  drawingContext.shadowColor = '#00ffff';
  fill(0, 220, 255, 80);
  text('PREY', 0, 0);
  drawingContext.shadowBlur = 0;
  pop();

  fill(180, 220, 255);
  textSize(16);
  textStyle(NORMAL);
  text('Survis, chasse, enchaîne les combos !', width / 2, height / 2 - 30);

  fill(140, 160, 200);
  textSize(13);
  text('60 secondes pour attraper un max de proies', width / 2, height / 2 + 5);

  if (bestScore > 0) {
    fill(255, 220, 100);
    textSize(22);
    textStyle(BOLD);
    text(`🏆 MEILLEUR : ${bestScore}`, width / 2, height / 2 + 50);
    textStyle(NORMAL);
  }

  fill(120, 140, 180);
  textSize(12);
  text('[P] Pursue  |  [S] Seek  |  [W] Wander  |  [V] Vision  |  [M] Mute  |  [R] Reset',
       width / 2, height / 2 + 100);

  let btnW = 280, btnH = 70;
  let bx = width / 2 - btnW / 2;
  let by = height / 2 + 140;
  let hover = isMouseOver(bx, by, btnW, btnH);

  push();
  translate(bx, by);
  if (hover) scale(1.05);

  drawingContext.shadowBlur = hover ? 30 : 15;
  drawingContext.shadowColor = '#00ddff';

  noStroke();
  fill(hover ? color(0, 240, 255) : color(0, 200, 230));
  rect(0, 0, btnW, btnH, 15);

  drawingContext.shadowBlur = 0;

  fill(10, 20, 40);
  textSize(28);
  textStyle(BOLD);
  text('▶ JOUER', btnW / 2, btnH / 2);
  textStyle(NORMAL);
  pop();

  pop();

  drawAchievementsPanel();
  drawLeaderboard();
}

function drawLeaderboard() {
  let top = getTopScores();
  if (top.length === 0) return;

  push();
  textAlign(LEFT, TOP);
  let px = 30;
  let py = 20;

  fill(0, 0, 0, 150);
  noStroke();
  rect(px, py, 280, 50 + top.length * 35, 8);

  fill(255, 220, 100);
  textSize(18);
  textStyle(BOLD);
  text('🏆 TOP 5', px + 15, py + 12);
  textStyle(NORMAL);

  for (let i = 0; i < top.length; i++) {
    let e = top[i];
    let y = py + 45 + i * 35;

    fill(180, 220, 255);
    textSize(14);
    text(`${i + 1}. ${e.name}`, px + 15, y);

    textAlign(RIGHT, TOP);
    fill(255, 220, 100);
    text(`${e.score}`, px + 265, y);

    textAlign(LEFT, TOP);
    fill(120, 140, 180);
    textSize(11);
    text(`${e.caught} proies • combo ×${e.combo}`, px + 15, y + 15);
  }

  pop();
}

function drawHUD() {
  push();

  textAlign(LEFT, TOP);
  fill(255);
  textSize(24);
  textStyle(BOLD);
  text(`SCORE : ${score}`, 30, 30);
  textStyle(NORMAL);

  textSize(13);
  fill(180, 220, 255);
  text(`Proies : ${caught}`, 30, 62);

  if (comboManager.multiplier > 1) {
    fill(255, 200, 100);
    textSize(16);
    textStyle(BOLD);
    text(`Combo ×${comboManager.multiplier}`, 30, 82);
    textStyle(NORMAL);
  }

  textAlign(CENTER, TOP);
  let timeLeft = max(0, Math.ceil((gameDuration - gameTime) / 60));
  let timerColor = timeLeft <= 10 ? color(255, 80, 80) : color(255, 255, 255);
  if (timeLeft <= 10) {
    timerColor = color(255, 100 + sin(frameCount * 0.3) * 100, 100);
  }
  fill(timerColor);
  textSize(42);
  textStyle(BOLD);
  text(`${timeLeft}`, width / 2, 20);
  textSize(12);
  textStyle(NORMAL);
  text('secondes', width / 2, 68);

  let barW = 350;
  let barH = 6;
  let ratio = gameTime / gameDuration;
  noStroke();
  fill(0, 0, 0, 180);
  rect(width / 2 - barW / 2, 88, barW, barH, 3);
  fill(timerColor);
  rect(width / 2 - barW / 2, 88, barW * ratio, barH, 3);

  textAlign(RIGHT, TOP);
  fill(180, 220, 255);
  textSize(13);
  text(`Meilleur : ${bestScore}`, width - 30, 30);

  let timeStr = hunterMode.toUpperCase();
  let modeColors = {
    'PURSUE': color(255, 100, 150),
    'SEEK': color(80, 200, 255),
    'WANDER': color(255, 200, 100)
  };
  fill(modeColors[timeStr] || 255);
  textSize(14);
  textStyle(BOLD);
  text(`Mode : ${timeStr}`, width - 30, 55);
  textStyle(NORMAL);

  textAlign(RIGHT, BOTTOM);
  fill(100, 120, 160);
  textSize(11);
  text('[P] Pursue  [S] Seek  [W] Wander  [V] Vision  [M] Mute  [R] Reset',
       width - 30, height - 15);

  pop();
}

function drawGameOver() {
  fill(0, 0, 20, 220);
  noStroke();
  rect(0, 0, width, height);

  push();
  textAlign(CENTER, CENTER);

  let pulse = 1 + sin(frameCount * 0.1) * 0.03;

  push();
  translate(width / 2, height / 2 - 180);
  scale(pulse);
  fill(255, 100, 150);
  textSize(72);
  textStyle(BOLD);
  text('TEMPS ÉCOULÉ', 0, 0);
  pop();

  textStyle(NORMAL);
  fill(255);
  textSize(48);
  textStyle(BOLD);
  text(`${score}`, width / 2, height / 2 - 60);
  textSize(16);
  textStyle(NORMAL);
  fill(180, 220, 255);
  text('points', width / 2, height / 2 - 15);

  fill(200);
  textSize(18);
  text(`Proies attrapées : ${caught}`, width / 2, height / 2 + 30);
  text(`Meilleur combo : ×${comboManager.bestCombo}`, width / 2, height / 2 + 55);

  if (newRecord) {
    push();
    translate(width / 2, height / 2 + 105);
    scale(pulse);
    fill(255, 220, 100);
    textSize(26);
    textStyle(BOLD);
    text('🎉 NOUVEAU RECORD ! 🎉', 0, 0);
    pop();
    textStyle(NORMAL);
  } else {
    fill(180);
    textSize(16);
    text(`Meilleur : ${bestScore}`, width / 2, height / 2 + 105);
  }

  let btnW = 260, btnH = 60;
  let bx = width / 2 - btnW / 2;
  let by = height / 2 + 150;
  let hover = isMouseOver(bx, by, btnW, btnH);

  push();
  translate(bx, by);
  if (hover) scale(1.05);

  drawingContext.shadowBlur = hover ? 25 : 12;
  drawingContext.shadowColor = '#00ddff';
  noStroke();
  fill(hover ? color(0, 240, 255) : color(0, 200, 230));
  rect(0, 0, btnW, btnH, 12);
  drawingContext.shadowBlur = 0;

  fill(10, 20, 40);
  textSize(22);
  textStyle(BOLD);
  text('REJOUER', btnW / 2, btnH / 2);
  textStyle(NORMAL);
  pop();

  pop();
}

function isMouseOver(x, y, w, h) {
  return mouseX > x && mouseX < x + w && mouseY > y && mouseY < y + h;
}

function refreshBest() {
  bestScore = getBestScore();
}