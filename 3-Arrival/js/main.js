// ============================================
// Point d'entrée
// ============================================

(function main() {
  // This app owns its Canvas 2D loop. It only consumes p5.Vector as a math type;
  // no p5 setup/draw lifecycle is started, so there is no second canvas or loop.
  if (!window.p5 || typeof window.p5.Vector !== 'function') {
    throw new Error('The local p5.Vector library must load before the TD3 application.');
  }

  const canvas = document.getElementById('game');

  UI.init();
  Game.init(canvas);

  // Souris
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    Game.handleMouseMove(e.clientX - rect.left, e.clientY - rect.top);
  });

  canvas.addEventListener('click', e => {
    const rect = canvas.getBoundingClientRect();
    Game.handleClick(e.clientX - rect.left, e.clientY - rect.top, 0);
  });

  // Clavier
  window.addEventListener('keydown', e => {
    if (e.key === ' ') {
      e.preventDefault();
      Game.togglePause();
    }
    if (e.key === 'r' || e.key === 'R') Game.reset();
    if (e.key === '+' || e.key === '=') Game.addVehicle();
    if (e.key === '-' || e.key === '_') {
      if (Game.vehicles.length > 0) Game.vehicles.pop();
    }
    if (e.key === 'c' || e.key === 'C') Game.clearAll();
  });
})();
