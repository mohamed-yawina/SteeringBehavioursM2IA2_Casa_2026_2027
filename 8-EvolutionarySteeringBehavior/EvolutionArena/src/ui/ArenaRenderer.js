import { DEFAULT_DISPLAY_SETTINGS } from './DisplaySettings.js';
const GENERATION_COLORS = Object.freeze(['#8ddaff', '#80ecab', '#eec684', '#cfabff']);

export class ArenaRenderer {
  constructor(simulation, sketch, settings = null) {
    this.simulation = simulation;
    this.p = sketch;
    this.settings = settings;
    this.view = settings?.values ?? DEFAULT_DISPLAY_SETTINGS;
  }

  draw(showPerception, predatorDebug = false) {
    const p = this.p;
    const world = this.simulation;
    this.view = this.settings?.values ?? DEFAULT_DISPLAY_SETTINGS;
    p.background('#07101e');
    p.push();
    p.scale(p.width / world.width, p.height / world.height);
    p.noStroke();
    // Six bandes seulement : profondeur sans texture, shader ni flou par agent.
    if (this.view.quality !== 'economy') for (let band = 0; band < 6; band++) {
      p.fill(10 + band, 19 + band, 35 + band * 2);
      p.rect(0, world.height * band / 6, world.width, world.height / 6 + 1);
    }
    p.stroke(this.view.highContrast ? '#334b6c' : '#192d46');
    p.strokeWeight(1);
    for (let x = 0; x <= world.width; x += 50) p.line(x, 0, x, world.height);
    for (let y = 0; y <= world.height; y += 50) p.line(0, y, world.width, y);
    p.noFill(); p.stroke(this.view.highContrast ? '#85a6cb' : '#3b5474');
    p.rect(24, 24, world.width - 48, world.height - 48, 12);
    p.stroke('#7397bd');
    p.line(24, 48, 24, 24); p.line(24, 24, 48, 24);
    p.line(world.width - 48, world.height - 24, world.width - 24, world.height - 24);
    p.line(world.width - 24, world.height - 24, world.width - 24, world.height - 48);

    for (const resource of world.food) {
      p.noStroke(); p.fill('#80ecab');
      p.circle(resource.pos.x, resource.pos.y, 7);
      if (this.view.quality !== 'economy') {
        p.fill('#e3ffe9'); p.circle(resource.pos.x - 1, resource.pos.y - 1, 2);
      }
    }
    for (const resource of world.poison) {
      p.noFill(); p.stroke('#fb8290'); p.strokeWeight(1.6);
      const { x, y } = resource.pos;
      p.line(x - 3, y - 3, x + 3, y + 3);
      p.line(x - 3, y + 3, x + 3, y - 3);
      if (this.view.quality !== 'economy') {
        p.stroke(251, 130, 144, 100);
        p.line(x, y - 6, x + 6, y); p.line(x + 6, y, x, y + 6);
        p.line(x, y + 6, x - 6, y); p.line(x - 6, y, x, y - 6);
      }
    }
    if (world.predation.enabled) {
      for (const predator of world.predators) this.drawPredator(predator, showPerception, predatorDebug);
    }
    for (const creature of world.creatures) this.drawCreature(creature, showPerception, predatorDebug);
    p.pop();
  }

  drawCreature(creature, showPerception, predatorDebug = false) {
    const p = this.p;
    p.push(); p.translate(creature.pos.x, creature.pos.y);
    if (predatorDebug && this.simulation.predation.enabled && creature.threatId) {
      p.noFill(); p.stroke('#f3d485'); p.strokeWeight(1);
      p.circle(0, 0, this.simulation.predation.preyPerception * 2);
      p.line(0, 0, creature.evadeForce.x * 240, creature.evadeForce.y * 240);
      if (creature.evadePrediction) {
        const predicted = creature.evadePrediction.position;
        p.line(0, 0, predicted.x - creature.pos.x, predicted.y - creature.pos.y);
      }
    }
    if (showPerception) {
      p.noFill(); p.strokeWeight(1);
      p.stroke(128, 236, 171, 40); p.circle(0, 0, creature.dna.foodPerception * 2);
      p.stroke(251, 130, 144, 40); p.circle(0, 0, creature.dna.poisonPerception * 2);
    }
    // La petite barre exprime l'énergie ; l'orientation suit la vitesse réelle.
    p.noStroke(); p.fill('#233844'); p.rect(-7, 10, 14, 2, 1);
    p.fill(creature.energy < 0.35 ? '#fb8290' : '#80ecab');
    p.rect(-7, 10, 14 * creature.energy / creature.maxEnergy, 2, 1);
    p.rotate(creature.vel.heading() + p.HALF_PI);
    p.fill(GENERATION_COLORS[(creature.generation - 1) % GENERATION_COLORS.length]); p.stroke('#d8f3ff'); p.strokeWeight(0.7);
    p.triangle(0, -8, -4.5, 5, 4.5, 5);
    // Les encoches rendent le cycle des générations lisible sans la couleur.
    p.stroke('#e6f3ff'); p.strokeWeight(0.8);
    const marks = (creature.generation - 1) % 4 + 1;
    for (let mark = 0; mark < marks; mark++) p.line(-2, 3 + mark * 2, 2, 3 + mark * 2);
    if (creature.energy < 0.35) { p.stroke('#ffd5db'); p.line(-7, -7, -7, -3); p.line(-7, -1, -7, 0); }
    if (this.view.effects && creature.birthFlash > 0) {
      p.noFill(); p.stroke(128, 236, 171, 180 * creature.birthFlash / 0.8);
      p.circle(0, 0, this.view.reducedMotion ? 20 : 12 + (0.8 - creature.birthFlash) * 30);
    }
    if (creature.id === this.simulation.selectedId) {
      p.noFill(); p.stroke('#ffffff'); p.circle(0, 0, 24);
      p.line(-15, -5, -15, 5); p.line(15, -5, 15, 5);
    }
    p.pop();
  }

  drawPredator(predator, showPerception, debug) {
    const p = this.p;
    if (this.view.effects && predator.captureFlash > 0 && predator.capturePosition) {
      p.noFill(); p.stroke(255, 118, 94, predator.captureFlash / 0.6 * 180); p.strokeWeight(2);
      p.circle(predator.capturePosition.x, predator.capturePosition.y, this.view.reducedMotion ? 22 : 12 + (0.6 - predator.captureFlash) * 55);
    }
    const target = predator.targetId ? this.simulation.creatures.find(creature => creature.id === predator.targetId) : null;
    if (target) {
      const x = target.pos.x, y = target.pos.y;
      p.stroke('#ffb098'); p.strokeWeight(1);
      p.line(x - 10, y - 5, x - 10, y - 10); p.line(x - 10, y - 10, x - 5, y - 10);
      p.line(x + 10, y + 5, x + 10, y + 10); p.line(x + 10, y + 10, x + 5, y + 10);
    }
    p.push(); p.translate(predator.pos.x, predator.pos.y);
    if (showPerception || debug) {
      p.noFill(); p.stroke(255, 118, 94, 45); p.strokeWeight(1);
      p.circle(0, 0, predator.perceptionRadius * 2);
      p.stroke(255, 118, 94, 150); p.circle(0, 0, predator.captureRadius * 2);
    }
    if (debug && predator.prediction) {
      const future = predator.prediction.position;
      p.stroke('#ffb098'); p.line(0, 0, future.x - predator.pos.x, future.y - predator.pos.y);
      p.circle(future.x - predator.pos.x, future.y - predator.pos.y, 7);
      if (target) {
        p.stroke('#938bba'); p.line(0, 0, target.pos.x - predator.pos.x, target.pos.y - predator.pos.y);
        p.line(target.pos.x - predator.pos.x, target.pos.y - predator.pos.y, future.x - predator.pos.x, future.y - predator.pos.y);
      }
      p.stroke('#ff765e'); p.line(0, 0, predator.pursueForce.x * 240, predator.pursueForce.y * 240);
    }
    p.noStroke(); p.fill('#233844'); p.rect(-10, 15, 20, 3, 1);
    p.fill('#ff765e'); p.rect(-10, 15, 20 * predator.energy / predator.maxEnergy, 3, 1);
    p.rotate(predator.vel.heading() + p.HALF_PI);
    p.fill(predator.state === 'rest' ? '#c18773' : '#ff765e'); p.stroke('#ffd5b8'); p.strokeWeight(1);
    p.triangle(0, -12, -8, 8, 8, 8);
    p.triangle(0, 7, -10, -3, 10, -3);
    if (predator.state === 'pursue' && this.view.effects && !this.view.reducedMotion && this.view.quality !== 'economy') {
      const pulse = Math.sin(this.simulation.time * 7) * 2;
      p.noStroke(); p.fill('#ffbf80'); p.triangle(0, 12, -3, 17 + pulse, 3, 17 + pulse);
    }
    p.pop();
  }
}
