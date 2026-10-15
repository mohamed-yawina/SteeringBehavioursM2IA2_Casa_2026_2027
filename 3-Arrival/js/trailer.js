// ============================================
// Classe Trailer - extends Vehicle
//
// ✅ Conforme au cours : sous-classe de Vehicle
// Comportement personnalisé : suit son prédécesseur
// en mode Snake
// ============================================

class Trailer extends Vehicle {
  constructor(x, y, index = 0, options = {}) {
    // Couleur arc-en-ciel selon l'index
    const hue = (index * 25) % 360;
    const color = `hsl(${hue}, 75%, 60%)`;

    super(x, y, {
      maxSpeed: options.maxSpeed || 8,
      maxForce: options.maxForce || 1,
      size: options.size || 14,
      color: color,
      trailColor: `hsla(${hue}, 75%, 60%, 0.3)`,
      maxTrailLength: 20
    });

    this.index = index;
    this.followTarget = null;
  }

  // Comportement personnalisé : suit le véhicule précédent
  update(followTarget, slowRadius, stopDistance) {
    if (!followTarget) return;

    // ✅ Utilise arrive() hérité de Vehicle
    const force = this.arrive(followTarget.pos, slowRadius, stopDistance);
    this.lastSteering = force;
    this.applyForce(force);

    // Physique héritée
    super.update();
  }

  // Dessin spécifique (rond avec œil directionnel)
  show(ctx, options = {}) {
    const { showTrail } = options;

    if (showTrail && this.trail.length > 1) {
      ctx.strokeStyle = this.trailColor;
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();
    }

    // Halo
    ctx.fillStyle = this.color.replace(')', ', 0.3)').replace('hsl', 'hsla');
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.size * 1.2, 0, Math.PI * 2);
    ctx.fill();

    // Corps
    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 6;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Détail intérieur
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.size / 4, 0, Math.PI * 2);
    ctx.fill();
  }

  // Ligne entre deux trailers
  static drawLink(ctx, a, b) {
    ctx.strokeStyle = 'rgba(94, 200, 255, 0.2)';
    ctx.lineWidth = 8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(a.pos.x, a.pos.y);
    ctx.lineTo(b.pos.x, b.pos.y);
    ctx.stroke();
  }
}
