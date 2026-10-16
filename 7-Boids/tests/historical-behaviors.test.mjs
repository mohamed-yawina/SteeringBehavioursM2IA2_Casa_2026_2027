import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {loadTD7} from './reference-harness.mjs';

// These tests characterize the pre-correction historical implementation.
// They do not define the final mathematical compliance contract.
const fixture = JSON.parse(readFileSync(new URL('./fixtures/historical-behaviors.json', import.meta.url), 'utf8'));
const tolerance = fixture.absoluteTolerance;
const xy = vector => [vector.x, vector.y];
const closeVector = (actual, expected) => {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < expected.length; i++) {
    assert.ok(Number.isFinite(actual[i]), `component ${i} is not finite: ${actual[i]}`);
    assert.ok(Math.abs(actual[i] - expected[i]) <= tolerance,
      `component ${i}: ${actual[i]} differs from ${expected[i]}`);
  }
};
function compareNumericTree(actual, expected, path = 'root') {
  if (typeof expected === 'number') {
    assert.ok(Number.isFinite(actual), `${path} is non-finite`);
    assert.ok(Math.abs(actual - expected) <= tolerance, `${path}: ${actual} differs from ${expected}`);
    return;
  }
  if (Array.isArray(expected)) {
    assert.equal(actual.length, expected.length, path);
    expected.forEach((value, index) => compareNumericTree(actual[index], value, `${path}[${index}]`));
    return;
  }
  if (expected && typeof expected === 'object') {
    assert.deepEqual(Object.keys(actual), Object.keys(expected), path);
    for (const key of Object.keys(expected)) compareNumericTree(actual[key], expected[key], `${path}.${key}`);
    return;
  }
  assert.equal(actual, expected, path);
}

function createBoid(env, position = [0, 0], velocity = [0, 0]) {
  const boid = new env.Boid(...position);
  boid.pos.set(...position);
  boid.vel.set(...velocity);
  boid.acc.set(0, 0);
  return boid;
}

test('historique seek et flee : les forces de référence sont reproductibles', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [0, 0], [0, 2]);
  closeVector(xy(boid.seek(new env.Vector(100, 0))), fixture.vectors.seek);
  closeVector(xy(boid.flee(new env.Vector(100, 0))), fixture.vectors.fleeAsInverseSeek);
});

test('historique Flee est l’inverse de Seek, y compris à cible confondue', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [0, 0], [1, 0]);
  closeVector(xy(boid.seek(new env.Vector(0, 0))), [-0.2, 0]);
  closeVector(xy(boid.flee(new env.Vector(0, 0))), [0.2, 0]);
  assert.ok(boid.flee(new env.Vector(0, 0)).dot(boid.vel) > 0,
    'historical inversion accelerates along the current velocity at zero target direction');
});

test('historique Wander fixe la norme de la force à maxForce et tire une variation', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [10, 20], [0, 2]);
  boid.distanceCercle = 150;
  boid.wanderRadius = 50;
  boid.wanderTheta = fixture.wander.thetaBefore;
  boid.displaceRange = 0.1;
  env.setRandomSequence([0.5]); // milieu de [-0.1, 0.1], variation nulle
  const force = boid.wander();
  closeVector(xy(force), fixture.vectors.wanderForcedMagnitude);
  assert.ok(Math.abs(force.mag() - boid.maxForce) <= tolerance);
  assert.equal(boid.wanderTheta, fixture.wander.thetaAfter);
  assert.deepEqual(env.randomEvents, fixture.wander.randomDraws);
});

test('historique Boundaries retourne le vecteur de vitesse désirée plafonné', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [10, 100], [5, 0]);
  closeVector(xy(boid.boundaries(0, 0, 1200, 800, 25)), fixture.vectors.boundariesReturnsDesired);
  const steeringForThatDesiredVelocity = new env.Vector(5, 0).sub(boid.vel);
  closeVector(xy(steeringForThatDesiredVelocity), [0, 0]);
  assert.ok(boid.boundaries(0, 0, 1200, 800, 25).mag() > steeringForThatDesiredVelocity.mag(),
    'the returned vector remains nonzero although the desired/current velocity difference is zero');
  const noCorrection = createBoid(env, [600, 400], [1, 0]);
  closeVector(xy(noCorrection.boundaries(0, 0, 1200, 800, 25)), [0, 0]);
});

test('historique Separation, Alignment et Cohesion retournent les forces nominales de référence', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [0, 0], [0, 1]);
  const neighbor = createBoid(env, [10, 0], [0, 3]);
  closeVector(xy(boid.separation([boid, neighbor])), fixture.vectors.separation);
  closeVector(xy(boid.align([boid, neighbor])), fixture.vectors.alignment);
  closeVector(xy(boid.cohesion([boid, neighbor])), fixture.vectors.cohesion);
  closeVector(xy(boid.separation([boid, createBoid(env, [100, 100])])), [0, 0]);
  closeVector(xy(boid.align([boid])), [0, 0]);
  closeVector(xy(boid.cohesion([boid])), [0, 0]);
});

test('historique Separation sur positions confondues avertit et freine sans NaN', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [0, 0], [1, 0]);
  const overlap = createBoid(env, [0, 0], [0, 1]);
  const force = boid.separation([boid, overlap]);
  closeVector(xy(force), [-0.2, 0]);
  assert.ok(env.warnings.some(message => /divide by 0/i.test(message)));
  assert.ok(Number.isFinite(force.x) && Number.isFinite(force.y));
});

test('historique Avoid repousse directement depuis le centre de l’obstacle', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [100, 100], [1, 0]);
  const obstacle = new env.Obstacle(130, 105, 10, 'green');
  closeVector(xy(boid.avoid([obstacle])), fixture.vectors.avoidDirectRepulsion);
  assert.ok(Math.abs(boid.avoid([obstacle]).mag() - boid.maxForce / 2) <= tolerance);
});

test('historique Avoid lève TypeError avec une liste vide', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env);
  assert.throws(() => boid.avoid([]), error => error.name === fixture.avoid.emptyObstacleListError);
});

test('historique Avoid détecte une coïncidence Q30/centre mais rend une force nulle', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [100, 100], [1, 0]);
  const obstacle = new env.Obstacle(130, 100, 10, 'green');
  const force = boid.avoid([obstacle]);
  closeVector(xy(force), [0, 0]);
  assert.ok(Number.isFinite(force.x) && Number.isFinite(force.y));
});

test('historique Avoid : X peut détecter un obstacle derrière; un obstacle éloigné ne l’est pas', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [100, 100], [1, 0]);
  closeVector(xy(boid.avoid([new env.Obstacle(90, 100, 10, 'green')])), [0.1, 0]);
  closeVector(xy(boid.avoid([new env.Obstacle(75, 100, 5, 'green')])), [0, 0]);
});

test('historique Avoid : égalité Q30/Q15 garde Q30 et le seuil de marge est strict', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [100, 100], [1, 0]);
  closeVector(xy(boid.avoid([new env.Obstacle(122.5, 100, 5, 'green')])), [0.1, 0]);
  closeVector(xy(boid.avoid([new env.Obstacle(130, 108, 5, 'green')])), [0, 0]);
});

test('historique Avoid choisit le centre le plus proche, même si un autre menace Q30', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [100, 100], [4, 0]);
  const nearerButSafe = new env.Obstacle(100, 140, 1, 'green');
  const fartherAndThreatening = new env.Obstacle(220, 105, 10, 'green');
  closeVector(xy(boid.avoid([nearerButSafe, fartherAndThreatening])), [0, 0]);
  closeVector(xy(boid.avoid([fartherAndThreatening])), [0, -0.1]);
  assert.throws(() => boid.avoid([null]), error => error.name === 'TypeError');
});

test('historique fleeWithTargetRadius applique la force Flee multipliée par 100', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [0, 0], [0, 1]);
  const target = {pos: new env.Vector(10, 0), r: 5};
  const applied = [];
  const applyForce = boid.applyForce.bind(boid);
  boid.applyForce = force => {
    applied.push(force.copy());
    return applyForce(force);
  };
  boid.fleeWithTargetRadius(target);
  assert.equal(applied.length, 1);
  closeVector(xy(applied[0]), fixture.vectors.fleeWithTargetRadiusApplied);
  assert.ok(Math.abs(applied[0].mag() - fixture.fleeWithTargetRadius.appliedNorm) <= tolerance);
  assert.ok(applied[0].mag() > boid.maxForce);
  assert.deepEqual(xy(boid.acc), fixture.vectors.fleeWithTargetRadiusApplied);
});

test('historique seuil de fuite strict : égalité inactive, intérieur actif', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [0, 0], [0, 1]);
  const target = {pos: new env.Vector(15, 0), r: 5}; // target.r + 10
  boid.fleeWithTargetRadius(target);
  closeVector(xy(boid.acc), [0, 0]);
  target.pos.x = 15 - 1e-6;
  boid.fleeWithTargetRadius(target);
  assert.ok(boid.acc.mag() > 0);
});

test('historique limites nulles : maxSpeed zéro ne neutralise pas Wander ni Avoid', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [100, 100], [1, 0]);
  boid.maxSpeed = 0;
  closeVector(xy(boid.seek(new env.Vector(200, 100))), [-0.2, 0]);
  closeVector(xy(boid.flee(new env.Vector(200, 100))), [0.2, 0]);
  env.setRandomSequence([0.5]);
  closeVector(xy(boid.wander()), [0.2, 0]);
  closeVector(xy(boid.avoid([new env.Obstacle(130, 105, 10, 'green')])), [0, -0.1]);
  closeVector(xy(boid.boundaries(0, 0, 1200, 800, 25)), [0, 0]);
});

test('historique maxForce zéro neutralise les forces individuelles et la fuite pondérée', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [100, 100], [1, 0]);
  boid.maxForce = 0;
  const obstacle = new env.Obstacle(130, 105, 10, 'green');
  closeVector(xy(boid.seek(new env.Vector(200, 100))), [0, 0]);
  closeVector(xy(boid.flee(new env.Vector(200, 100))), [0, 0]);
  closeVector(xy(boid.wander()), [0, 0]);
  closeVector(xy(boid.avoid([obstacle])), [0, 0]);
  closeVector(xy(boid.boundaries(0, 0, 1200, 800, 25)), [0, 0]);
  boid.fleeWithTargetRadius({pos: new env.Vector(110, 100), r: 5});
  closeVector(xy(boid.acc), [0, 0]);
});

test('historique flock applique cinq forces pondérées séparément sans plafond global', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env);
  const raw = {avoid: 0.1, align: 0.2, cohesion: 0.2, separation: 0.2, boundaries: 0.2};
  for (const [method, magnitude] of Object.entries(raw)) {
    boid[method] = () => new env.Vector(magnitude, 0);
  }
  const applied = [];
  const applyForce = boid.applyForce.bind(boid);
  boid.applyForce = force => {
    applied.push(force.copy());
    return applyForce(force);
  };
  boid.flock([], []);
  assert.equal(applied.length, fixture.flock.applicationCount);
  applied.forEach((force, index) => closeVector(xy(force), fixture.flock.weightedApplications[index]));
  closeVector(xy(boid.acc), fixture.flock.resultant);
  assert.ok(boid.acc.mag() > boid.maxForce);
});

test('historique debug : des comportements émettent du dessin pendant leur calcul', () => {
  const env = loadTD7({mode:'historical'});
  const boid = createBoid(env, [100, 100], [1, 0]);
  env.Boid.debug = true;
  boid.avoid([new env.Obstacle(130, 105, 10, 'green')]);
  assert.ok(env.graphics.some(call => call.name === 'circle'));
  assert.ok(env.graphics.some(call => call.name === 'line'));

  env.graphics.length = 0;
  env.setRandomSequence([0.5]);
  boid.wander();
  assert.ok(env.graphics.some(call => call.name === 'circle'));
  assert.ok(env.graphics.some(call => call.name === 'line'));

  env.graphics.length = 0;
  boid.boundaries(0, 0, 1200, 800, 25); // centre: debug rectangle branch
  assert.ok(env.graphics.some(call => call.name === 'rect'));

  env.graphics.length = 0;
  boid.fleeWithTargetRadius({pos: new env.Vector(105, 100), r: 10});
  assert.ok(env.graphics.some(call => call.name === 'circle'));
  env.Boid.debug = false;
});

test('sketch historique : le requin applique Wander puis Seek × 7 et intègre une fois', () => {
  const env = loadTD7({mode:'historical', includeSketch: true});
  env.scope.preload();
  env.scope.setup();
  const shark = vm.runInContext('requin', env.scope);
  vm.runInContext(`
    flock.length = 0;
    requin.pos.set(100, 100);
    requin.vel.set(0, 1);
    flock.push(new Boid(110, 100));
    flock[0].pos.set(110, 100);
    flock[0].vel.set(0, 0);
    mouseX = 1100;
    mouseY = 700;
  `, env.scope);

  const events = [];
  const applyForce = shark.applyForce.bind(shark);
  const update = shark.update.bind(shark);
  const wander = shark.wander.bind(shark);
  const seek = shark.seek.bind(shark);
  shark.applyForce = force => {
    events.push({kind: 'apply', force: xy(force)});
    return applyForce(force);
  };
  shark.update = () => {
    events.push({kind: 'update'});
    return update();
  };
  shark.wander = () => {
    const force = wander();
    events.push({kind: 'wander', force: xy(force)});
    return force;
  };
  shark.seek = target => {
    const force = seek(target);
    events.push({kind: 'seek', force: xy(force)});
    return force;
  };

  env.scope.draw();
  assert.deepEqual(events, fixture.predatorFrame.events);
  closeVector(xy(shark.pos), fixture.predatorFrame.positionAfter);
  closeVector(xy(shark.vel), fixture.predatorFrame.velocityAfter);
  closeVector(xy(shark.acc), fixture.predatorFrame.accelerationAfter);
});

test('sketch historique : trois frames de flocking sont reproductibles avec une graine fixe', () => {
  const env = loadTD7({mode:'historical', includeSketch: true, seed: 99});
  env.scope.preload();
  env.scope.setup();
  vm.runInContext(`
    flock.length = 0;
    requin.pos.set(600, 400);
    requin.vel.set(-1, 0);
    obstacleSouris.pos.set(1100, 700);
    const first = new Boid(500, 400);
    const second = new Boid(520, 405);
    first.pos.set(500, 400);
    first.vel.set(1, 0);
    second.pos.set(520, 405);
    second.vel.set(-0.5, 0.5);
    flock.push(first, second);
    mouseX = 1100;
    mouseY = 700;
  `, env.scope);

  const snapshots = [];
  for (let frame = 0; frame < fixture.threeFrameSketchRun.length; frame++) {
    env.scope.draw();
    snapshots.push(JSON.parse(vm.runInContext(`JSON.stringify({
      fish: flock.map(boid => [boid.pos.x, boid.pos.y, boid.vel.x, boid.vel.y]),
      shark: [requin.pos.x, requin.pos.y, requin.vel.x, requin.vel.y]
    })`, env.scope)));
  }
  compareNumericTree(snapshots, fixture.threeFrameSketchRun);
  assert.equal(vm.runInContext('flock.every(boid => boid.acc.mag() === 0) && requin.acc.mag() === 0', env.scope), true);
});
