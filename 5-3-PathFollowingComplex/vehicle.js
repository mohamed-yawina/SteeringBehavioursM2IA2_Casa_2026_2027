// Path Following (Complex Path)
// The Nature of Code
// The Coding Train / Daniel Shiffman
// https://youtu.be/LrnR6dc2IfM
// https://thecodingtrain.com/learning/nature-of-code/5.7-path-following.html

// Path Following: https://editor.p5js.org/codingtrain/sketches/dqM054vBV
// Complex Path: https://editor.p5js.org/codingtrain/sketches/2FFzvxwVt

// Path Following
// Vehicle class

class Vehicle {
    static debug = false;

  // Constructor initialize all values
  constructor(x, y, ms, mf) {
    this.pos = createVector(x, y);
    this.r = 12;
    this.maxSpeed = ms;
    this.maxForce = mf;
    this.acc = createVector(0, 0);
    this.vel = createVector(this.maxSpeed, 0);
    this.couleur = "black";
    this.anticipationDistance = 25;
    this.targetAdvance = 25;
    this.followDiagnostics = null;
    this.forceDiagnostics = null;
    this.wanderDiagnostics = null;

    // Poids pour les force des différents comportements
    this.wanderWeight = 0;
    this.followPathWeight = 2;
    this.separateWeight = 1.2;

     // pour comportement wander
     this.distanceCercle = 100;
     this.wanderRadius = 40;
     this.wanderTheta = PI/2;
     this.displaceRange = ms === 0 && mf === 0 ? 0 : random(-0.3, 0.3);
 
     // trainée derrière les véhicules
     this.pathMaxLength = 20;
     this.path = [];
  }

  // Implémente deux comportements : suivi de chemin complexe et séparation
  // que l'on verra plus tard
  applyBehaviors(vehicles, path) {
    const follow = this.follow(path), separation = this.separate(vehicles);
    if (this.wanderWeight === 0) this.wanderDiagnostics = null;
    const wander = this.wanderWeight === 0 ? createVector(0, 0) : this.wander();
    this.composeForces({ follow, separation, wander },
      { follow: this.followPathWeight, separation: this.separateWeight, wander: this.wanderWeight });
  }

  // Composition only: locomotion remains in applyForce/update.
  composeForces(forces, weights) {
    const weighted = {}, total = createVector(0, 0);
    for (const [name, force] of Object.entries(forces)) {
      weighted[name] = force.copy().mult(Number.isFinite(weights[name]) ? weights[name] : 0);
      total.add(weighted[name]);
    }
    const unclamped = total.copy();
    total.limit(this.maxForce);
    this.forceDiagnostics = { origin: this.pos.copy(), velocity: this.vel.copy(),
      individual: forces, weighted, unclamped, total: total.copy() };
    this.forceDiagnostics = this.copyDiagnostic(this.forceDiagnostics);
    this.applyForce(total);
  }

  copyDiagnostic(value) {
    if (value && typeof value.copy === 'function') return value.copy();
    if (Array.isArray(value)) return value.map(item => this.copyDiagnostic(item));
    if (value && typeof value === 'object') return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, this.copyDiagnostic(item)]));
    return value;
  }

  copyFollowDiagnostics() { return this.copyDiagnostic(this.followDiagnostics); }
  copyForceDiagnostics() { return this.copyDiagnostic(this.forceDiagnostics); }
  copyWanderDiagnostics() { return this.copyDiagnostic(this.wanderDiagnostics); }

  applyForce(force) {
    // On pourrait ajouter une masse au véhicule ici, rappel : 
    // somme des forces = masse * accélération, d'où accélération = somme des forces / masse
    // il suffirait de diviser la force par une masse. On a choisi de ne pas le faire ici
    // et de supposer une masse de 1. 
    // A = F / M
    this.acc.add(force);
  }

  // Main "run" function
  run() {
    this.update();
    this.render();
  }

  // This function implements Craig Reynolds' path following algorithm
  // http://www.red3d.com/cwr/steer/PathFollow.html
  follow(path) {
    const finite = p => p && Number.isFinite(p.x) && Number.isFinite(p.y);
    const zero = () => createVector(0, 0);
    const diagnostic = { status: 'invalid', origin: finite(this.pos) ? this.pos.copy() : null,
      velocity: finite(this.vel) ? this.vel.copy() : null, future: null, normal: null,
      target: null, distance: null, radius: path?.radius, active: false,
      selectedIndex: null, candidates: [], force: zero() };
    this.followDiagnostics = diagnostic;
    if (!finite(this.pos) || !finite(this.vel) || !Array.isArray(path?.points) ||
        !Array.from(path.points).every(finite) || !Number.isFinite(path.radius) || path.radius < 0 ||
        !Number.isFinite(this.anticipationDistance) || this.anticipationDistance < 0 ||
        !Number.isFinite(this.targetAdvance) || this.targetAdvance < 0 ||
        !Number.isFinite(this.maxSpeed) || this.maxSpeed < 0 ||
        !Number.isFinite(this.maxForce) || this.maxForce < 0) return zero();
    const predict = this.vel.copy();
    predict.normalize();
    predict.mult(this.anticipationDistance);
    const future = p5.Vector.add(this.pos, predict);
    if (!finite(future)) return zero();
    diagnostic.future = future.copy();
    let record = Infinity;
    for (let i = 0; i < path.points.length; i++) {
      let a = path.points[i], b = path.points[(i + 1) % path.points.length];
      let normal = findProjection(future, a, b);
      if (!normal) { diagnostic.candidates.push({ index: i, status: 'undefined', start: a.copy(), end: b.copy() }); continue; }
      const projection = normal.copy();
      let dir = p5.Vector.sub(b, a), fallback = false;
      if (normal.x < min(a.x,b.x) || normal.x > max(a.x,b.x) ||
          normal.y < min(a.y,b.y) || normal.y > max(a.y,b.y)) {
        normal = b.copy(); fallback = true;
        a = path.points[(i+1) % path.points.length]; b = path.points[(i+2) % path.points.length];
        dir = p5.Vector.sub(b,a);
      }
      const distance = p5.Vector.dist(future, normal);
      dir.normalize(); dir.mult(this.targetAdvance);
      const target = normal.copy(); target.add(dir);
      if (!Number.isFinite(distance) || !finite(target)) continue;
      diagnostic.candidates.push({index:i,status:'defined',projection,normal:normal.copy(),
        target:target.copy(),distance,fallback});
      if (distance < record) {
        record = distance; diagnostic.selectedIndex = i;
        diagnostic.normal = normal.copy(); diagnostic.target = target.copy();
      }
    }
    if (diagnostic.selectedIndex === null) { diagnostic.status = 'undefined'; return zero(); }
    diagnostic.status = 'defined'; diagnostic.distance = record;
    diagnostic.active = record > path.radius;
    const force = diagnostic.active ? this.seek(diagnostic.target) : zero();
    diagnostic.force = force.copy();
    return force;
  }

  // Comportement Separation : on garde ses distances par rapport aux voisins
  // ON ETUDIERA CE COMPORTEMENT PLUS TARD !
  separate(vehicles) {
    let desiredseparation = this.r * 2;
    let steer = createVector(0, 0, 0);
    let count = 0;
    // On examine les autres vehicles pour voir s'ils sont trop près
    for (let i = 0; i < vehicles.length; i++) {
      let other = vehicles[i];
      let d = p5.Vector.dist(this.pos, other.pos);
      // Si la distance est supérieure à 0 et inférieure à une valeur arbitraire (0 quand on est soi-même)
      if (d > 0 && d < desiredseparation) {
        // Calculate vector pointing away from neighbor
        let diff = p5.Vector.sub(this.pos, other.pos);
        diff.normalize();
        diff.div(d); // poids en fonction de la distance. Plus le voisin est proche, plus le poids est grand
        steer.add(diff);
        count++; // On compte le nombre de voisins
      }
    }
    // On moyenne le vecteur steer en fonction du nombre de voisins
    if (count > 0) {
      steer.div(count);
    }

    // si la force de répulsion est supérieure à 0
    if (steer.mag() > 0) {
      // On implemente : Steering = Desired - Velocity
      steer.normalize();
      steer.mult(this.maxSpeed);
      steer.sub(this.vel);
      steer.limit(this.maxForce);
    }
    return steer;
  }

  wander() {
    // point devant le véhicule, centre du cercle
    let wanderPoint = this.vel.copy();
    wanderPoint.setMag(this.distanceCercle);
    wanderPoint.add(this.pos);
    const center = wanderPoint.copy();
    // On va s'occuper de calculer le point vert SUR LE CERCLE
    // il fait un angle wanderTheta avec le centre du cercle
    // l'angle final par rapport à l'axe des X c'est l'angle du vaisseau
    // + cet angle
    let theta = this.wanderTheta + this.vel.heading();

    let x = this.wanderRadius * cos(theta);
    let y = this.wanderRadius * sin(theta);

    // maintenant wanderPoint c'est un point sur le cercle
    wanderPoint.add(x, y);
    const target = wanderPoint.copy();
    // Wander fournit un objectif local ; le pilotage reste un steering classique.
    const desiredVelocity = wanderPoint.copy().sub(this.pos);
    desiredVelocity.normalize();
    desiredVelocity.mult(this.maxSpeed);
    const steer = desiredVelocity.sub(this.vel);
    steer.limit(this.maxForce);
    this.wanderDiagnostics = { origin: this.pos.copy(), center, target,
      radius: this.wanderRadius, force: steer.copy() };
    

    // On déplace le point vert sur le cerlcle (en radians)
    this.wanderTheta += random(-this.displaceRange, this.displaceRange);

    return steer;
  }


  // Method to update position
  update() {
    // Update velocity
    this.vel.add(this.acc);
    // Limit speed
    this.vel.limit(this.maxSpeed);
    this.pos.add(this.vel);
    // Reset accelertion to 0 each cycle
    this.acc.mult(0);

    // on rajoute la position courante dans le tableau
    this.path.push(this.pos.copy());

    // si le tableau a plus de 50 éléments, on vire le plus ancien
    if(this.path.length > this.pathMaxLength) {
      this.path.shift();
    }
  }

  // A method that calculates and applies a steering force towards a target
  // STEER = DESIRED MINUS VELOCITY
  seek(target) {
    let desired = p5.Vector.sub(target, this.pos); // A vector pointing from the position to the target

    // Normalize desired and scale to maximum speed
    desired.normalize();
    desired.mult(this.maxSpeed);
    // Steering = Desired minus Vepositionity
    let steer = p5.Vector.sub(desired, this.vel);
    steer.limit(this.maxForce); // Limit to maximum steering force

    return steer;
  }

  render() {
      // Simple boid is just a circle
      fill(this.couleur);
      stroke(0);
      push();
      translate(this.pos.x, this.pos.y);
      ellipse(0, 0, this.r, this.r);
      pop();
  }

  edges() {
    if (this.pos.x > width + this.r) {
      this.pos.x = -this.r;
    } else if (this.pos.x < -this.r) {
      this.pos.x = width + this.r;
    }
    if (this.pos.y > height + this.r) {
      this.pos.y = -this.r;
    } else if (this.pos.y < -this.r) {
      this.pos.y = height + this.r;
    }
  }
}

// Orthogonal projection of p onto the infinite line through a and b.
// This function could be optimized to make fewer new Vector objects
function findProjection(p, a, b) {
  const finite = v => v && Number.isFinite(v.x) && Number.isFinite(v.y);
  if (![p,a,b].every(finite)) return null;
  let ap = p5.Vector.sub(p,a), ab = p5.Vector.sub(b,a);
  if (!finite(ap) || !finite(ab) || ab.mag() === 0 || !Number.isFinite(ab.mag())) return null;
  ab.normalize();
  ab.mult(ap.dot(ab));
  const normal = p5.Vector.add(a,ab);
  return finite(normal) ? normal : null;
}
