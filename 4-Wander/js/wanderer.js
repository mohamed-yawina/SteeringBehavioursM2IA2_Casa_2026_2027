// ============================================
// Classe Wanderer - extends Vehicle
//
// ✅ Conforme au cours : sous-classe de Vehicle
// Comportement personnalisé : mode de wander choisi
// ============================================

class Wanderer extends Vehicle {
  constructor(x, y, options = {}) {
    // Couleur et taille aléatoires si non fournies
    const hue = options.hue !== undefined ? options.hue : Math.random() * 360;
    const color = `hsl(${hue}, 80%, 65%)`;
    const trailColor = `hsla(${hue}, 80%, 65%, 0.3)`;
    const size = options.size || (6 + Math.random() * 10);

    super(x, y, {
      maxSpeed: options.maxSpeed || (1.5 + Math.random() * 2.5),
      maxForce: options.maxForce || 0.2,
      size: size,
      color: color,
      trailColor: trailColor,
      circleDistance: options.circleDistance || 60,
      circleRadius: options.circleRadius || 30,
      angleVariation: options.angleVariation || 0.3,
      maxTrailLength: 50
    });

    // Mode de wander
    this.mode = options.mode || 'classic';

    // Pour le mode noise
    this.noiseTime = Math.random() * 10000;

    // Vitesse initiale (sinon le véhicule reste immobile au début)
    const angle = Math.random() * Math.PI * 2;
    this.vel.set(Math.cos(angle) * this.maxSpeed, Math.sin(angle) * this.maxSpeed);
  }

  // ✅ Comportement personnalisé : choisit le mode de wander
  update(time, bounds, wanderers) {
    let force;

    switch (this.mode) {
      case 'noise':
        force = this.wanderNoise(time + this.noiseTime);
        break;

      case 'predictive':
        // Prédictif : regarde plus loin devant
        force = this.wanderPredictive();
        break;

      case 'group':
        // Groupé : wander + séparation
        force = this.wander();
        force.mult(0.7);
        const sep = this.separate(wanderers);
        force.add(sep.mult(0.5));
        break;

      case 'classic':
      default:
        force = this.wander();
        break;
    }

    // Évite les bords
    const bound = this.boundaries(bounds, 40);
    force.add(bound.mult(2));

    this.applyForce(force);

    // Physique héritée
    super.update();
  }

  // Wander prédictif (regarde plus loin)
  wanderPredictive() {
    const saved = this.circleDistance;
    this.circleDistance = this.circleDistance * 1.8;
    const force = this.wander();
    this.circleDistance = saved;
    return force;
  }

  // Séparation (pour mode groupé)
  separate(others) {
    const steeringDirection = new p5.Vector(0, 0);
    let count = 0;
    const desiredSeparation = 30;

    for (const other of others) {
      if (other === this) continue;
      const d = p5.Vector.dist(this.pos, other.pos);
      if (d > 0 && d < desiredSeparation) {
        steeringDirection.add(p5.Vector.sub(this.pos, other.pos).div(d));
        count++;
      }
    }

    if (count > 0) {
      steeringDirection.div(count);
      if (steeringDirection.magSq() > 0) {
        steeringDirection.normalize().mult(this.maxSpeed).sub(this.vel).limit(this.maxForce);
      }
    }

    return steeringDirection;
  }

  // Dessin spécifique (cercle coloré + orientation)
  show(ctx, showCircle = false, showVelocity = false) {
    const angle = Math.atan2(this.vel.y, this.vel.x);

    // Cercle de wander (pour le véhicule sélectionné)
    if (showCircle && this.selected) {
      const velMag = this.vel.mag();
      const dirX = velMag > 0.1 ? this.vel.x / velMag : 1;
      const dirY = velMag > 0.1 ? this.vel.y / velMag : 0;

      const circleX = this.pos.x + dirX * this.circleDistance;
      const circleY = this.pos.y + dirY * this.circleDistance;

      // Cercle
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.5)';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.arc(circleX, circleY, this.circleRadius, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);

      // Point visé
      const dispX = Math.cos(this.wanderAngle) * this.circleRadius;
      const dispY = Math.sin(this.wanderAngle) * this.circleRadius;
      const targetX = circleX + dispX;
      const targetY = circleY + dispY;

      // Ligne vers le point
      ctx.strokeStyle = 'rgba(255, 209, 102, 0.6)';
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(targetX, targetY);
      ctx.stroke();

      // Point jaune
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(targetX, targetY, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Vecteur vitesse
    if (showVelocity) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(this.pos.x, this.pos.y);
      ctx.lineTo(this.pos.x + this.vel.x * 8, this.pos.y + this.vel.y * 8);
      ctx.stroke();
    }

    // Corps (triangle orienté vers la vitesse)
    ctx.save();
    ctx.translate(this.pos.x, this.pos.y);
    ctx.rotate(angle);

    ctx.fillStyle = this.color;
    ctx.shadowColor = this.color;
    ctx.shadowBlur = 8;

    ctx.beginPath();
    ctx.moveTo(this.size, 0);
    ctx.lineTo(-this.size * 0.7, -this.size * 0.6);
    ctx.lineTo(-this.size * 0.7, this.size * 0.6);
    ctx.closePath();
    ctx.fill();

    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Sélection (pour afficher le cercle de wander)
  contains(x, y) {
    return p5.Vector.dist(this.pos, new p5.Vector(x, y)) < this.size + 8;
  }
}
