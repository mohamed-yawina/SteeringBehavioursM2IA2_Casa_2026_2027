function finitePoint(p) { return !!p && Number.isFinite(p.x) && Number.isFinite(p.y); }
function validObstacle(o) { return finitePoint(o?.pos) && Number.isFinite(o.r) && o.r>=0; }

/*
  Calcule la projection orthogonale du point a sur le vecteur b
  a et b sont des vecteurs calculés comme ceci :
  let v1 = p5.Vector.sub(a, pos); soit v1 = pos -> a
  let v2 = p5.Vector.sub(b, pos); soit v2 = pos -> b
  */
function findProjection(pos, a, b) {
  let v1 = p5.Vector.sub(a, pos);
  let v2 = p5.Vector.sub(b, pos);
  v2.normalize();
  let sp = v1.dot(v2);
  v2.mult(sp);
  v2.add(pos);
  return v2;
}

class Vehicle {
  static debug = false;

  constructor(x, y) {
    // position du véhicule
    this.pos = createVector(x, y);
    // vitesse du véhicule
    this.vel = createVector(0, 0);
    // accélération du véhicule
    this.acc = createVector(0, 0);
    // vitesse maximale du véhicule
    this.maxSpeed = 4;
    // force maximale appliquée au véhicule
    this.maxForce = 0.2;
    this.color = "white";
    // à peu près en secondes
    this.dureeDeVie = 5;

    this.r_pourDessin = 16;
    // rayon du véhicule pour l'évitement
    this.r = this.r_pourDessin * 3;

    // Pour évitement d'obstacle
    this.largeurZoneEvitementDevantVaisseau = this.r / 2;

    // chemin derrière vaisseaux
    this.path = [];
    this.pathMaxLength = 30;
    this.shortHorizon = 15;
    this.longHorizon = 30;
    this.behaviorWeights = {arrive:0.2, avoid:3, separate:0.2, boundaries:3};
    this.avoidEnabled = true;

   
  }

  // on fait une méthode applyBehaviors qui applique les comportements
  // seek et avoid
  applyBehaviors(target, obstacles) {
    if (!this.validPhysics()) {
      this.forceDiagnostics = {status:'invalid', total:createVector(0,0)};
      this.avoidDiagnostics = null;
      this.boundaryDiagnostics = null;
      return false; // The caller must not integrate an invalid state.
    }
    const raw = {
      arrive: finitePoint(target) ? this.arrive(target) : createVector(0,0),
      avoid: this.avoid(obstacles),
      separate: this.separate(vehicules),
      boundaries: this.boundaries(0,0,width,height,25)
    };
    const defaults = {arrive:0.2, avoid:3, separate:0.2, boundaries:3};
    const configured = {};
    for (const name of Object.keys(defaults)) {
      const value = this.behaviorWeights?.[name];
      configured[name] = Number.isFinite(value) && value >= 0 ? value : defaults[name];
    }
    const weights = {...configured, avoid:this.avoidEnabled === false ? 0 : configured.avoid};
    const weighted = {}, total = createVector(0,0);
    for (const name of Object.keys(raw)) {
      weighted[name] = raw[name].copy().mult(weights[name]);
      total.add(weighted[name]);
    }
    const unclamped = total.copy();
    if (!finitePoint(total) || !Number.isFinite(total.mag())) total.set(0,0);
    total.limit(this.maxForce);
    this.forceDiagnostics = this.copyDiagnostic({status:'defined',
      origin:this.pos.copy(), velocity:this.vel.copy(), raw, weighted,
      weights:{...weights},configuredWeights:{...configured},avoidEnabled:this.avoidEnabled !== false,
      maxForce:this.maxForce,maxSpeed:this.maxSpeed,
      step:this.diagnosticStep??null,stage:'pre-integration',
      unclamped, total:total.copy()});
    this.applyForce(total);
    return true;
  }

  validPhysics() {
    return finitePoint(this.pos) && finitePoint(this.vel) && finitePoint(this.acc) &&
      Number.isFinite(this.maxSpeed) && this.maxSpeed >= 0 &&
      Number.isFinite(this.maxForce) && this.maxForce >= 0;
  }

  copyDiagnostic(value) {
    if (value && typeof value.copy === 'function') return value.copy();
    if (Array.isArray(value)) return value.map(item=>this.copyDiagnostic(item));
    if (value && typeof value === 'object') return Object.fromEntries(
      Object.entries(value).map(([key,item])=>[key,this.copyDiagnostic(item)]));
    return value;
  }
  setAnticipation(short,long) {
    if(!Number.isFinite(short)||!Number.isFinite(long)||short<0||long<short)return false;
    this.shortHorizon=short;this.longHorizon=long;return true;
  }

  copyAvoidDiagnostics() { return this.copyDiagnostic(this.avoidDiagnostics ?? null); }
  copyForceDiagnostics() { return this.copyDiagnostic(this.forceDiagnostics ?? null); }

  avoid(obstacles) {
    const zero = () => createVector(0,0);
    const d = {status:'invalid',reason:'invalid-input',stage:'pre-integration',step:this.diagnosticStep??null,
      velocity:finitePoint(this.vel)?this.vel.copy():null,shortHorizon:this.shortHorizon,longHorizon:this.longHorizon,
      margin:this.largeurZoneEvitementDevantVaisseau,minDistance:null,origin:finitePoint(this.pos)?this.pos.copy():null,
      q15:null,q30:null,selectedIndex:null,center:null,radius:null,
      sample:null,sampleName:null,distances:null,threshold:null,
      detected:false,force:zero(),rejected:[]};
    this.avoidDiagnostics = d;
    if (!this.validPhysics() || !Number.isFinite(this.largeurZoneEvitementDevantVaisseau) ||
        this.largeurZoneEvitementDevantVaisseau < 0 || !Array.isArray(obstacles) ||
        !Number.isFinite(this.shortHorizon)||!Number.isFinite(this.longHorizon)||
        this.shortHorizon<0||this.longHorizon<this.shortHorizon) return zero();
    const ahead=this.vel.copy(); ahead.mult(this.longHorizon);
    const ahead2=this.vel.copy(); ahead2.mult(this.shortHorizon);
    const q30=p5.Vector.add(this.pos,ahead),q15=p5.Vector.add(this.pos,ahead2);
    if (!finitePoint(q30)||!finitePoint(q15)) return zero();
    d.q30=q30.copy();d.q15=q15.copy();
    d.rejected=Array.from(obstacles,(o,i)=>validObstacle(o)?null:i).filter(i=>i!==null);
    const obstacle=this.getObstacleLePlusProche(obstacles);
    if (!obstacle) {d.status='no-obstacle';d.reason=obstacles.length?'no-valid-obstacle':'empty-list';return zero();}
    d.selectedIndex=obstacles.indexOf(obstacle);d.center=createVector(obstacle.pos.x,obstacle.pos.y);
    d.radius=obstacle.r;
    let distance=p5.Vector.dist(obstacle.pos,q30);
    const distance2=p5.Vector.dist(obstacle.pos,q15),distance3=p5.Vector.dist(obstacle.pos,this.pos);
    d.distances={q30:distance,q15:distance2,x:distance3};
    let point=q30,name='Q30';
    if(distance2<distance){distance=distance2;point=q15;name='Q15';}
    if(distance3<distance){distance=distance3;point=this.pos;name='X';}
    const threshold=obstacle.r+this.largeurZoneEvitementDevantVaisseau;
    if(!Number.isFinite(distance)||!Number.isFinite(threshold))return zero();
    d.status='defined';d.sample=point.copy();d.sampleName=name;d.threshold=threshold;
    d.minDistance=distance;d.detected=distance<threshold;
    d.reason=d.detected?'detected':'outside-threshold';
    if (!d.detected) return zero();
    const direction=p5.Vector.sub(point,obstacle.pos);
    const coincident=direction.mag()===0;
    const desiredVelocity=direction.copy();
    desiredVelocity.normalize();
    desiredVelocity.mult(this.maxSpeed);
    const force=p5.Vector.sub(desiredVelocity,this.vel);
    force.limit(this.maxForce/2);
    if(!finitePoint(force)) {d.status='invalid';d.detected=false;return zero();}
    d.force=force.copy();
    if(coincident)d.reason='coincident-sample';
    else if(force.mag()===0&&this.maxForce===0)d.reason='zero-force-budget';
    return force;
  }

  // Rendering only: consumes the last physical calculation, never calls avoid().
  drawAvoidDiagnostics() {
    if(!Vehicle.debug)return;
    const d=this.copyAvoidDiagnostics();
    if(!d?.q30)return;
    const origin=d.origin;
    this.drawVector(origin,p5.Vector.sub(d.q30,origin),'yellow');
    this.drawVector(origin,p5.Vector.sub(d.q15,origin),'purple');
    push();
    fill('red');circle(d.q30.x,d.q30.y,10);
    fill('lightblue');circle(d.q15.x,d.q15.y,10);
    stroke(255,50);strokeWeight(this.largeurZoneEvitementDevantVaisseau*2);
    line(origin.x,origin.y,d.q30.x,d.q30.y);
    pop();
    if(d.detected)this.drawVector(origin,d.force.copy().mult(100),'yellow');
  }

  avoidCorrige(obstacles) {
    // calcul d'un vecteur ahead devant le véhicule
    // il regarde par exemple 50 frames devant lui
    let ahead = this.vel.copy();
    ahead.mult(30);
    //on calcue ahead2 deux fois plus petit
    let ahead2 = ahead.copy();
    ahead2.mult(0.5);

    // on le dessine avec ma méthode this.drawVector(pos vecteur, color)
    this.drawVector(this.pos, ahead, "yellow");

    // Calcul des coordonnées du point au bout de ahead
    let pointAuBoutDeAhead = this.pos.copy().add(ahead);
    let pointAuBoutDeAhead2 = this.pos.copy().add(ahead2);

    // Detection de l'obstacle le plus proche
    let obstacleLePlusProche = this.getObstacleLePlusProche(obstacles);

    // Si pas d'obstacle, on renvoie un vecteur nul
    if (obstacleLePlusProche == undefined) {
      return createVector(0, 0);
    }

    // On calcule la distance entre le cercle et le bout du vecteur ahead
    let distance1 = pointAuBoutDeAhead.dist(obstacleLePlusProche.pos);
    let distance2 = pointAuBoutDeAhead2.dist(obstacleLePlusProche.pos);
    let distance = min(distance1, distance2);


    // On dessine le point au bout du vecteur ahead pour debugger
    fill("red");
    circle(pointAuBoutDeAhead.x, pointAuBoutDeAhead.y, 10);
    fill("blue");
    circle(pointAuBoutDeAhead2.x, pointAuBoutDeAhead2.y, 10);

    // On dessine la zone d'évitement
    // Pour cela on trace une ligne large qui va de la position du vaisseau
    // jusqu'au point au bout de ahead
    stroke(100, 100);
    strokeWeight(this.largeurZoneEvitementDevantVaisseau);
    line(this.pos.x, this.pos.y, pointAuBoutDeAhead.x, pointAuBoutDeAhead.y);

    // si la distance est < rayon de l'obstacle
    // il y a collision possible et on dessine l'obstacle en rouge

    if (distance < obstacleLePlusProche.r + this.largeurZoneEvitementDevantVaisseau + this.r) {
      // collision possible 

      // calcul de la force d'évitement. C'est un vecteur qui va
      // du centre de l'obstacle vers le point au bout du vecteur ahead
      let force;
      if (distance1 < distance2) {
        force = p5.Vector.sub(pointAuBoutDeAhead, obstacleLePlusProche.pos);
      }
      else {
        force = p5.Vector.sub(pointAuBoutDeAhead2, obstacleLePlusProche.pos);
      }
      // on le dessine en jaune pour vérifier qu'il est ok (dans le bon sens etc)
      this.drawVector(obstacleLePlusProche.pos, force, "yellow");

      // Dessous c'est l'ETAPE 2 : le pilotage (comment on se dirige vers la cible)
      // on limite ce vecteur à la longueur maxSpeed
      // force est la vitesse désirée
      force.setMag(this.maxSpeed);
      // on calcule la force à appliquer pour atteindre la cible avec la formule
      // que vous commencez à connaitre : force = vitesse désirée - vitesse courante
      force.sub(this.vel);
      // on limite cette force à la longueur maxForce
      force.limit(this.maxForce);
      return force;
    } else {
      // pas de collision possible
      return createVector(0, 0);
    }
  }

  // Exerce une force renvoyant vers le centre du canvas si le véhicule s'approche
  // des bords du canvas
  boundariesOld() {
    const d = 25;

    let desired = null;

    // si le véhicule est trop à gauche ou trop à droite
    if (this.pos.x < d) {
      desired = createVector(this.maxSpeed, this.vel.y);
    } else if (this.pos.x > width - d) {
      desired = createVector(-this.maxSpeed, this.vel.y);
    }

    if (this.pos.y < d) {
      desired = createVector(this.vel.x, this.maxSpeed);
    } else if (this.pos.y > height - d) {
      desired = createVector(this.vel.x, -this.maxSpeed);
    }

    if (desired !== null) {
      desired.normalize();
      desired.mult(this.maxSpeed);
      const steer = p5.Vector.sub(desired, this.vel);
      steer.limit(this.maxForce);
      return steer;
    }
    return createVector(0, 0);
  }

  // Permet de rester dans les limites d'une zone rectangulaire.
  // Lorsque le véhicule s'approche d'un bord vertical ou horizontal
  // on calcule la vitesse désirée dans la direction "réfléchie" par
  // rapport au bord (comme au billard).
  // Par exemple, si le véhicule s'approche du bord gauche à moins de 
  // 25 pixels (valeur par défaut de la variable d),
  // on calcule la vitesse désirée en gardant le x du vecteur vitesse
  // et en mettant son y positif. x vaut maxSpeed et y vaut avant une valeur
  // négative (puisque le véhicule va vers la gauche), on lui donne un y positif
  // ça c'est pour la direction à prendre (vitesse désirée). Une fois la direction
  // calculée on lui donne une norme égale à maxSpeed, puis on calcule la force
  // normalement : force = vitesseDesiree - vitesseActuelle
  // paramètres = un rectangle (bx, by, bw, bh) et une distance d
  boundaries(bx, by, bw, bh, d) {
    if (!this.validPhysics() || ![bx,by,bw,bh,d].every(Number.isFinite) || bw<0 || bh<0 || d<0) return createVector(0,0);
    this.boundaryDiagnostics = {rectangle:[bx,by,bw,bh], margin:d, active:false};
    let vitesseDesiree = null;

    const xBordGauche = bx + d;
    const xBordDroite = bx + bw - d;
    const yBordHaut = by + d;
    const yBordBas = by + bh - d;

    // si le véhicule est trop à gauche ou trop à droite
    if (this.pos.x < xBordGauche) {
      // 
      vitesseDesiree = createVector(this.maxSpeed, this.vel.y);
    } else if (this.pos.x > xBordDroite) {
      vitesseDesiree = createVector(-this.maxSpeed, this.vel.y);
    }

    if (this.pos.y < yBordHaut) {
      vitesseDesiree = createVector(this.vel.x, this.maxSpeed);
    } else if (this.pos.y > yBordBas) {
      vitesseDesiree = createVector(this.vel.x, -this.maxSpeed);
    }

    if (vitesseDesiree !== null) {
      vitesseDesiree.setMag(this.maxSpeed);
      this.boundaryDiagnostics.active=true;
      const force = p5.Vector.sub(vitesseDesiree, this.vel);
      if(!finitePoint(force)||!Number.isFinite(force.mag()))return createVector(0,0);
      force.limit(this.maxForce);
      return finitePoint(force) ? force : createVector(0,0);
    }

    // si on est pas près du bord (vitesse désirée nulle), on renvoie un vecteur nul
    return createVector(0, 0);
  }


  getObstacleLePlusProche(obstacles) {
    if(!finitePoint(this.pos)||!Array.isArray(obstacles))return undefined;
    let closest,record=Infinity;
    for(const obstacle of obstacles) {
      if(!validObstacle(obstacle))continue;
      const distance=p5.Vector.dist(this.pos,obstacle.pos);
      if(Number.isFinite(distance)&&distance<record){record=distance;closest=obstacle;}
    }
    return closest;
  }

  getVehiculeLePlusProche(vehicules) {
    let plusPetiteDistance = Infinity;
    let vehiculeLePlusProche = undefined;

    vehicules.forEach(v => {
      if (v != this) {
        // Je calcule la distance entre le vaisseau et le vehicule
        const distance = this.pos.dist(v.pos);
        if (distance < plusPetiteDistance) {
          plusPetiteDistance = distance;
          vehiculeLePlusProche = v;
        }
      }
    });

    return vehiculeLePlusProche;
  }


  getClosestObstacle(pos, obstacles) {
    // on parcourt les obstacles et on renvoie celui qui est le plus près du véhicule
    let closestObstacle = null;
    let closestDistance = 1000000000;
    for (let obstacle of obstacles) {
      let distance = pos.dist(obstacle.pos);
      if (closestObstacle == null || distance < closestDistance) {
        closestObstacle = obstacle;
        closestDistance = distance;
      }
    }
    return closestObstacle;
  }

  arrive(target) {
    // 2nd argument true enables the arrival behavior
    return this.seek(target, true);
  }

  seek(target, arrival = false) {
    let force = p5.Vector.sub(target, this.pos);
    let desiredSpeed = this.maxSpeed;
    if (arrival) {
      let slowRadius = 100;
      let distance = force.mag();
      if (distance < slowRadius) {
        desiredSpeed = map(distance, 0, slowRadius, 0, this.maxSpeed);
      }
    }
    force.setMag(desiredSpeed);
    force.sub(this.vel);
    force.limit(this.maxForce);
    return force;
  }

  // Fuite directionnelle : viser l'opposé de la cible, puis compenser la vitesse.
  flee(target) {
    if (!this.validPhysics() || !finitePoint(target)) return createVector(0,0);
    const desired = p5.Vector.sub(this.pos, target);
    if (!finitePoint(desired) || !Number.isFinite(desired.mag())) return createVector(0,0);
    desired.setMag(this.maxSpeed);
    const steering = desired.sub(this.vel);
    if (!finitePoint(steering) || !Number.isFinite(steering.mag())) return createVector(0,0);
    return steering.limit(this.maxForce);
  }

  /* Poursuite d'un point devant la target !
     cette methode renvoie la force à appliquer au véhicule
  */
  pursue(vehicle) {
    if (!this.validPhysics() || !finitePoint(vehicle?.pos) || !finitePoint(vehicle?.vel)) return createVector(0,0);
    let target = vehicle.pos.copy();
    let prediction = vehicle.vel.copy();
    prediction.mult(10);
    target.add(prediction);
    if (!finitePoint(target)) return createVector(0,0);
    return this.seek(target);
  }

  evade(vehicle) {
    if (!this.validPhysics() || !finitePoint(vehicle?.pos) || !finitePoint(vehicle?.vel)) return createVector(0,0);
    const predicted = vehicle.pos.copy().add(vehicle.vel.copy().mult(10));
    if (!finitePoint(predicted)) return createVector(0,0);
    return this.flee(predicted);
  }

  // Comportement Separation : on garde ses distances par rapport aux voisins
  // ON ETUDIERA CE COMPORTEMENT PLUS TARD !
  separate(boids) {
    if (!this.validPhysics() || !Number.isFinite(this.r) || this.r<0 || !Array.isArray(boids)) return createVector(0,0);
    let desiredseparation = this.r;
    let steer = createVector(0, 0, 0);
    let count = 0;
    // On examine les autres boids pour voir s'ils sont trop près
    for (let i = 0; i < boids.length; i++) {
      let other = boids[i];
      if (!finitePoint(other?.pos)) continue;
      let d = p5.Vector.dist(this.pos, other.pos);
      // Si la distance est supérieure à 0 et inférieure à une valeur arbitraire (0 quand on est soi-même)
      if (Number.isFinite(d) && d > 0 && d < desiredseparation) {
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
      if(!finitePoint(steer)||!Number.isFinite(steer.mag()))return createVector(0,0);
      steer.limit(this.maxForce);
    }
    return finitePoint(steer) ? steer : createVector(0,0);
  }

  // applyForce est une méthode qui permet d'appliquer une force au véhicule
  // en fait on additionne le vecteurr force au vecteur accélération
  applyForce(force) {
    this.acc.add(force);
  }

  update() {
    // on ajoute l'accélération à la vitesse. L'accélération est un incrément de vitesse
    // (accélératiion = dérivée de la vitesse)
    this.vel.add(this.acc);
    // on contraint la vitesse à la valeur maxSpeed
    this.vel.limit(this.maxSpeed);
    // on ajoute la vitesse à la position. La vitesse est un incrément de position, 
    // (la vitesse est la dérivée de la position)
    this.pos.add(this.vel);

    // on remet l'accélération à zéro
    this.acc.set(0, 0);

    // mise à jour du path (la trainée derrière)
    this.ajoutePosAuPath();

    // durée de vie
    this.dureeDeVie -= 0.01;
  }

  ajoutePosAuPath() {
    // on rajoute la position courante dans le tableau
    this.path.push(this.pos.copy());

    // si le tableau a plus de 50 éléments, on vire le plus ancien
    if (this.path.length > this.pathMaxLength) {
      this.path.shift();
    }
  }

  // On dessine le véhicule, le chemin etc.
  show() {
    this.drawAvoidDiagnostics();
    const frame=this.boundaryDiagnostics;
    if(Vehicle.debug && frame && !frame.active){
      const [bx,by,bw,bh]=frame.rectangle,d=frame.margin;
      push();noFill();stroke("white");rect(bx,by,bw,bh);
      stroke("red");rect(bx+d,by+d,bw-2*d,bh-2*d);pop();
    }
    // dessin du chemin
    this.drawPath();
    // dessin du vehicule
    this.drawVehicle();
  }

  drawVehicle() {
    // formes fil de fer en blanc
    stroke(255);
    // épaisseur du trait = 2
    strokeWeight(2);

    // formes pleines
    fill(this.color);

    // sauvegarde du contexte graphique (couleur pleine, fil de fer, épaisseur du trait, 
    // position et rotation du repère de référence)
    push();
    // on déplace le repère de référence.
    translate(this.pos.x, this.pos.y);
    // et on le tourne. heading() renvoie l'angle du vecteur vitesse (c'est l'angle du véhicule)
    rotate(this.vel.heading());

    // Dessin d'un véhicule sous la forme d'un triangle. Comme s'il était droit, avec le 0, 0 en haut à gauche
    triangle(-this.r_pourDessin, -this.r_pourDessin / 2, -this.r_pourDessin, this.r_pourDessin / 2, this.r_pourDessin, 0);
    // Que fait cette ligne ?
    //this.edges();

    // cercle pour le debug
    if (Vehicle.debug) {
      stroke(255);
      noFill();
      circle(0, 0, this.r);
    }

    // draw velocity vector
    pop();
    //this.drawVector(this.pos, p5.Vector.mult(this.vel, 10), color(255, 0, 0));

    // Cercle pour évitement entre vehicules et obstacles
    if (Vehicle.debug) {
      stroke(255);
      noFill();
      circle(this.pos.x, this.pos.y, this.r);
    }
  }

  drawPath() {
    push();
    stroke(255);
    noFill();
    strokeWeight(1);

    fill(this.color);
    // dessin du chemin
    this.path.forEach((p, index) => {
      if (!(index % 5)) {

        circle(p.x, p.y, 1);
      }
    });
    pop();
  }
  drawVector(pos, v, color) {
    push();
    // Dessin du vecteur vitesse
    // Il part du centre du véhicule et va dans la direction du vecteur vitesse
    strokeWeight(3);
    stroke(color);
    line(pos.x, pos.y, pos.x + v.x, pos.y + v.y);
    // dessine une petite fleche au bout du vecteur vitesse
    let arrowSize = 5;
    translate(pos.x + v.x, pos.y + v.y);
    rotate(v.heading());
    translate(-arrowSize / 2, 0);
    triangle(0, arrowSize / 2, 0, -arrowSize / 2, arrowSize, 0);
    pop();
  }

  // que fait cette méthode ?
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
