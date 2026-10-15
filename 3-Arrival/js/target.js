// ============================================
// Classe Target - extends Vehicle
//
// ✅ Conforme au cours : sous-classe de Vehicle
// Comportement personnalisé : suit la souris
// ============================================

class Target extends Vehicle {
  constructor(x, y) {
    super(x, y, {
      maxSpeed: 0,
      maxForce: 0,
      size: 20,
      color: '#ffd166'
    });

    this.pulse = 0;
  }

  // Comportement personnalisé : suit la souris
  update(mouseX, mouseY) {
    this.pos.set(mouseX, mouseY, 0);
    this.pulse += 0.08;
  }

  // Dessin spécifique : cible animée
  show(ctx) {
    const pulseSize = this.size + Math.sin(this.pulse) * 3;

    // Halo externe
    ctx.fillStyle = 'rgba(255, 209, 102, 0.15)';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, pulseSize * 1.8, 0, Math.PI * 2);
    ctx.fill();

    // Cercle moyen
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, pulseSize * 1.2, 0, Math.PI * 2);
    ctx.stroke();

    // Cercle principal
    ctx.fillStyle = '#ffd166';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, pulseSize * 0.5, 0, Math.PI * 2);
    ctx.fill();

    // Centre blanc
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, pulseSize * 0.15, 0, Math.PI * 2);
    ctx.fill();

    // Réticule
    ctx.strokeStyle = 'rgba(255, 209, 102, 0.6)';
    ctx.lineWidth = 1.5;
    const crossSize = pulseSize * 1.6;
    ctx.beginPath();
    ctx.moveTo(this.pos.x - crossSize, this.pos.y);
    ctx.lineTo(this.pos.x - crossSize * 0.6, this.pos.y);
    ctx.moveTo(this.pos.x + crossSize * 0.6, this.pos.y);
    ctx.lineTo(this.pos.x + crossSize, this.pos.y);
    ctx.moveTo(this.pos.x, this.pos.y - crossSize);
    ctx.lineTo(this.pos.x, this.pos.y - crossSize * 0.6);
    ctx.moveTo(this.pos.x, this.pos.y + crossSize * 0.6);
    ctx.lineTo(this.pos.x, this.pos.y + crossSize);
    ctx.stroke();
  }
}
