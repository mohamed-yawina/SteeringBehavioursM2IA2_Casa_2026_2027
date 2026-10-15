// ============================================
// Classe TrailParticle - extends Vehicle
// ============================================

class TrailParticle extends Vehicle {
  constructor(x, y, options = {}) {
    super(x, y, {
      maxSpeed: options.maxSpeed || 2,
      maxForce: options.maxForce || 0.3,
      size: options.size || 3,
      color: options.color || '#5ec8ff'
    });

    const angle = Math.random() * Math.PI * 2;
    const speed = 1 + Math.random() * 2;
    this.vel.set(Math.cos(angle) * speed, Math.sin(angle) * speed);

    this.life = 1;
    this.decay = options.decay || 0.025;
  }

  update() {
    super.update();
    this.life -= this.decay;
    if (this.life <= 0) this.alive = false;
  }

  show(ctx) {
    ctx.globalAlpha = this.life;
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.pos.x, this.pos.y, this.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }
}

// Gestionnaire
const ParticleSystem = {
  particles: [],

  spawn(x, y, color, count = 10) {
    for (let i = 0; i < count; i++) {
      this.particles.push(new TrailParticle(x, y, {
        color: color,
        size: 2 + Math.random() * 3
      }));
    }
  },

  update() {
    for (const p of this.particles) p.update();
    this.particles = this.particles.filter(p => p.alive);
  },

  draw(ctx) {
    for (const p of this.particles) p.show(ctx);
  },

  clear() {
    this.particles = [];
  }
};
