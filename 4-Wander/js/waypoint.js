// ============================================
// Classe Waypoint - extends Vehicle
//
// ✅ Conforme au cours : sous-classe de Vehicle
// Un waypoint est un point fixe animé (pulse)
// ============================================

class Waypoint extends Vehicle {
  constructor(x, y, index = 0) {
    super(x, y, {
      maxSpeed: 0,  // Immobile
      maxForce: 0,
      size: 20,
      color: '#ffd166'
    });

    this.index = index;
    this.pulse = 0;
  }

  update() {
    this.pulse += 0.05;
  }

  show(ctx, showLabel = true) {
    const pulseSize = this.size + Math.sin(this.pulse) * 4;

    // Halo
    ctx.fillStyle = 'rgba(255, 209, 102, 0.15)';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, pulseSize * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Cercle
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, pulseSize, 0, Math.PI * 2);
    ctx.stroke();

    // Point central
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, 3, 0, Math.PI * 2);
    ctx.fill();

    // Index
    if (showLabel) {
      ctx.fillStyle = '#ffd166';
      ctx.font = 'bold 10px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(`W${this.index + 1}`, this.pos.x, this.pos.y - pulseSize - 6);
    }
  }
}