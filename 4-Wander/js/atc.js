// ============================================
// ATC - Air Traffic Controller
// Gère les alertes de collision
// ============================================

class ATC {
  constructor() {
    this.alerts = [];
  }

  // Vérifie les collisions entre avions
  update(airplanes) {
    this.alerts = [];

    for (let i = 0; i < airplanes.length; i++) {
      for (let j = i + 1; j < airplanes.length; j++) {
        const a = airplanes[i];
        const b = airplanes[j];
        const d = p5.Vector.dist(a.pos, b.pos);

        if (d < 40) {
          this.alerts.push({
            level: 'CRITICAL',
            planeA: a.callsign,
            planeB: b.callsign,
            distance: d
          });
        } else if (d < 80) {
          this.alerts.push({
            level: 'WARNING',
            planeA: a.callsign,
            planeB: b.callsign,
            distance: d
          });
        }
      }
    }

    return this.alerts;
  }

  draw(ctx, width, height) {
    if (this.alerts.length === 0) return;

    // Compte les alertes critiques
    const critical = this.alerts.filter(a => a.level === 'CRITICAL').length;

    if (critical === 0) return;

    // Bandeau clignotant
    const alpha = 0.5 + Math.sin(performance.now() / 150) * 0.5;

    ctx.fillStyle = `rgba(255, 101, 122, ${alpha * 0.3})`;
    ctx.fillRect(0, 0, width, 32);

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`⚠ ALERTE COLLISION (${critical})`, width / 2, 20);
  }
}
