import test from 'node:test';
import assert from 'node:assert/strict';
import {loadTD7} from './reference-harness.mjs';

const close = (actual, expected, tolerance = 1e-12) => {
  assert.ok(Number.isFinite(actual.x) && Number.isFinite(actual.y),
    `expected finite vector, got (${actual.x}, ${actual.y})`);
  assert.ok(Math.abs(actual.x - expected[0]) <= tolerance,
    `x: ${actual.x} differs from ${expected[0]}`);
  assert.ok(Math.abs(actual.y - expected[1]) <= tolerance,
    `y: ${actual.y} differs from ${expected[1]}`);
};

function expectedSteering(direction, velocity, maxSpeed, maxForce) {
  const magnitude = Math.hypot(direction[0], direction[1]);
  const desired = magnitude === 0
    ? [0, 0]
    : [direction[0] / magnitude * maxSpeed, direction[1] / magnitude * maxSpeed];
  let steering = [desired[0] - velocity[0], desired[1] - velocity[1]];
  const steeringMagnitude = Math.hypot(...steering);
  if (steeringMagnitude > maxForce && steeringMagnitude > 0) {
    steering = steering.map(component => component * maxForce / steeringMagnitude);
  }
  return steering;
}

function makeBoid(env, position = [0, 0], velocity = [0, 0]) {
  const boid = new env.Boid(...position);
  boid.pos.set(...position);
  boid.vel.set(...velocity);
  boid.acc.set(0, 0);
  return boid;
}

test('Seek, Alignment et Cohesion conservent leurs formules directionnelles conformes', () => {
  const env = loadTD7({mode: 'current'});
  const seeker = makeBoid(env, [0, 0], [1, 2]);
  close(seeker.seek(new env.Vector(10, 0)), expectedSteering([10, 0], [1, 2], 5, 0.2));

  const aligned = makeBoid(env, [0, 0], [0, 1]);
  const neighbor = makeBoid(env, [10, 0], [0, 3]);
  close(aligned.align([aligned, neighbor]), [0, 0.2]);
  close(aligned.cohesion([aligned, neighbor]), [0.19611613513818404, -0.03922322702763681]);
});

test('Flee construit la vitesse opposée puis soustrait la vitesse latérale courante', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [10, 20], [1, 2]);
  const target = new env.Vector(20, 20);
  const targetBefore = target.copy();
  const expected = expectedSteering([-10, 0], [1, 2], boid.maxSpeed, boid.maxForce);
  close(boid.flee(target), expected);
  close(target, [targetBefore.x, targetBefore.y]);
  assert.ok(Math.hypot(boid.flee(target).x, boid.flee(target).y) <= boid.maxForce + 1e-12);
});

test('Flee à distance nulle demande une vitesse nulle et freine sans dépasser maxForce', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [4, 8], [0.12, 0.05]);
  close(boid.flee(new env.Vector(4, 8)), expectedSteering([0, 0], [0.12, 0.05], 5, 0.2));
  close(boid.flee(new env.Vector(4, 8)), [-0.12, -0.05]);
});

test('Flee respecte maxSpeed nul, maxForce nul et rejette les cibles invalides', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [0, 0], [1, 0]);
  boid.maxSpeed = 0;
  close(boid.flee(new env.Vector(10, 0)), [-0.2, 0]);
  boid.maxForce = 0;
  close(boid.flee(new env.Vector(-10, 0)), [0, 0]);
  boid.maxForce = 0.2;
  for (const target of [null, {x: NaN, y: 0}, {x: Infinity, y: 1}]) {
    close(boid.flee(target), [0, 0]);
  }
});

test('Wander conserve le cercle et le tirage mais calcule un steering directionnel', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [10, 20], [3, 4]);
  boid.distanceCercle = 150;
  boid.wanderRadius = 50;
  boid.wanderTheta = 0.2;
  boid.displaceRange = 0.1;
  env.setRandomSequence([0.5]);
  const heading = Math.atan2(4, 3);
  const center = [10 + 3 / 5 * 150, 20 + 4 / 5 * 150];
  const angle = heading + boid.wanderTheta;
  const target = [center[0] + 50 * Math.cos(angle), center[1] + 50 * Math.sin(angle)];
  const expected = expectedSteering([target[0] - 10, target[1] - 20], [3, 4], 5, 0.2);
  const originalPosition = boid.pos.copy();
  const originalVelocity = boid.vel.copy();

  close(boid.wander(), expected);
  close(boid.pos, [originalPosition.x, originalPosition.y]);
  close(boid.vel, [originalVelocity.x, originalVelocity.y]);
  assert.deepEqual(env.randomEvents, [[-0.1, 0.1]]);
  assert.equal(boid.wanderTheta, 0.2);
  assert.ok(Math.hypot(...expected) <= boid.maxForce + 1e-12);
});

test('Wander reste fini à vitesse nulle et freine quand maxSpeed vaut zéro', () => {
  const env = loadTD7({mode: 'current'});
  const stationary = makeBoid(env, [10, 20], [0, 0]);
  const capped = makeBoid(env, [10, 20], [1, 0]);
  env.setRandomSequence([0.5]);
  const force = stationary.wander();
  assert.ok(Number.isFinite(force.x) && Number.isFinite(force.y));
  assert.ok(Math.abs(force.mag() - stationary.maxForce) < 1e-12);

  capped.maxSpeed = 0;
  env.setRandomSequence([0.5]);
  close(capped.wander(), [-capped.maxForce, 0]);
  capped.maxForce = 0;
  env.setRandomSequence([0.5]);
  close(capped.wander(), [0, 0]);
});

test('Wander à cible géométrique confondue produit un freinage fini', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [10, 20], [1, 0]);
  boid.distanceCercle = 0;
  boid.wanderRadius = 0;
  env.setRandomSequence([0.5]);
  close(boid.wander(), [-0.2, 0]);
});

test('Wander conserve ses diagnostics graphiques sans modifier la séquence aléatoire', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [20, 30], [1, 0]);
  env.Boid.debug = true;
  env.setRandomSequence([0.5]);
  boid.wander();
  assert.ok(env.graphics.some(call => call.name === 'circle'));
  assert.ok(env.graphics.some(call => call.name === 'line'));
  assert.deepEqual(env.randomEvents, [[-0.1, 0.1]]);
  env.Boid.debug = false;
});

test('Boundaries retourne steering borné pour les quatre bords', () => {
  const env = loadTD7({mode: 'current'});
  const cases = [
    {position: [10, 100], velocity: [1, 2], desiredDirection: [5, 2]},
    {position: [1190, 100], velocity: [-1, 2], desiredDirection: [-5, 2]},
    {position: [100, 10], velocity: [1, -2], desiredDirection: [1, 5]},
    {position: [100, 790], velocity: [1, 2], desiredDirection: [1, -5]}
  ];
  for (const item of cases) {
    const boid = makeBoid(env, item.position, item.velocity);
    const expected = expectedSteering(item.desiredDirection, item.velocity, 5, 0.2);
    const actual = boid.boundaries(0, 0, 1200, 800, 25);
    close(actual, expected);
    assert.ok(actual.mag() <= boid.maxForce + 1e-12);
  }
});

test('Boundaries conserve la priorité des coins et le zéro hors zone', () => {
  const env = loadTD7({mode: 'current'});
  const corner = makeBoid(env, [10, 10], [1, 2]);
  close(corner.boundaries(0, 0, 1200, 800, 25),
    expectedSteering([1, 5], [1, 2], 5, 0.2));
  const center = makeBoid(env, [600, 400], [1, 0]);
  close(center.boundaries(0, 0, 1200, 800, 25), [0, 0]);
  const edge = makeBoid(env, [25, 400], [1, 0]);
  close(edge.boundaries(0, 0, 1200, 800, 25), [0, 0]);
  const stopped = makeBoid(env, [10, 100], [1, 0]);
  stopped.maxSpeed = 0;
  close(stopped.boundaries(0, 0, 1200, 800, 25), [-0.2, 0]);
  stopped.maxForce = 0;
  close(stopped.boundaries(0, 0, 1200, 800, 25), [0, 0]);
});

test('Boundaries ne mute pas la vitesse et conserve son dessin debug', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [600, 400], [-1, 1]);
  const velocity = boid.vel.copy();
  env.Boid.debug = true;
  boid.boundaries(0, 0, 1200, 800, 25);
  close(boid.vel, [velocity.x, velocity.y]);
  assert.ok(env.graphics.some(call => call.name === 'rect'));
  env.Boid.debug = false;
});

test('Separation conserve exactement son calcul historique à distance positive', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [0, 0], [0, 1]);
  const neighbor = makeBoid(env, [10, 0], [0, 3]);
  const neighborBefore = {pos: neighbor.pos.copy(), vel: neighbor.vel.copy()};
  close(boid.separation([boid, neighbor]), [-0.19611613513818404, -0.03922322702763681]);
  close(neighbor.pos, [neighborBefore.pos.x, neighborBefore.pos.y]);
  close(neighbor.vel, [neighborBefore.vel.x, neighborBefore.vel.y]);
});

test('Separation superposée utilise la vitesse relative et une règle opposée par identifiant', () => {
  const env = loadTD7({mode: 'current'});
  const first = makeBoid(env, [20, 20], [1, 0]);
  const second = makeBoid(env, [20, 20], [0, 0]);
  close(first.separation([second, first]), [-0.2, 0]);
  close(second.separation([first, second]), [0.2, 0]);
});

test('Separation superposée immobile est déterministe et indépendante de l’ordre des voisins', () => {
  const env = loadTD7({mode: 'current'});
  const lowerId = makeBoid(env, [5, 5], [0, 0]);
  const subject = makeBoid(env, [5, 5], [0, 0]);
  const higherId = makeBoid(env, [5, 5], [0, 0]);
  const a = subject.separation([lowerId, higherId]);
  const b = subject.separation([higherId, lowerId]);
  close(a, [0, 0]);
  close(b, [0, 0]);
  assert.ok(Number.isFinite(a.x) && Number.isFinite(a.y));
  assert.deepEqual(env.warnings, []);
  const drawsBefore = env.randomEvents.length;
  subject.separation([higherId, lowerId]);
  assert.equal(env.randomEvents.length, drawsBefore);
});

test('Separation conserve des forces finies lorsque les limites physiques valent zéro', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [0, 0], [1, 0]);
  const neighbor = makeBoid(env, [0, 0], [0, 0]);
  boid.maxForce = 0;
  close(boid.separation([boid, neighbor]), [0, 0]);
  boid.maxForce = 0.2;
  boid.maxSpeed = 0;
  close(boid.separation([boid, neighbor]), [-0.2, 0]);
});

test('Separation sans voisin et avec états invalides reste finie sans muter les entrées', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [0, 0], [1, 0]);
  close(boid.separation([boid]), [0, 0]);
  const invalid = makeBoid(env, [NaN, 0], [0, 1]);
  const before = boid.vel.copy();
  const force = boid.separation([boid, invalid]);
  assert.ok(Number.isFinite(force.x) && Number.isFinite(force.y));
  close(boid.vel, [before.x, before.y]);
});

test('Avoid sans obstacle, obstacles invalides ou très éloignés retourne zéro sans exception', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [100, 100], [1, 0]);
  close(boid.avoid([]), [0, 0]);
  close(boid.avoid([null, {}, {pos: null}, {pos: new env.Vector(NaN, 0)}]), [0, 0]);
  close(boid.avoid([new env.Obstacle(1e12, 1e12, 10, 'green')]), [0, 0]);
});

test('Avoid conserve X/Q15/Q30 et sélectionne le premier obstacle en égalité', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [100, 100], [1, 0]);
  const first = new env.Obstacle(130, 105, 10, 'green');
  const tied = new env.Obstacle(130, 95, 10, 'green');
  const expected = expectedSteering([0, -5], [1, 0], 5, boid.maxForce / 2);
  close(boid.avoid([first, tied]), expected);
  close(boid.avoid([tied, first]), expectedSteering([0, 5], [1, 0], 5, boid.maxForce / 2));
  assert.ok(boid.avoid([first]).mag() <= boid.maxForce / 2 + 1e-12);
});

test('Avoid conserve le choix Q15 et X lorsque ces échantillons sont les plus proches', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [100, 100], [1, 0]);
  close(boid.avoid([new env.Obstacle(116, 100, 2, 'green')]), [-0.1, 0]);
  close(boid.avoid([new env.Obstacle(100, 102, 3, 'green')]),
    expectedSteering([0, -2], [1, 0], 5, 0.1));
});

test('Avoid garde le seuil strict et freine à la coïncidence exacte point/centre', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [100, 100], [1, 0]);
  close(boid.avoid([new env.Obstacle(130, 106, 3, 'green')]), [0, 0]);
  close(boid.avoid([new env.Obstacle(130, 100, 10, 'green')]), [-0.1, 0]);
  const stationary = makeBoid(env, [100, 100], [0, 0]);
  close(stationary.avoid([new env.Obstacle(100, 100, 10, 'green')]), [0, 0]);
});

test('Avoid reste borné avec maxSpeed/maxForce nuls et conserve son rendu debug', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [100, 100], [1, 0]);
  const obstacle = new env.Obstacle(130, 105, 10, 'green');
  const position = boid.pos.copy();
  const obstaclePosition = obstacle.pos.copy();
  boid.maxSpeed = 0;
  close(boid.avoid([obstacle]), [-0.1, 0]);
  boid.maxForce = 0;
  close(boid.avoid([obstacle]), [0, 0]);
  boid.maxForce = 0.2;
  env.Boid.debug = true;
  boid.avoid([obstacle]);
  assert.ok(env.graphics.some(call => call.name === 'line'));
  assert.ok(env.graphics.some(call => call.name === 'circle'));
  close(boid.pos, [position.x, position.y]);
  close(obstacle.pos, [obstaclePosition.x, obstaclePosition.y]);
  env.Boid.debug = false;
});

test('fleeWithTargetRadius conserve son application unique et son multiplicateur historique', () => {
  const env = loadTD7({mode: 'current'});
  const boid = makeBoid(env, [0, 0], [0, 1]);
  const applied = [];
  boid.applyForce = force => applied.push(force.copy());
  boid.fleeWithTargetRadius({pos: new env.Vector(10, 0), r: 5});
  assert.equal(applied.length, 1);
  const force = expectedSteering([-10, 0], [0, 1], boid.maxSpeed, boid.maxForce);
  close(applied[0], [force[0] * 100, force[1] * 100]);
});
