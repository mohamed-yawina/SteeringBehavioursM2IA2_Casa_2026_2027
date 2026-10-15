// ============================================
// Gestion de la persistance avec localStorage
// ============================================

const STORAGE_KEY = 'swarmAttack_bestScore';
const TOP_SCORES_KEY = 'swarmAttack_topScores';
const PLAYER_NAME_KEY = 'swarmAttack_playerName';

// ============================================
// Meilleur score
// ============================================

function getBestScore() {
  let best = localStorage.getItem(STORAGE_KEY);
  return best ? parseInt(best) : 0;
}

function saveScore(score) {
  let best = getBestScore();
  if (score > best) {
    localStorage.setItem(STORAGE_KEY, score);
    return true;
  }
  return false;
}

// ============================================
// Top 10 des scores
// ============================================

function getTopScores() {
  let data = localStorage.getItem(TOP_SCORES_KEY);
  if (!data) return [];
  try {
    return JSON.parse(data);
  } catch (e) {
    return [];
  }
}

// Ajoute un score au top 10 avec nom du joueur
function addToTopScores(playerName, score, wave, timeSeconds) {
  let top = getTopScores();

  top.push({
    name: playerName || 'Anonyme',
    score: score,
    wave: wave,
    time: timeSeconds,
    date: new Date().toISOString().split('T')[0]
  });

  // Tri par score décroissant
  top.sort((a, b) => b.score - a.score);

  // Garde seulement le top 10
  top = top.slice(0, 10);

  localStorage.setItem(TOP_SCORES_KEY, JSON.stringify(top));
}

// ============================================
// Nom du joueur
// ============================================

function getPlayerName() {
  let name = localStorage.getItem(PLAYER_NAME_KEY);
  if (!name) {
    name = prompt('Entre ton nom pour le leaderboard :', 'Joueur');
    if (name && name.trim()) {
      name = name.trim().substring(0, 12);
      localStorage.setItem(PLAYER_NAME_KEY, name);
    } else {
      name = 'Anonyme';
    }
  }
  return name;
}

// ============================================
// Effacement
// ============================================

function clearAllScores() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem(TOP_SCORES_KEY);
  // Ne supprime PAS le nom du joueur
}