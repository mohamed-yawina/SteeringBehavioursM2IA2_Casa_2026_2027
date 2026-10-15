// ============================================
// Stockage local
// ============================================

function getBestScore() {
  let b = localStorage.getItem('pvp_best');
  return b ? parseInt(b) : 0;
}

function saveBestScore(score) {
  let b = getBestScore();
  if (score > b) {
    localStorage.setItem('pvp_best', score);
    return true;
  }
  return false;
}

function getTopScores() {
  let d = localStorage.getItem('pvp_top');
  if (!d) return [];
  try { return JSON.parse(d); } catch (e) { return []; }
}

function addToTopScores(name, score, caught, combo) {
  let top = getTopScores();
  top.push({
    name: name || 'Anonyme',
    score, caught, combo,
    date: new Date().toISOString().split('T')[0]
  });
  top.sort((a, b) => b.score - a.score);
  top = top.slice(0, 5);
  localStorage.setItem('pvp_top', JSON.stringify(top));
}

function getPlayerName() {
  let n = localStorage.getItem('pvp_name');
  if (!n) {
    n = prompt('Ton nom pour le leaderboard :', 'Joueur') || 'Anonyme';
    n = n.trim().substring(0, 10);
    localStorage.setItem('pvp_name', n);
  }
  return n;
}

function getAchievements() {
  let d = localStorage.getItem('pvp_achievements');
  if (!d) return {};
  try { return JSON.parse(d); } catch (e) { return {}; }
}

function unlockAchievement(id) {
  let a = getAchievements();
  if (!a[id]) {
    a[id] = true;
    localStorage.setItem('pvp_achievements', JSON.stringify(a));
    return true;
  }
  return false;
}