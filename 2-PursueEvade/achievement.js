// ============================================
// Achievements (trophées)
// ============================================

const ACHIEVEMENTS = [
  { id: 'first_blood', name: 'Premier sang', desc: 'Attrape ta 1ère proie', icon: '🩸' },
  { id: 'combo_5', name: 'Enchaînement', desc: 'Combo ×5', icon: '🔥' },
  { id: 'combo_10', name: 'Inarrêtable', desc: 'Combo ×10', icon: '⚡' },
  { id: 'score_500', name: 'Chasseur', desc: '500 points en une partie', icon: '🎯' },
  { id: 'score_1000', name: 'Prédateur', desc: '1000 points en une partie', icon: '🏆' },
  { id: 'perfect', name: 'Sans faute', desc: '10 proies sans combo perdu', icon: '💎' }
];

function drawAchievementsPanel() {
  let a = getAchievements();
  let total = ACHIEVEMENTS.length;
  let unlocked = Object.keys(a).length;

  push();
  textAlign(LEFT, TOP);

  fill(255, 220, 100);
  textSize(16);
  textStyle(BOLD);
  text(`🏆 SUCCÈS ${unlocked}/${total}`, width - 380, 20);
  textStyle(NORMAL);

  for (let i = 0; i < ACHIEVEMENTS.length; i++) {
    let ach = ACHIEVEMENTS[i];
    let y = 50 + i * 28;
    let isUnlocked = a[ach.id];

    textSize(18);
    fill(isUnlocked ? 255 : 80);
    text(ach.icon, width - 380, y);

    textSize(13);
    fill(isUnlocked ? color(255, 220, 100) : color(80, 80, 100));
    textStyle(isUnlocked ? BOLD : NORMAL);
    text(ach.name, width - 355, y + 2);
  }

  textStyle(NORMAL);
  pop();
}