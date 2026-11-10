// =====================================================================
// EvoSwarm — boucle principale, vagues, score, power-ups.
// Branche les BehaviorManagers sur le monde (food, poison, predators…).
// =====================================================================

const CFG = {
  foodProb: 0.2, poisonProb: 0.02, mutation: 0.15, repro: 0.004,
  drain: 0.003, predators: 2, speed: 1, debug: false, trails: true
};

const MAX_FOOD = 250, MAX_POISON = 60, MAX_VEHICLES = 300;
const HISTORY_MAX = 300, SAMPLE_EVERY = 20;
const WAVE_DURATION = 30 * 60, TOTAL_WAVES = 8;

let vehicles = [], food = [], poison = [], predators = [],
    powerups = [], obstacles = [], history = [], champion = null,
    paused = false, tick = 0;

const stats = { births: 0, deaths: 0, eaten: 0, extinctions: 0, maxGen: 1 };
const game = {
  score: 0, wave: 0, waveTimer: 0, running: false, waveCleared: false,
  colonyEnergy: 100, totalEaten: 0
};

// --- Setup -------------------------------------------------------------
function setup() {
  createCanvas(windowWidth, windowHeight);
  bindUI();
  initSimulation();
}

function initSimulation() {
  vehicles = []; food = []; poison = []; predators = [];
  powerups = []; obstacles = []; history = []; champion = null; tick = 0;
  Object.assign(stats, { births: 0, deaths: 0, eaten: 0, extinctions: 0, maxGen: 1 });
  Object.assign(game, { score: 0, wave: 0, waveTimer: 0, running: false,
    waveCleared: false, colonyEnergy: 100, totalEaten: 0 });

  for (let i = 0; i < 40; i++) vehicles.push(newColonyVehicle(random(width), random(height)));
  for (let i = 0; i < 60; i++) food.push(createVector(random(width), random(height)));
  for (let i = 0; i < 20; i++) poison.push(createVector(random(width), random(height)));

  updateWaveTimeline(); updateHud(); renderBehaviorPanel();
}

// Factory : crée un Vehicle de colonie AVEC son BehaviorManager branché.
function newColonyVehicle(x, y, parentDna = null, gen = 1) {
  const v = new Vehicle(x, y, parentDna, gen);
  v.behaviors
    .add('seekFood', Behaviors.seekFood(v), 1)
    .add('seekPoison', Behaviors.seekPoison(v), 1)
    .add('avoidPredators', Behaviors.avoidPredators(v), 1)
    .add('separation', Behaviors.separation(v), 0.4)
    .add('boundaries', Behaviors.boundaries(v), 1.5);
  return v;
}

// --- Boucle ------------------------------------------------------------
function draw() {
  if (CFG.trails) background(8, 10, 18, 60);
  else background(8, 10, 18);

  if (!paused && game.running) for (let i = 0; i < CFG.speed; i++) step();
  else if (!paused && !game.running) for (let i = 0; i < CFG.speed; i++) idleStep();

  drawWorld(); drawCharts(); drawStats(); updateHud();
}

function idleStep() {
  tick++;
  if (random(1) < CFG.foodProb && food.length < MAX_FOOD)
    food.push(createVector(random(25, width - 25), random(25, height - 25)));
  if (random(1) < CFG.poisonProb && poison.length < MAX_POISON)
    poison.push(createVector(random(25, width - 25), random(25, height - 25)));

  const ctx = { food, poison, predators: [], obstacles, neighbors: vehicles, champion };
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    v.applyBehaviors(ctx);
    v.update();
    v.eat(food, 0.25, v.dna[2]);
    v.eat(poison, -0.75, v.dna[3]);
    if (v.dead()) {
      if (food.length < MAX_FOOD) food.push(v.pos.copy());
      vehicles.splice(i, 1);
    }
  }
  if (vehicles.length === 0)
    for (let i = 0; i < 25; i++) vehicles.push(newColonyVehicle(random(width), random(height)));
  champion = vehicles.reduce((b, v) => (!b || v.age > b.age ? v : b), null);
  if (tick % SAMPLE_EVERY === 0) recordHistory();
}

function step() {
  tick++; game.waveTimer--;

  if (random(1) < CFG.foodProb && food.length < MAX_FOOD)
    food.push(createVector(random(25, width - 25), random(25, height - 25)));
  if (random(1) < CFG.poisonProb && poison.length < MAX_POISON)
    poison.push(createVector(random(25, width - 25), random(25, height - 25)));

  while (predators.length < CFG.predators)
    predators.push(new Predator(random(width), random(height), game.wave));
  while (predators.length > CFG.predators) predators.pop();

  if (random(1) < 0.0008 && powerups.length < 4) {
    const t = random(['shield', 'energy', 'speed']);
    powerups.push(new PowerUp(random(40, width - 40), random(40, height - 40), t));
  }

  // Contexte partagé par tous les BehaviorManagers
  const ctx = { food, poison, predators, prey: vehicles, obstacles,
                neighbors: vehicles, champion };

  // Véhicules
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    v.applyBehaviors(ctx);
    v.update();

    // Manger (les méthodes eat sont toujours dans Vehicle)
    const steerF = v.eat(food, 0.25, v.dna[2]);   // effet de bord : mange
    const steerP = v.eat(poison, -0.75, v.dna[3]);

    if (vehicles.length < MAX_VEHICLES) {
      const child = v.reproduce();
      if (child) {
        // Reconstruire le BehaviorManager du bébé
        child.behaviors
          .add('seekFood', Behaviors.seekFood(child), 1)
          .add('seekPoison', Behaviors.seekPoison(child), 1)
          .add('avoidPredators', Behaviors.avoidPredators(child), 1)
          .add('separation', Behaviors.separation(child), 0.4)
          .add('boundaries', Behaviors.boundaries(child), 1.5);
        vehicles.push(child);
        stats.births++;
        stats.maxGen = max(stats.maxGen, child.generation);
      }
    }

    if (v.dead()) {
      if (food.length < MAX_FOOD) food.push(v.pos.copy());
      vehicles.splice(i, 1); stats.deaths++;
    }
  }

  // Prédateurs (utilisent aussi leur BehaviorManager via applyBehaviors)
  for (let i = predators.length - 1; i >= 0; i--) {
    const p = predators[i];
    const kills = p.hunt(vehicles);
    stats.deaths += kills; stats.eaten += kills; game.totalEaten += kills;
    p.applyBehaviors(ctx);
    p.update();
    if (p.dead()) predators.splice(i, 1);
  }

  // Power-ups
  for (let i = powerups.length - 1; i >= 0; i--) {
    const pu = powerups[i];
    pu.applyBehaviors(ctx); pu.update();
    if (pu.dead()) { powerups.splice(i, 1); continue; }
    for (const v of vehicles) {
      if (v.pos.dist(pu.pos) < pu.r + v.r) {
        if (pu.type === 'shield') v.shield = 600;
        else if (pu.type === 'energy') { v.health = 1; game.colonyEnergy = min(100, game.colonyEnergy + 10); }
        else if (pu.type === 'speed') v.maxSpeed += 1;
        game.score += 10;
        powerups.splice(i, 1); break;
      }
    }
  }

  if (vehicles.length === 0) {
    stats.extinctions++; game.colonyEnergy -= 25;
    if (game.colonyEnergy <= 0) { endGame(); return; }
    for (let i = 0; i < 25; i++) vehicles.push(newColonyVehicle(random(width), random(height)));
    showToast('COLONIE DÉCIMÉE (-25 énergie)', true);
  }

  champion = vehicles.reduce((b, v) => (!b || v.age > b.age ? v : b), null);
  if (tick % SAMPLE_EVERY === 0) recordHistory();

  if (game.waveTimer <= 0 && !game.waveCleared) {
    game.waveCleared = true; completeWave();
  }
}

// --- Vagues -----------------------------------------------------------
function startWave() {
  if (game.running) return;
  game.wave++;
  if (game.wave > TOTAL_WAVES) { endGame(true); return; }
  game.running = true; game.waveCleared = false;
  game.waveTimer = WAVE_DURATION; paused = false;
  CFG.predators = min(15, game.wave + 1);
  document.getElementById('s-pred').value = CFG.predators;
  document.getElementById('v-pred').textContent = CFG.predators;
  for (const p of predators) p.level = game.wave;
  updateWaveTimeline();
  showToast('VAGUE ' + game.wave + ' — SURVIVEZ !', false);
  updateObjective(); updateHud();
}

function completeWave() {
  game.running = false;
  const bonus = 50 * game.wave + vehicles.length * 2;
  game.score += bonus;
  game.colonyEnergy = min(100, game.colonyEnergy + 20);
  showToast('VAGUE ' + game.wave + ' RÉUSSIE ! +' + bonus, false);
  CFG.mutation = min(0.5, CFG.mutation + 0.02);
  if (game.wave >= TOTAL_WAVES) setTimeout(() => endGame(true), 1500);
  else {
    document.getElementById('objective-text').textContent =
      'Vague terminée. Cliquez sur « Démarrer la vague ».';
    document.getElementById('b-start').textContent = '▶ Vague ' + (game.wave + 1);
  }
  updateWaveTimeline(); updateHud();
}

function endGame(victory = false) {
  game.running = false;
  showToast(victory ? 'VICTOIRE ! Score : ' + game.score
                    : 'GAME OVER — Score : ' + game.score, !victory);
  document.getElementById('objective-text').textContent =
    victory ? 'Vous avez survécu à toutes les vagues !' : 'La colonie est éteinte.';
}

function updateObjective() {
  const texts = [
    'Objectif : survivez à la vague 1 et apprenez à fuir le poison.',
    'Objectif : apprenez à fuir les prédateurs.',
    'Objectif : faites évoluer vos perceptions et vos poids.',
    'Objectif : atteignez la génération 3.',
    'Objectif : atteignez la génération 5.',
    'Objectif : maintenez 40 véhicules en vie.',
    'Objectif : survivez à des prédateurs de niveau 6.',
    'Objectif final : survivez à la vague 8 !'
  ];
  document.getElementById('objective-text').textContent =
    texts[min(game.wave - 1, texts.length - 1)] || '';
}

// --- Affichage --------------------------------------------------------
function recordHistory() {
  const avg = new Array(6).fill(0);
  for (const v of vehicles)
    for (let i = 0; i < 6; i++) avg[i] += v.dna[i] / max(1, vehicles.length);
  history.push({ n: vehicles.length, food: food.length, poison: poison.length,
                 pred: predators.length, dna: avg });
  if (history.length > HISTORY_MAX) history.shift();
}

function drawWorld() {
  // obstacles
  for (const o of obstacles) {
    push(); translate(o.pos.x, o.pos.y);
    noStroke(); fill(120, 80, 200, 90); circle(0, 0, o.r * 2);
    noFill(); stroke(170, 130, 255, 180); strokeWeight(1.5);
    circle(0, 0, o.r * 2); pop();
  }
  fill(60, 255, 150); for (const f of food) circle(f.x, f.y, 4);
  fill(255, 60, 80);  for (const p of poison) circle(p.x, p.y, 4);
  for (const v of vehicles) v.display(v === champion);
  for (const p of predators) p.display();
  for (const pu of powerups) pu.display();
}

function drawStats() {
  if (vehicles.length === 0) return;
  let avgHealth = 0;
  for (const v of vehicles) avgHealth += v.health / vehicles.length;
  const lines = [
    ['Véhicules', vehicles.length],
    ['Prédateurs', predators.length],
    ['Nourriture / poison', food.length + ' / ' + poison.length],
    ['Obstacles', obstacles.length],
    ['Santé moyenne', avgHealth.toFixed(2)],
    ['Naissances', stats.births],
    ['Morts (prédation)', stats.deaths + ' (' + stats.eaten + ')'],
    ['Génération max', stats.maxGen],
    ['Extinctions', stats.extinctions]
  ];
  const w = 230, h = 26 + lines.length * 17 + (champion ? 112 : 0);
  const x = width - w - 12, y = 68;
  noStroke(); fill(14, 18, 30, 210); rect(x, y, w, h, 10);
  textAlign(LEFT, TOP); textSize(12); fill(110, 240, 176);
  text('STATISTIQUES', x + 12, y + 9);
  lines.forEach(([k, v], i) => {
    fill(150, 170, 195); textAlign(LEFT, TOP);  text(k, x + 12, y + 28 + i * 17);
    fill(235);           textAlign(RIGHT, TOP); text(v, x + w - 12, y + 28 + i * 17);
  });
  if (champion) {
    const cy = y + 32 + lines.length * 17;
    stroke(255, 255, 255, 40); line(x + 12, cy, x + w - 12, cy);
    noStroke(); textAlign(LEFT, TOP); fill(110, 240, 176);
    text('DOYEN — Behaviors :', x + 12, cy + 6);
    let yy = cy + 26;
    for (const [name, b] of champion.behaviors.behaviors) {
      const on = b.active ? '✓' : '✗';
      fill(b.active ? 110 : 100, b.active ? 240 : 130, b.active ? 176 : 150);
      text(`${on} ${name} (w=${b.weight.toFixed(1)})`, x + 12, yy);
      yy += 15;
    }
  }
}

// Panneau UI : liste les comportements du doyen, activables/désactivables
function renderBehaviorPanel() {
  const container = document.getElementById('behavior-list');
  container.innerHTML = '';
  if (!champion) return;
  for (const [name, b] of champion.behaviors.behaviors) {
    const row = document.createElement('div');
    row.className = 'beh-row';
    row.innerHTML = `
      <input type="checkbox" ${b.active ? 'checked' : ''} data-name="${name}">
      <span class="beh-name">${name}</span>
      <input type="range" min="0" max="3" step="0.1" value="${b.weight}" data-name="${name}">
      <span class="beh-weight">${b.weight.toFixed(1)}</span>`;
    row.querySelector('input[type=checkbox]').addEventListener('change', (e) => {
      const n = e.target.dataset.name;
      if (e.target.checked) champion.behaviors.activate(n);
      else champion.behaviors.deactivate(n);
    });
    row.querySelector('input[type=range]').addEventListener('input', (e) => {
      const n = e.target.dataset.name;
      champion.behaviors.changeWeight(n, parseFloat(e.target.value));
      e.target.nextElementSibling.textContent = parseFloat(e.target.value).toFixed(1);
    });
    container.appendChild(row);
  }
}

function updateHud() {
  document.getElementById('hud-score').textContent = game.score;
  document.getElementById('hud-wave').textContent = game.wave + '/' + TOTAL_WAVES;
  document.getElementById('hud-pop').textContent = vehicles.length;
  document.getElementById('hud-gen').textContent = stats.maxGen;
  document.getElementById('hud-energy').textContent = Math.round(game.colonyEnergy) + '%';
  document.getElementById('hud-energy').style.color = game.colonyEnergy < 30 ? '#ff4060' : '#6ef0b0';
  const pct = game.running ? (game.waveTimer / WAVE_DURATION) * 100 : 0;
  document.getElementById('wave-timer-bar').style.width = pct + '%';
  // Mettre à jour le panneau de comportements quand le doyen change
  if (champion && document.getElementById('behavior-list').children.length === 0)
    renderBehaviorPanel();
}

function updateWaveTimeline() {
  document.querySelectorAll('.wave-dot').forEach(dot => {
    const w = parseInt(dot.dataset.wave);
    dot.classList.toggle('active', w === game.wave && game.running);
    dot.classList.toggle('done', w < game.wave || (w === game.wave && game.waveCleared));
  });
}

function showToast(text, danger) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.toggle('danger', danger); t.classList.add('show');
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.remove('show'), 1800);
}

// --- Graphiques -------------------------------------------------------
function drawCharts() {
  if (history.length < 2) return;
  const w = 270, h = 90, gap = 10, x = 12;
  let y = height - 3 * (h + gap) - 20 + gap;
  const green = [60, 255, 150], red = [255, 60, 80],
        orange = [255, 170, 40], blue = [110, 180, 255];
  drawChart(x, y, w, h, 'Population', [
    { label: 'véhicules', col: green, data: history.map(s => s.n) },
    { label: 'nourriture', col: blue, data: history.map(s => s.food) },
    { label: 'poison', col: red, data: history.map(s => s.poison) }
  ], 0, null);
  y += h + gap;
  drawChart(x, y, w, h, 'Poids moyens des gènes', [
    { label: 'nourriture', col: green, data: history.map(s => s.dna[0]) },
    { label: 'poison', col: red, data: history.map(s => s.dna[1]) },
    { label: 'prédateur', col: orange, data: history.map(s => s.dna[4]) }
  ], -3, 3);
  y += h + gap;
  drawChart(x, y, w, h, 'Perception moyenne (px)', [
    { label: 'nourriture', col: green, data: history.map(s => s.dna[2]) },
    { label: 'poison', col: red, data: history.map(s => s.dna[3]) },
    { label: 'prédateur', col: orange, data: history.map(s => s.dna[5]) }
  ], 0, 300);
}

function drawChart(x, y, w, h, title, series, minV, maxV) {
  if (maxV === null) { maxV = 10; for (const s of series) for (const v of s.data) maxV = max(maxV, v); }
  noStroke(); fill(14, 18, 30, 210); rect(x, y, w, h, 8);
  textAlign(LEFT, TOP); textSize(11); fill(190, 205, 225);
  text(title, x + 8, y + 6);
  let lx = x + w - 8; textAlign(RIGHT, TOP);
  for (let i = series.length - 1; i >= 0; i--) {
    const s = series[i]; fill(...s.col); text(s.label, lx, y + 6);
    lx -= textWidth(s.label) + 8;
  }
  const px = x + 8, py = y + 24, pw = w - 16, ph = h - 32;
  if (minV < 0) {
    stroke(255, 255, 255, 50);
    line(px, map(0, minV, maxV, py + ph, py), px + pw, map(0, minV, maxV, py + ph, py));
  }
  noFill(); strokeWeight(1.5);
  for (const s of series) {
    stroke(...s.col); beginShape();
    for (let i = 0; i < s.data.length; i++) {
      const sx = px + (i / (HISTORY_MAX - 1)) * pw;
      const sy = map(s.data[i], minV, maxV, py + ph, py, true);
      vertex(sx, sy);
    }
    endShape();
  }
  strokeWeight(1);
}

// --- Interactions -----------------------------------------------------
function overPanel(e) { return e && e.target && e.target.tagName !== 'CANVAS'; }
function mousePressed(e) {
  if (overPanel(e)) return;
  vehicles.push(newColonyVehicle(mouseX, mouseY));
}
function mouseDragged(e) {
  if (overPanel(e)) return;
  if (frameCount % 3 === 0) vehicles.push(newColonyVehicle(mouseX, mouseY));
}
function keyPressed() {
  const k = key.toLowerCase();
  if (k === 'd') toggleCheckbox('c-debug');
  else if (k === 't') toggleCheckbox('c-trails');
  else if (k === 'r') initSimulation();
  else if (k === 'p') predators.push(new Predator(mouseX, mouseY, game.wave));
  else if (k === 'f') burst(food, MAX_FOOD);
  else if (k === 'x') burst(poison, MAX_POISON);
  else if (k === 'o') obstacles.push({ pos: createVector(mouseX, mouseY), r: 40 });
  else if (key === ' ') { togglePause(); return false; }
}
function burst(list, cap) {
  for (let i = 0; i < 15 && list.length < cap; i++)
    list.push(createVector(mouseX + randomGaussian(0, 30), mouseY + randomGaussian(0, 30)));
}
function windowResized() { resizeCanvas(windowWidth, windowHeight); }

// --- UI ---------------------------------------------------------------
function bindSlider(id, labelId, key, decimals) {
  const input = document.getElementById(id), label = document.getElementById(labelId);
  const apply = () => { CFG[key] = parseFloat(input.value); label.textContent = CFG[key].toFixed(decimals); };
  input.addEventListener('input', apply); apply();
}
function toggleCheckbox(id) {
  const c = document.getElementById(id); c.checked = !c.checked;
  c.dispatchEvent(new Event('change'));
}
function togglePause() {
  paused = !paused;
  document.getElementById('b-pause').textContent = paused ? 'Reprendre' : 'Pause';
  document.getElementById('btn-pause').textContent = paused ? 'Reprendre' : 'Pause';
}
function bindUI() {
  bindSlider('s-food', 'v-food', 'foodProb', 2);
  bindSlider('s-poison', 'v-poison', 'poisonProb', 3);
  bindSlider('s-mut', 'v-mut', 'mutation', 2);
  bindSlider('s-repro', 'v-repro', 'repro', 4);
  bindSlider('s-pred', 'v-pred', 'predators', 0);
  bindSlider('s-speed', 'v-speed', 'speed', 0);
  const debugBox = document.getElementById('c-debug'), trailBox = document.getElementById('c-trails');
  debugBox.addEventListener('change', () => { CFG.debug = debugBox.checked; });
  trailBox.addEventListener('change', () => { CFG.trails = trailBox.checked; });
  CFG.debug = debugBox.checked; CFG.trails = trailBox.checked;
  document.getElementById('b-pause').addEventListener('click', togglePause);
  document.getElementById('btn-pause').addEventListener('click', togglePause);
  document.getElementById('b-reset').addEventListener('click', initSimulation);
  document.getElementById('b-csv').addEventListener('click', exportCsv);
  document.getElementById('b-start').addEventListener('click', startWave);
  document.querySelectorAll('#panel button, #panel input')
    .forEach(el => el.addEventListener('focus', () => el.blur()));
}
function exportCsv() {
  const rows = ['sample,vehicles,food,poison,predators,w_food,w_poison,w_predator,p_food,p_poison,p_predator'];
  history.forEach((s, i) => {
    rows.push([i, s.n, s.food, s.poison, s.pred,
      s.dna[0].toFixed(3), s.dna[1].toFixed(3), s.dna[4].toFixed(3),
      s.dna[2].toFixed(1), s.dna[3].toFixed(1), s.dna[5].toFixed(1)].join(','));
  });
  saveStrings(rows, 'evoswarm.csv');
}