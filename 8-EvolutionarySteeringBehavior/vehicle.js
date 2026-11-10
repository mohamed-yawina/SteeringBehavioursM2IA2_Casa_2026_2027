// =====================================================================
// Vehicle — classe MÈRE de tous les objets animés.
// Contient TOUS les comportements de base (steering behaviors de Reynolds).
// Chaque instance possède un BehaviorManager (voir behavior_manager.js).
// =====================================================================

const GENE_WEIGHTS = [0, 1, 4];
const GENE_PERCEPTIONS = [2, 3, 5];

class Vehicle {
  constructor(x, y, parentDna, generation = 1, opts = {}) {
    this.pos = createVector(x, y);
    this.vel = p5.Vector.random2D().mult(2);
    this.acc = createVector(0, 0);
    this.r = opts.r ?? 4;
    this.maxSpeed = opts.maxSpeed ?? 4.5;
    this.maxForce = opts.maxForce ?? 0.4;
    this.eatRadius = opts.eatRadius ?? 5;
    this.health = 1;
    this.age = 0;
    this.generation = generation;
    this.dna = parentDna ? Vehicle.mutate(parentDna) : Vehicle.randomDna();

    // État visuel
    this.trail = [];
    this.flash = 0;
    this.hurtFlash = 0;
    this.shield = 0;
    this.color = opts.color ?? null;

    // NOUVEAU : BehaviorManager associé à chaque véhicule
    this.behaviors = new BehaviorManager(this);
  }

  // --- ADN / évolution -------------------------------------------------
  static randomDna() {
    return [random(-2, 2), random(-2, 2), random(20, 150),
            random(20, 150), random(-2, 2), random(30, 200)];
  }
  static mutate(parentDna) {
    const dna = parentDna.slice();
    for (const i of GENE_WEIGHTS)
      if (random(1) < CFG.mutation)
        dna[i] = constrain(dna[i] + randomGaussian(0, 0.25), -3, 3);
    for (const i of GENE_PERCEPTIONS)
      if (random(1) < CFG.mutation)
        dna[i] = constrain(dna[i] + randomGaussian(0, 12), 10, 300);
    return dna;
  }
  reproduce() {
    if (this.health > 0.6 && this.age > 200 && random(1) < CFG.repro) {
      this.health -= 0.25;
      return new Vehicle(this.pos.x + random(-6, 6), this.pos.y + random(-6, 6),
                         this.dna, this.generation + 1);
    }
    return null;
  }

  // --- Application ----------------------------------------------------
  applyForce(force) { this.acc.add(force); }

  update() {
    this.health -= CFG.drain;
    this.age++;
    if (this.flash > 0) this.flash--;
    if (this.hurtFlash > 0) this.hurtFlash--;
    if (this.shield > 0) this.shield--;

    this.vel.add(this.acc);
    const sf = 0.55 + 0.45 * constrain(this.health, 0, 1);
    this.vel.limit(this.maxSpeed * sf);
    this.pos.add(this.vel);
    this.acc.mult(0);

    if (CFG.trails) {
      this.trail.push(this.pos.copy());
      if (this.trail.length > 12) this.trail.shift();
    } else this.trail.length = 0;
  }

  dead() { return this.health <= 0; }

  // =====================================================================
  // COMPORTEMENTS DE BASE (tous dans Vehicle — exigence du cours)
  // =====================================================================

  // 1) SEEK — Reynolds : steer = desired - velocity
  seek(target) {
    const desired = p5.Vector.sub(target, this.pos).setMag(this.maxSpeed);
    return p5.Vector.sub(desired, this.vel).limit(this.maxForce);
  }

  // 2) FLEE — l'inverse de SEEK. IMPORTANT : on inverse la VITESSE
  //    désirée, PAS la force (cf. Craig Reynolds / page 18 du cours).
  flee(target) {
    const desired = p5.Vector.sub(target, this.pos).setMag(this.maxSpeed).mult(-1);
    return p5.Vector.sub(desired, this.vel).limit(this.maxForce);
  }

  // 3) ARRIVE — seek avec slowing radius (page 22 du cours)
  arrive(target, slowingRadius = 100, targetOffset = 0) {
    const desired = p5.Vector.sub(target, this.pos);
    const d = desired.mag() - targetOffset;
    if (d < 0) return createVector(0, 0);
    let speed = this.maxSpeed;
    if (d < slowingRadius) speed = this.maxSpeed * (d / slowingRadius);
    desired.setMag(speed);
    return p5.Vector.sub(desired, this.vel).limit(this.maxForce);
  }

  // 4) PURSUE — seek vers la position future de la cible (page 19-20)
  pursue(target, predictionFrames = 12) {
    const future = p5.Vector.add(target.pos, p5.Vector.mult(target.vel, predictionFrames));
    return this.seek(future);
  }

  // 5) EVADE — l'inverse de PURSUE. On inverse la vitesse désirée.
  evade(target, predictionFrames = 12) {
    const future = p5.Vector.add(target.pos, p5.Vector.mult(target.vel, predictionFrames));
    return this.flee(future);
  }

  // 6) WANDER — cercle devant le véhicule, cible qui dérive (page 26)
  wander(thetaState, distance = 80, radius = 40, jitter = 0.35) {
    thetaState.theta += random(-jitter, jitter);
    const center = p5.Vector.add(this.pos, this.vel.copy().setMag(distance));
    const target = p5.Vector.add(center,
      p5.Vector.fromAngle(this.vel.heading() + thetaState.theta, radius));
    return this.seek(target);
  }

  // 7) BOUNDARIES — confinement dans le canvas
  boundaries() {
    const d = 25;
    let dx = this.vel.x, dy = this.vel.y, out = false;
    if (this.pos.x < d) { dx = this.maxSpeed; out = true; }
    else if (this.pos.x > width - d) { dx = -this.maxSpeed; out = true; }
    if (this.pos.y < d) { dy = this.maxSpeed; out = true; }
    else if (this.pos.y > height - d) { dy = -this.maxSpeed; out = true; }
    if (!out) return createVector(0, 0);
    const desired = createVector(dx, dy).setMag(this.maxSpeed);
    return p5.Vector.sub(desired, this.vel).limit(this.maxForce);
  }

  // 8) SEPARATION — garder ses distances avec les voisins (page 39)
  separation(neighbors, desiredSep = 30) {
    let steer = createVector(0, 0), count = 0;
    for (const other of neighbors) {
      if (other === this) continue;
      const d = p5.Vector.dist(this.pos, other.pos);
      if (d > 0 && d < desiredSep) {
        const diff = p5.Vector.sub(this.pos, other.pos);
        diff.normalize().div(d);      // plus proche = plus fort
        steer.add(diff);
        count++;
      }
    }
    if (count > 0) {
      steer.div(count);
      steer.setMag(this.maxSpeed);
      steer.sub(this.vel).limit(this.maxForce);
    }
    return steer;
  }

  // 9) ALIGNMENT — aller dans la même direction que les voisins (page 37)
  alignment(neighbors, neighborDist = 60) {
    let sum = createVector(0, 0), count = 0;
    for (const other of neighbors) {
      if (other === this) continue;
      if (p5.Vector.dist(this.pos, other.pos) < neighborDist) {
        sum.add(other.vel); count++;
      }
    }
    if (count === 0) return createVector(0, 0);
    sum.div(count).setMag(this.maxSpeed);
    return p5.Vector.sub(sum, this.vel).limit(this.maxForce);
  }

  // 10) COHESION — se rapprocher du centre des voisins (page 38)
  cohesion(neighbors, neighborDist = 80) {
    let sum = createVector(0, 0), count = 0;
    for (const other of neighbors) {
      if (other === this) continue;
      if (p5.Vector.dist(this.pos, other.pos) < neighborDist) {
        sum.add(other.pos); count++;
      }
    }
    if (count === 0) return createVector(0, 0);
    return this.seek(sum.div(count));
  }

  // 11) OBSTACLE AVOIDANCE — évitement par "ahead" + "ahead2" (page 32-35)
  obstacleAvoidance(obstacles, maxSeeAhead = 80) {
    const ahead = p5.Vector.add(this.pos, this.vel.copy().setMag(maxSeeAhead));
    const ahead2 = p5.Vector.add(this.pos, this.vel.copy().setMag(maxSeeAhead * 0.5));
    let mostThreatening = null, minDist = Infinity;

    for (const o of obstacles) {
      const dAhead = p5.Vector.dist(ahead, o.pos);
      const dAhead2 = p5.Vector.dist(ahead2, o.pos);
      const dPos = p5.Vector.dist(this.pos, o.pos);
      const d = min(dAhead, dAhead2, dPos);
      if (d < o.r && d < minDist) { minDist = d; mostThreatening = o; }
    }

    if (!mostThreatening) return createVector(0, 0);

    const avoidance = p5.Vector.sub(ahead, mostThreatening.pos);
    avoidance.setMag(this.maxSpeed);
    return p5.Vector.sub(avoidance, this.vel).limit(this.maxForce);
  }

  // =====================================================================
  // MÉTHODE PRINCIPALE : délègue au BehaviorManager
  // =====================================================================
  applyBehaviors(world) {
    const force = this.behaviors.getSteeringForce(world);
    this.applyForce(force);
  }

  // =====================================================================
  // AFFICHAGE
  // =====================================================================
  display(isChampion) {
    if (this.trail.length > 1) {
      noFill();
      for (let i = 0; i < this.trail.length - 1; i++) {
        stroke(110, 240, 176, (i / this.trail.length) * 120);
        strokeWeight(1);
        line(this.trail[i].x, this.trail[i].y,
             this.trail[i + 1].x, this.trail[i + 1].y);
      }
    }
    push();
    translate(this.pos.x, this.pos.y);
    if (CFG.debug) this.drawDebug();

    if (this.shield > 0) {
      noFill(); stroke(110, 200, 255, 180); strokeWeight(2);
      circle(0, 0, 22 + 4 * sin(frameCount * 0.3));
    }

    let col = this.color ?? lerpColor(color(255, 50, 70), color(60, 255, 150),
                                     constrain(this.health, 0, 1));
    if (this.flash > 0) col = lerpColor(col, color(200, 255, 200), this.flash / 8);
    if (this.hurtFlash > 0) col = lerpColor(col, color(255, 255, 255), this.hurtFlash / 8);

    rotate(this.vel.heading() + HALF_PI);
    fill(col); stroke(col); strokeWeight(1);
    beginShape();
    vertex(0, -this.r * 2);
    vertex(-this.r, this.r * 2);
    vertex(this.r, this.r * 2);
    endShape(CLOSE);
    pop();

    if (isChampion) {
      noFill(); stroke(255, 255, 255, 200); strokeWeight(1.5);
      circle(this.pos.x, this.pos.y, 26);
    }
  }

  drawDebug() {
    noFill(); strokeWeight(1);
    stroke(60, 255, 150, 110);  circle(0, 0, this.dna[2] * 2);
    stroke(255, 60, 80, 110);   circle(0, 0, this.dna[3] * 2);
    stroke(255, 170, 40, 110);  circle(0, 0, this.dna[5] * 2);
    push(); rotate(this.vel.heading() + HALF_PI); strokeWeight(2.5);
    stroke(60, 255, 150);  line(0, 0, 0, -this.dna[0] * 20);
    stroke(255, 60, 80);   line(6, 0, 6, -this.dna[1] * 20);
    stroke(255, 170, 40);  line(-6, 0, -6, -this.dna[4] * 20);
    pop();
  }
}