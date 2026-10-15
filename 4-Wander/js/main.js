// ============================================
// Point d'entrée
// ============================================

(function main() {
  const canvas = document.getElementById('game');
  const radarCanvas = document.getElementById('radarCanvas');

  UI.init();
  Game.init(canvas, radarCanvas);

  // Clics
  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    Game.handleClick(e.clientX - rect.left, e.clientY - rect.top, 0);
  });

  canvas.addEventListener('contextmenu', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    Game.handleClick(e.clientX - rect.left, e.clientY - rect.top, 2);
  });

  // Clavier
  window.addEventListener('keydown', e => {
    if (e.key === ' ') {
      e.preventDefault();
      Game.togglePause();
    }
    if (e.key === '+' || e.key === '=') Game.addAirplane();
    if (e.key === '-' || e.key === '_') {
      if (Game.airplanes.length > 0) Game.airplanes.pop();
    }
    if (e.key === 'c' || e.key === 'C') Game.clearAll();
  });
})();