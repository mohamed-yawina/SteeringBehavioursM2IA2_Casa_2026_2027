// ============================================
// Classe WeatherZone - extends Vehicle
//
// ✅ Conforme au cours : sous-classe de Vehicle
// Une zone de turbulence (immobile) que les avions évitent
// ============================================

class WeatherZone extends Vehicle {
  constructor(x, y, radius = 60) {
    super(x, y, {
      maxSpeed: 0,
      maxForce: 0,
      size: radius,
      color: '#b69aff'
    });

    this.radius = radius;
    this.pulse = 0;
    this.rotation = 0;
  }

  update() {
    this.pulse += 0.03;
    this.rotation += 0.005;
  }

  show(ctx) {
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(this.rotation);

    // Halo externe
    const pulseRadius = this.radius + Math.sin(this.pulse) * 5;
    const grad = ctx.createRadialGradient(0, 0, this.radius * 0.3, 0, 0, pulseRadius);
    grad.addColorStop(0, 'rgba(182, 154, 255, 0.4)');
    grad.addColorStop(1, 'rgba(182, 154, 255, 0)');

    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, 0, pulseRadius, 0, Math.PI * 2);
    ctx.fill();

    // Bordure pointillée
    ctx.strokeStyle = 'rgba(182, 154, 255, 0.8)';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);

    // Éclair stylisé
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.moveTo(-8, -10);
    ctx.lineTo(4, -2);
    ctx.lineTo(-2, 2);
    ctx.lineTo(8, 12);
    ctx.lineTo(-4, 4);
    ctx.lineTo(2, 0);
    ctx.closePath();
    ctx.fill();

    ctx.restore();
  }
}