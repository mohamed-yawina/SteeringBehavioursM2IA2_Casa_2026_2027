// TD 8 - Evolutionary Steering Behavior
// Version étendue du Coding Challenge 69 (Daniel Shiffman) :
//  - 6 gènes (nourriture, poison, prédateurs) : poids + rayons de perception
//  - prédateurs (wander + pursue) qui créent une pression de sélection
//  - sliders, vitesse de simulation, pause, reset, export CSV
//  - graphiques temps réel : population, poids moyens, perceptions moyennes
//
// Touches : clic/glisser = véhicules | P = prédateur | F = nourriture | X = poison
//           D = debug | T = traînées | espace = pause | R = reset

// Paramètres réglables (liés au panneau HTML)
const CFG = {
  foodProb: 0.2,
  poisonProb: 0.02,
  mutation: 0.15,
  repro: 0.004,
  drain: 0.003,      // vie perdue par frame
  predators: 2,
  speed: 1,
  debug: false,
  trails: true
};

const MAX_FOOD = 250;
const MAX_POISON = 60;
const MAX_VEHICLES = 300;
const HISTORY_MAX = 300;      // nombre d'échantillons gardés pour les graphiques
const SAMPLE_EVERY = 20;      // un échantillon toutes les 20 frames de simulation

let vehicles = [];
let food = [];
let poison = [];
let predators = [];

let history = [];
let champion = null;
let paused = false;
let tick = 0;
const stats = { births: 0, deaths: 0, eaten: 0, extinctions: 0, maxGen: 1 };

function setup() {
  createCanvas(windowWidth, windowHeight);
  bindUI();
  initSimulation();
}

function initSimulation() {
  vehicles = []; food = []; poison = []; predators = []; history = [];
  champion = null; tick = 0;
  Object.assign(stats, { births: 0, deaths: 0, eaten: 0, extinctions: 0, maxGen: 1 });

  for (let i = 0; i < 40; i++) vehicles.push(new Vehicle(random(width), random(height)));
  for (let i = 0; i < 60; i++) food.push(createVector(random(width), random(height)));
  for (let i = 0; i < 20; i++) poison.push(createVector(random(width), random(height)));
}

// ---------------------------------------------------------------------------
// Boucle principale
// ---------------------------------------------------------------------------
function draw() {
  if (CFG.trails) background(8, 10, 18, 60);
  else background(8, 10, 18);

  if (!paused) {
    for (let i = 0; i < CFG.speed; i++) step();
  }

  drawWorld();
  drawCharts();
  drawStats();
}

// Un pas de simulation (appelé plusieurs fois par frame si vitesse > 1)
function step() {
  tick++;

  // Apparition aléatoire de nourriture et de poison
  if (random(1) < CFG.foodProb && food.length < MAX_FOOD) {
    food.push(createVector(random(25, width - 25), random(25, height - 25)));
  }
  if (random(1) < CFG.poisonProb && poison.length < MAX_POISON) {
    poison.push(createVector(random(25, width - 25), random(25, height - 25)));
  }

  // Maintien du nombre de prédateurs demandé par le slider
  while (predators.length < CFG.predators) predators.push(new Predator(random(width), random(height)));
  while (predators.length > CFG.predators) predators.pop();

  // Véhicules (parcours à l'envers pour pouvoir supprimer)
  for (let i = vehicles.length - 1; i >= 0; i--) {
    const v = vehicles[i];
    v.behaviors(food, poison, predators);
    v.update();

    if (vehicles.length < MAX_VEHICLES) {
      const child = v.reproduce();
      if (child) {
        vehicles.push(child);
        stats.births++;
        stats.maxGen = max(stats.maxGen, child.generation);
      }
    }

    // Mort : le cadavre devient de la nourriture
    if (v.dead()) {
      if (food.length < MAX_FOOD) food.push(v.pos.copy());
      vehicles.splice(i, 1);
      stats.deaths++;
    }
  }

  // Prédateurs : ils chassent les véhicules, laissent un peu de nourriture
  for (let i = predators.length - 1; i >= 0; i--) {
    const p = predators[i];
    const kills = p.hunt(vehicles);
    stats.deaths += kills;
    stats.eaten += kills;
    p.update();
    if (p.dead()) predators.splice(i, 1);   // sera remplacé au prochain pas
  }

  // Extinction : on repart avec une nouvelle population aléatoire
  if (vehicles.length === 0) {
    stats.extinctions++;
    for (let i = 0; i < 25; i++) vehicles.push(new Vehicle(random(width), random(height)));
  }

  // Le doyen = individu vivant le plus âgé
  champion = vehicles.reduce((best, v) => (!best || v.age > best.age ? v : best), null);

  if (tick % SAMPLE_EVERY === 0) recordHistory();
}

function recordHistory() {
  const avg = new Array(6).fill(0);
  for (const v of vehicles) for (let i = 0; i < 6; i++) avg[i] += v.dna[i] / vehicles.length;
  history.push({
    n: vehicles.length,
    food: food.length,
    poison: poison.length,
    pred: predators.length,
    dna: avg
  });
  if (history.length > HISTORY_MAX) history.shift();
}

// ---------------------------------------------------------------------------
// Affichage
// ---------------------------------------------------------------------------
function drawWorld() {
  noStroke();
  fill(60, 255, 150);
  for (const f of food) circle(f.x, f.y, 4);
  fill(255, 60, 80);
  for (const p of poison) circle(p.x, p.y, 4);

  for (const v of vehicles) v.display(v === champion);
  for (const p of predators) p.display();
}

function drawStats() {
  let avgHealth = 0;
  for (const v of vehicles) avgHealth += v.health / vehicles.length;

  const lines = [
    ['Véhicules', vehicles.length],
    ['Prédateurs', predators.length],
    ['Nourriture / poison', food.length + ' / ' + poison.length],
    ['Santé moyenne', avgHealth.toFixed(2)],
    ['Naissances', stats.births],
    ['Morts (dont prédation)', stats.deaths + ' (' + stats.eaten + ')'],
    ['Génération max', stats.maxGen],
    ['Extinctions', stats.extinctions]
  ];

  const w = 230;
  const h = 26 + lines.length * 17 + (champion ? 112 : 0);
  const x = width - w - 12;
  const y = 12;

  noStroke();
  fill(14, 18, 30, 210);
  rect(x, y, w, h, 10);

  textAlign(LEFT, TOP);
  textSize(12);
  fill(110, 240, 176);
  text('STATISTIQUES', x + 12, y + 9);
  lines.forEach(([k, v], i) => {
    fill(150, 170, 195); textAlign(LEFT, TOP);  text(k, x + 12, y + 28 + i * 17);
    fill(235);           textAlign(RIGHT, TOP); text(v, x + w - 12, y + 28 + i * 17);
  });

  if (champion) {
    const cy = y + 32 + lines.length * 17;
    stroke(255, 255, 255, 40); line(x + 12, cy, x + w - 12, cy);
    noStroke();
    textAlign(LEFT, TOP); fill(110, 240, 176);
    text('DOYEN (anneau blanc)', x + 12, cy + 6);
    const d = champion.dna;
    const rows = [
      ['Âge / génération', champion.age + ' / ' + champion.generation],
      ['Poids nourr. / poison', d[0].toFixed(2) + ' / ' + d[1].toFixed(2)],
      ['Poids prédateur', d[4].toFixed(2)],
      ['Vision nourr. / poison', d[2].toFixed(0) + ' / ' + d[3].toFixed(0)],
      ['Vision prédateur', d[5].toFixed(0)]
    ];
    rows.forEach(([k, v], i) => {
      fill(150, 170, 195); textAlign(LEFT, TOP);  text(k, x + 12, cy + 26 + i * 16);
      fill(235);           textAlign(RIGHT, TOP); text(v, x + w - 12, cy + 26 + i * 16);
    });
  }
}

// Graphiques temps réel (population, poids moyens, perceptions moyennes)
function drawCharts() {
  if (history.length < 2) return;
  const w = 270, h = 90, gap = 10;
  const x = 12;
  let y = height - 3 * (h + gap) - 2 + gap;

  const green = [60, 255, 150], red = [255, 60, 80], orange = [255, 170, 40], blue = [110, 180, 255];

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
  // Échelle automatique si maxV non fourni
  if (maxV === null) {
    maxV = 10;
    for (const s of series) for (const v of s.data) maxV = max(maxV, v);
  }

  noStroke();
  fill(14, 18, 30, 210);
  rect(x, y, w, h, 8);

  textAlign(LEFT, TOP);
  textSize(11);
  fill(190, 205, 225);
  text(title, x + 8, y + 6);

  // légende
  let lx = x + w - 8;
  textAlign(RIGHT, TOP);
  for (let i = series.length - 1; i >= 0; i--) {
    const s = series[i];
    fill(...s.col);
    text(s.label, lx, y + 6);
    lx -= textWidth(s.label) + 8;
  }

  const px = x + 8, py = y + 24, pw = w - 16, ph = h - 32;

  // ligne zéro
  if (minV < 0) {
    stroke(255, 255, 255, 50);
    const zy = map(0, minV, maxV, py + ph, py);
    line(px, zy, px + pw, zy);
  }

  noFill();
  strokeWeight(1.5);
  for (const s of series) {
    stroke(...s.col);
    beginShape();
    for (let i = 0; i < s.data.length; i++) {
      const sx = px + (i / (HISTORY_MAX - 1)) * pw;
      const sy = map(s.data[i], minV, maxV, py + ph, py, true);
      vertex(sx, sy);
    }
    endShape();
  }
  strokeWeight(1);
}

// ---------------------------------------------------------------------------
// Interactions
// ---------------------------------------------------------------------------
function overPanel(e) {
  return e && e.target && e.target.tagName !== 'CANVAS';
}

function mousePressed(e) {
  if (overPanel(e)) return;
  vehicles.push(new Vehicle(mouseX, mouseY));
}

function mouseDragged(e) {
  if (overPanel(e)) return;
  if (frameCount % 3 === 0) vehicles.push(new Vehicle(mouseX, mouseY));
}

function keyPressed() {
  const k = key.toLowerCase();
  if (k === 'd') toggleCheckbox('c-debug');
  else if (k === 't') toggleCheckbox('c-trails');
  else if (k === 'r') initSimulation();
  else if (k === 'p') predators.push(new Predator(mouseX, mouseY));
  else if (k === 'f') burst(food, MAX_FOOD);
  else if (k === 'x') burst(poison, MAX_POISON);
  else if (key === ' ') { togglePause(); return false; }
}

// Gerbe de 15 éléments autour de la souris
function burst(list, cap) {
  for (let i = 0; i < 15 && list.length < cap; i++) {
    list.push(createVector(mouseX + randomGaussian(0, 30), mouseY + randomGaussian(0, 30)));
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}

// ---------------------------------------------------------------------------
// Panneau HTML
// ---------------------------------------------------------------------------
function bindSlider(id, labelId, key, decimals) {
  const input = document.getElementById(id);
  const label = document.getElementById(labelId);
  const apply = () => {
    CFG[key] = parseFloat(input.value);
    label.textContent = CFG[key].toFixed(decimals);
  };
  input.addEventListener('input', apply);
  apply();
}

function toggleCheckbox(id) {
  const c = document.getElementById(id);
  c.checked = !c.checked;
  c.dispatchEvent(new Event('change'));
}

function togglePause() {
  paused = !paused;
  document.getElementById('b-pause').textContent = paused ? 'Reprendre (espace)' : 'Pause (espace)';
}

function bindUI() {
  bindSlider('s-food', 'v-food', 'foodProb', 2);
  bindSlider('s-poison', 'v-poison', 'poisonProb', 3);
  bindSlider('s-mut', 'v-mut', 'mutation', 2);
  bindSlider('s-repro', 'v-repro', 'repro', 4);
  bindSlider('s-pred', 'v-pred', 'predators', 0);
  bindSlider('s-speed', 'v-speed', 'speed', 0);

  const debugBox = document.getElementById('c-debug');
  const trailBox = document.getElementById('c-trails');
  debugBox.addEventListener('change', () => { CFG.debug = debugBox.checked; });
  trailBox.addEventListener('change', () => { CFG.trails = trailBox.checked; });
  CFG.debug = debugBox.checked;
  CFG.trails = trailBox.checked;

  document.getElementById('b-pause').addEventListener('click', togglePause);
  document.getElementById('b-reset').addEventListener('click', initSimulation);
  document.getElementById('b-csv').addEventListener('click', exportCsv);
  // On évite que la barre d'espace "clique" sur le dernier bouton utilisé
  document.querySelectorAll('#panel button, #panel input').forEach(el =>
    el.addEventListener('focus', () => el.blur(), { once: false }));
}

// Export des courbes d'évolution pour le rapport (Excel, Python...)
function exportCsv() {
  const rows = ['sample,vehicles,food,poison,predators,w_food,w_poison,w_predator,p_food,p_poison,p_predator'];
  history.forEach((s, i) => {
    rows.push([i, s.n, s.food, s.poison, s.pred,
      s.dna[0].toFixed(3), s.dna[1].toFixed(3), s.dna[4].toFixed(3),
      s.dna[2].toFixed(1), s.dna[3].toFixed(1), s.dna[5].toFixed(1)].join(','));
  });
  saveStrings(rows, 'evolution.csv');
}