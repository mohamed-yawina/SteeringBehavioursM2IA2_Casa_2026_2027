// ============================================
// Classe TextVehicle - extends Vehicle
//
// ✅ Conforme au cours : sous-classe de Vehicle
// Comportement personnalisé : vise un point du texte
// ============================================

class TextVehicle extends Vehicle {
  constructor(x, y, targetPoint, index = 0, options = {}) {
    // Couleur selon la position dans le texte
    const hue = (index * 8) % 360;
    const color = `hsl(${hue}, 80%, 65%)`;

    super(x, y, {
      maxSpeed: options.maxSpeed || 6,
      maxForce: options.maxForce || 0.5,
      size: options.size || 8,
      color: color,
      trailColor: `hsla(${hue}, 80%, 65%, 0.3)`,
      maxTrailLength: 15
    });

    // Convert each text destination once when it is assigned, not per simulation tick.
    this.targetPoint = new p5.Vector(targetPoint.x, targetPoint.y, 0);
    this.index = index;
  }

  setTargetPoint(point) {
    this.targetPoint.set(point.x, point.y, 0);
  }

  // Comportement personnalisé : vise son point cible
  update(slowRadius, stopDistance) {
    if (!this.targetPoint) return;

    // ✅ Utilise arrive() hérité de Vehicle
    const force = this.arrive(this.targetPoint, slowRadius, stopDistance);
    this.lastSteering = force;
    this.applyForce(force);

    // Physique héritée
    super.update();
  }

  // Dessin spécifique (petit rond lumineux)
  show(ctx, options = {}) {
    const { showTrail } = options;

    if (showTrail && this.trail.length > 1) {
      ctx.strokeStyle = this.trailColor;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.trail[0].x, this.trail[0].y);
      for (let i = 1; i < this.trail.length; i++) {
        ctx.lineTo(this.trail[i].x, this.trail[i].y);
      }
      ctx.stroke();
    }

    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
