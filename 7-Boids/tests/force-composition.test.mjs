import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {loadTD7} from './reference-harness.mjs';

const behaviorNames = ['avoid', 'alignment', 'cohesion', 'separation', 'boundaries'];
const zero = [0, 0];

function closeVector(vector, expected, epsilon = 1e-10) {
  assert.ok(Number.isFinite(vector.x) && Number.isFinite(vector.y), 'vector must be finite');
  assert.ok(Math.abs(vector.x - expected[0]) <= epsilon,
    `x: expected ${expected[0]}, received ${vector.x}`);
  assert.ok(Math.abs(vector.y - expected[1]) <= epsilon,
    `y: expected ${expected[1]}, received ${vector.y}`);
}

function createSketchFish({raw = {}, sharkFlee = zero, mouseFlee = zero,
  weights = {}, maxForce = 0.2, maxSpeed = 5, fishCount = 1,
  realFlee = false, threatsAtFish = false, velocity = zero} = {}) {
  const env = loadTD7({mode: 'current', includeSketch: true, seed: 0x71d07});
  env.scope.preload();
  env.scope.setup();
  vm.runInContext('flock.length = 0', env.scope);

  const shark = vm.runInContext('requin', env.scope);
  if (threatsAtFish) shark.pos.set(100, 100);
  shark.wander = () => new env.Vector(0, 0);
  shark.getVehiculeLePlusProche = () => undefined;
  shark.edges = () => {};
  shark.update = () => {};
  shark.show = () => {};

  vm.runInContext(`
    obstacles.length = 1;
    obstacleSouris.pos.set(${threatsAtFish ? 100 : 1100}, ${threatsAtFish ? 100 : 700});
    mouseX = 1100;
    mouseY = 700;
  `, env.scope);

  const events = [];
  const fish = [];
  const applied = [];
  const rawVectorSets = [];
  for (let i = 0; i < fishCount; i++) {
    const boid = new env.Boid(100 + i * 20, 100);
    boid.pos.set(100 + i * 20, 100);
    boid.vel.set(velocity[0], velocity[1]);
    boid.maxForce = maxForce;
    boid.maxSpeed = maxSpeed;
    Object.assign(boid, {
      alignWeight: 1.5,
      cohesionWeight: 1,
      separationWeight: 2,
      boundariesWeight: 10,
      avoidWeight: 15,
      ...weights
    });
    boid.flock = () => {
      events.push(`flock:${i}`);
      const contributions = Object.fromEntries(behaviorNames.map(name => [name,
        new env.Vector(...(raw[name] ?? zero))]));
      rawVectorSets.push(contributions);
      return contributions;
    };
    if (!realFlee) {
      let fleeCalls = 0;
      boid.fleeWithTargetRadius = target => {
        const isShark = target === shark;
        events.push(`flee:${i}:${isShark ? 'shark' : 'mouse'}`);
        const vector = fleeCalls++ === 0 ? sharkFlee : mouseFlee;
        return {active: vector[0] !== 0 || vector[1] !== 0,
          force: new env.Vector(vector[0], vector[1])};
      };
    }
    const applyForce = boid.applyForce.bind(boid);
    boid.applyForce = force => {
      events.push(`apply:${i}`);
      applied.push(force.copy());
      return applyForce(force);
    };
    const update = boid.update.bind(boid);
    boid.update = () => {
      events.push(`update:${i}`);
      return update();
    };
    boid.show = () => events.push(`show:${i}`);
    env.scope[`__fish${i}`] = boid;
    fish.push(boid);
  }
  vm.runInContext(`flock.push(${fish.map((_, i) => `__fish${i}`).join(',')})`, env.scope);
  env.scope.draw();
  return {env, fish, events, applied, rawVectorSets};
}

function createSharkDraw({fishDistances = [], wander = [0.1, 0], seek = [0.02, 0],
  useRealWander = false, useRealSeek = false, maxForce = 0.5, randomValues = [0.5]} = {}) {
  const env = loadTD7({mode: 'current', includeSketch: true, seed: 0x7d03});
  env.scope.preload();
  env.scope.setup();
  vm.runInContext('flock.length = 0', env.scope);

  const shark = vm.runInContext('requin', env.scope);
  shark.pos.set(600, 400);
  shark.vel.set(0, 0);
  shark.maxForce = maxForce;
  const events = [];
  const applied = [];
  const wanderVector = new env.Vector(wander[0], wander[1]);
  const seekVector = new env.Vector(seek[0], seek[1]);
  const originalWander = shark.wander.bind(shark);
  const originalSeek = shark.seek.bind(shark);
  const originalApply = shark.applyForce.bind(shark);
  const originalUpdate = shark.update.bind(shark);
  const originalEdges = shark.edges.bind(shark);
  let wanderCalls = 0;
  let seekTarget;

  if (!useRealWander) {
    shark.wander = () => {
      wanderCalls++;
      events.push('wander');
      return wanderVector;
    };
  } else {
    shark.wander = () => {
      wanderCalls++;
      events.push('wander');
      return originalWander();
    };
  }
  shark.seek = target => {
    events.push('seek');
    seekTarget = target;
    return useRealSeek ? originalSeek(target) : seekVector;
  };
  shark.applyForce = force => {
    events.push('apply');
    applied.push(force.copy());
    return originalApply(force);
  };
  shark.edges = () => {
    events.push('edges');
    return originalEdges();
  };
  shark.update = () => {
    events.push('update');
    return originalUpdate();
  };
  shark.show = () => events.push('show-shark');

  const fish = fishDistances.map((distance, index) => {
    const boid = new env.Boid(600 + distance, 400);
    boid.pos.set(600 + distance, 400);
    boid.vel.set(0, 0);
    boid.flock = () => Object.fromEntries(behaviorNames.map(name => [name, new env.Vector(0, 0)]));
    boid.fleeWithTargetRadius = () => ({active: false, force: new env.Vector(0, 0)});
    boid.applyForce = () => {};
    boid.update = () => {};
    boid.show = () => {};
    env.scope[`__sharkTestFish${index}`] = boid;
    return boid;
  });
  vm.runInContext(`flock.push(${fish.map((_, index) => `__sharkTestFish${index}`).join(',')})`, env.scope);
  env.setRandomSequence(randomValues);
  env.scope.draw();
  return {env, shark, fish, events, applied, wanderVector, seekVector, seekTarget,
    get wanderCalls() { return wanderCalls; }};
}

test('requin sans poisson ou avec un poisson hors rayon applique uniquement Wander', () => {
  for (const fishDistances of [[], [70.001]]) {
    const result = createSharkDraw({fishDistances, wander: [0.3, 0.4]});
    closeVector(result.applied[0], [0.3, 0.4]);
    assert.equal(result.events.filter(event => event === 'seek').length, 0);
    assert.equal(result.events.filter(event => event === 'apply').length, 1);
    assert.equal(result.events.filter(event => event === 'update').length, 1);
    assert.equal(result.wanderCalls, 1);
  }
});

test('requin compose Wander + 7 × Seek avec sélection réelle du poisson le plus proche', () => {
  const result = createSharkDraw({fishDistances: [35, 20, 50],
    wander: [0.1, 0], seek: [0.02, 0]});
  closeVector(result.applied[0], [0.24, 0]);
  assert.equal(result.seekTarget, result.fish[1].pos);
  assert.deepEqual(result.events.filter(event => ['wander', 'seek', 'apply', 'edges', 'update'].includes(event)),
    ['wander', 'seek', 'apply', 'edges', 'update']);
  assert.equal(result.events.filter(event => event === 'apply').length, 1);
  assert.equal(result.events.filter(event => event === 'edges').length, 1);
  assert.equal(result.events.filter(event => event === 'update').length, 1);
  closeVector(result.wanderVector, [0.1, 0]);
  closeVector(result.seekVector, [0.02, 0]);
});

test('seuil de poursuite du requin reste strictement inférieur à 70 pixels', () => {
  const atThreshold = createSharkDraw({fishDistances: [70], wander: [0.1, 0]});
  closeVector(atThreshold.applied[0], [0.1, 0]);
  assert.equal(atThreshold.events.includes('seek'), false);

  const inside = createSharkDraw({fishDistances: [69.999], wander: [0.1, 0], seek: [0, 0.02]});
  closeVector(inside.applied[0], [0.1, 0.14]);
  assert.equal(inside.events.includes('seek'), true);
});

test('poisson exactement sur le requin reste sélectionné; Seek nul et Wander nul restent finis', () => {
  const coincident = createSharkDraw({fishDistances: [0], wander: [0, 0], useRealSeek: true});
  closeVector(coincident.applied[0], [0, 0]);
  assert.equal(coincident.seekTarget, coincident.fish[0].pos);
  assert.equal(coincident.events.filter(event => event === 'seek').length, 1);
  assert.equal(vm.runInContext('flock.length', coincident.env.scope), 0,
    'historical close-range eating interaction remains active');
  assert.ok(Number.isFinite(coincident.applied[0].x) && Number.isFinite(coincident.applied[0].y));

  const zeroContributions = createSharkDraw({fishDistances: [20], wander: [0, 0], seek: [0, 0]});
  closeVector(zeroContributions.applied[0], [0, 0]);
});

test('la résultante Wander + Seek est plafonnée à maxForce sans muter les forces sources', () => {
  const aligned = createSharkDraw({fishDistances: [10], wander: [0.3, 0], seek: [0.1, 0]});
  closeVector(aligned.applied[0], [0.5, 0]);
  assert.ok(aligned.applied[0].mag() <= aligned.shark.maxForce + 1e-12);
  closeVector(aligned.wanderVector, [0.3, 0]);
  closeVector(aligned.seekVector, [0.1, 0]);

  const opposed = createSharkDraw({fishDistances: [10], wander: [0.2, 0], seek: [-0.02, 0]});
  closeVector(opposed.applied[0], [0.06, 0]);

  const zeroLimit = createSharkDraw({fishDistances: [10], wander: [0.2, 0],
    seek: [0.02, 0], maxForce: 0});
  closeVector(zeroLimit.applied[0], [0, 0]);
  assert.ok(Number.isFinite(zeroLimit.shark.acc.x) && Number.isFinite(zeroLimit.shark.acc.y));
});

test('Wander du requin est calculé une fois et consomme un seul tirage aléatoire par frame', () => {
  const result = createSharkDraw({fishDistances: [], useRealWander: true, randomValues: [0.5]});
  assert.equal(result.wanderCalls, 1);
  assert.equal(result.env.randomEvents.length, 1);
  assert.deepEqual(result.env.randomEvents[0], [-result.shark.displaceRange, result.shark.displaceRange]);
  assert.equal(result.events.filter(event => event === 'apply').length, 1);
  assert.equal(result.events.filter(event => event === 'update').length, 1);
  assert.ok(Number.isFinite(result.applied[0].x) && Number.isFinite(result.applied[0].y));
});

test('flock retourne cinq forces brutes dans l’ordre historique et ne les applique pas', () => {
  const env = loadTD7({mode: 'current'});
  const boid = new env.Boid(100, 100);
  const order = [];
  const expected = {};
  let vectorIndex = 0;
  for (const name of ['avoid', 'align', 'cohesion', 'separation', 'boundaries']) {
    expected[name] = new env.Vector(++vectorIndex, 0);
    boid[name] = () => { order.push(name); return expected[name]; };
  }
  let applyCount = 0;
  boid.applyForce = () => { applyCount++; };

  const contributions = boid.flock([], []);

  assert.deepEqual(order, ['avoid', 'align', 'cohesion', 'separation', 'boundaries']);
  assert.deepEqual(Object.keys(contributions), behaviorNames);
  assert.equal(applyCount, 0);
  for (const name of behaviorNames) assert.equal(contributions[name], expected[name === 'alignment' ? 'align' : name]);
  closeVector(contributions.alignment, [2, 0]);
});

test('forces alignées s’additionnent puis sont plafonnées dans le vrai draw du sketch', () => {
  const raw = {alignment: [0.1, 0], cohesion: [0.1, 0]};
  const weights = {alignWeight: 1, cohesionWeight: 1};
  const result = createSketchFish({raw, weights});
  closeVector(result.applied[0], [0.2, 0]);
  assert.ok(result.applied[0].mag() <= result.fish[0].maxForce + 1e-12);
});

test('forces opposées s’annulent avant le plafonnement global', () => {
  const result = createSketchFish({raw: {alignment: [0.1, 0], cohesion: [-0.1, 0]},
    weights: {alignWeight: 1, cohesionWeight: 1}});
  closeVector(result.applied[0], zero);
});

test('forces perpendiculaires conservent leur direction de somme', () => {
  const result = createSketchFish({raw: {alignment: [0.1, 0], cohesion: [0, 0.1]},
    weights: {alignWeight: 1, cohesionWeight: 1}, maxForce: 1});
  closeVector(result.applied[0], [0.1, 0.1]);
});

test('une somme sous maxForce est appliquée sans changement', () => {
  const result = createSketchFish({raw: {alignment: [0.03, 0.04]},
    weights: {alignWeight: 1}, maxForce: 0.2});
  closeVector(result.applied[0], [0.03, 0.04]);
});

test('une somme supérieure à maxForce garde sa direction et atteint maxForce', () => {
  const result = createSketchFish({raw: {alignment: [0.2, 0.2]},
    weights: {alignWeight: 2}, maxForce: 0.2});
  const component = 0.2 / Math.sqrt(2);
  closeVector(result.applied[0], [component, component]);
  assert.ok(Math.abs(result.applied[0].mag() - 0.2) <= 1e-12);
});

test('un poids nul neutralise seulement sa contribution', () => {
  const result = createSketchFish({raw: {alignment: [0.1, 0], cohesion: [0, 0.1]},
    weights: {alignWeight: 0, cohesionWeight: 1}, maxForce: 1});
  closeVector(result.applied[0], [0, 0.1]);
});

test('un poids élevé est conservé avant le plafond global', () => {
  const result = createSketchFish({raw: {avoid: [0.1, 0]},
    weights: {avoidWeight: 1000}, maxForce: 0.2});
  closeVector(result.applied[0], [0.2, 0]);
});

test('maxForce nul neutralise toute la composition', () => {
  const result = createSketchFish({raw: {alignment: [1, 0], avoid: [1, 1]},
    sharkFlee: [1, 0], mouseFlee: [0, 1], maxForce: 0});
  closeVector(result.applied[0], zero);
});

test('aucun voisin ni obstacle produit les cinq forces de flock nulles sans application interne', () => {
  const env = loadTD7({mode: 'current'});
  const boid = new env.Boid(600, 400);
  boid.pos.set(600, 400);
  boid.vel.set(1, 0);
  let applyCount = 0;
  boid.applyForce = () => { applyCount++; };
  const result = boid.flock([boid], []);
  for (const force of Object.values(result)) closeVector(force, zero);
  assert.equal(applyCount, 0);
});

test('plusieurs voisins donnent des forces sociales finies et individuellement bornées', () => {
  const env = loadTD7({mode: 'current', seed: 12});
  const boid = new env.Boid(100, 100);
  const first = new env.Boid(110, 100);
  const second = new env.Boid(105, 112);
  boid.pos.set(100, 100); boid.vel.set(1, 0);
  first.pos.set(110, 100); first.vel.set(0, 1);
  second.pos.set(105, 112); second.vel.set(-1, 0);
  const result = boid.flock([boid, first, second], []);
  for (const name of ['alignment', 'cohesion', 'separation']) {
    assert.ok(Number.isFinite(result[name].x) && Number.isFinite(result[name].y));
    assert.ok(result[name].mag() <= boid.maxForce + 1e-12, `${name} exceeds maxForce`);
  }
});

test('Avoid sans obstacle retourne une contribution nulle utilisable par flock', () => {
  const env = loadTD7({mode: 'current'});
  const boid = new env.Boid(100, 100);
  boid.pos.set(100, 100); boid.vel.set(1, 0);
  const result = boid.flock([boid], []);
  closeVector(result.avoid, zero);
});

test('fuite du requin seule est pondérée puis composée une fois', () => {
  const result = createSketchFish({sharkFlee: [0, 0.1], weights: {}, maxForce: 0.2});
  closeVector(result.applied[0], [0, 0.2]);
});

test('fuite de l’obstacle souris seule conserve le poids historique 100', () => {
  const result = createSketchFish({mouseFlee: [0.1, 0], maxForce: 0.2});
  closeVector(result.applied[0], [0.2, 0]);
});

test('deux menaces sont additionnées avant un seul plafonnement', () => {
  const result = createSketchFish({sharkFlee: [0.1, 0], mouseFlee: [0, 0.1], maxForce: 0.2});
  const component = 0.2 / Math.sqrt(2);
  closeVector(result.applied[0], [component, component]);
});

test('deux menaces réelles coïncidentes freinent le poisson puis respectent le plafond global', () => {
  const result = createSketchFish({realFlee: true, threatsAtFish: true, velocity: [0, 1]});
  closeVector(result.applied[0], [0, -0.2]);
  assert.equal(result.events.filter(event => event === 'apply:0').length, 1);
  assert.equal(result.events.filter(event => event === 'update:0').length, 1);
});

test('fleeWithTargetRadius traite les cibles absentes et invalides comme inactives', () => {
  const env = loadTD7({mode: 'current'});
  const boid = new env.Boid(0, 0);
  for (const target of [null, undefined, {}, {pos: null, r: 2},
    {pos: {x: NaN, y: 0}, r: 2}, {pos: new env.Vector(0, 0), r: Infinity}]) {
    const result = boid.fleeWithTargetRadius(target);
    assert.equal(result.active, false);
    closeVector(result.force, zero);
  }
});

test('fleeWithTargetRadius garde le seuil strict et freine à la coïncidence', () => {
  const env = loadTD7({mode: 'current'});
  const boid = new env.Boid(0, 0);
  boid.pos.set(0, 0); boid.vel.set(0, 1);
  const atBoundary = boid.fleeWithTargetRadius({pos: new env.Vector(15, 0), r: 5});
  assert.equal(atBoundary.active, false);
  const coincident = boid.fleeWithTargetRadius({pos: new env.Vector(0, 0), r: 5});
  assert.equal(coincident.active, true);
  closeVector(coincident.force, [0, -boid.maxForce]);
});

test('pondération et composition ne mutent pas les vecteurs bruts', () => {
  const result = createSketchFish({raw: {alignment: [0.1, 0.02],
    separation: [-0.03, 0.04], avoid: [0.01, -0.01]},
    sharkFlee: [0.01, 0.02], mouseFlee: [-0.01, 0.03]});
  closeVector(result.rawVectorSets[0].alignment, [0.1, 0.02]);
  closeVector(result.rawVectorSets[0].separation, [-0.03, 0.04]);
  closeVector(result.rawVectorSets[0].avoid, [0.01, -0.01]);
});

test('forces et poids invalides sont ignorés sans transmettre NaN à Vehicle', () => {
  const result = createSketchFish({raw: {alignment: [0.1, 0], cohesion: [NaN, 1]},
    weights: {alignWeight: 1, cohesionWeight: Infinity, avoidWeight: -1}, maxForce: 0.2});
  closeVector(result.applied[0], [0.1, 0]);
  assert.ok(Number.isFinite(result.fish[0].vel.x) && Number.isFinite(result.fish[0].vel.y));
});

test('le vrai draw applique une force et intègre une fois par poisson', () => {
  const result = createSketchFish({raw: {alignment: [0.2, 0.1]},
    weights: {alignWeight: 2}, fishCount: 1});
  assert.deepEqual(result.events.filter(e => e === 'apply:0'), ['apply:0']);
  assert.deepEqual(result.events.filter(e => e === 'update:0'), ['update:0']);
  assert.deepEqual(result.events.slice(0, 6), [
    'flock:0', 'flee:0:shark', 'flee:0:mouse', 'apply:0', 'update:0', 'show:0'
  ]);
  assert.ok(result.fish[0].vel.mag() <= result.fish[0].maxSpeed + 1e-12);
});

test('le vrai draw préserve le traitement séquentiel des poissons', () => {
  const result = createSketchFish({fishCount: 2});
  assert.deepEqual(result.events.slice(0, 6), [
    'flock:0', 'flee:0:shark', 'flee:0:mouse', 'apply:0', 'update:0', 'show:0'
  ]);
  assert.deepEqual(result.events.slice(6, 12), [
    'flock:1', 'flee:1:shark', 'flee:1:mouse', 'apply:1', 'update:1', 'show:1'
  ]);
});

test('poids, perception et seuils historiques restent inchangés', () => {
  const env = loadTD7({mode: 'current'});
  const fish = new env.Boid(100, 100);
  const shark = new env.Boid(0, 0);
  shark.r = 40;
  const mouseObstacle = new env.Obstacle(0, 0, 30, 'green');
  assert.deepEqual([fish.avoidWeight, fish.alignWeight, fish.cohesionWeight,
    fish.separationWeight, fish.boundariesWeight], [15, 1.5, 1, 2, 10]);
  assert.equal(fish.perceptionRadius, 25);
  assert.equal(fish.fleeWithTargetRadius({pos: new env.Vector(150, 100), r: shark.r}).active, false);
  assert.equal(fish.fleeWithTargetRadius({pos: new env.Vector(149.999, 100), r: shark.r}).active, true);
  assert.equal(fish.fleeWithTargetRadius({pos: new env.Vector(140, 100), r: mouseObstacle.r}).active, false);
  assert.equal(fish.fleeWithTargetRadius({pos: new env.Vector(139.999, 100), r: mouseObstacle.r}).active, true);
});

test('draw place l’obstacle souris avant Flee et Avoid et rend chaque obstacle une fois', () => {
  const env = loadTD7({mode: 'current', includeSketch: true, seed: 0xc2a});
  env.scope.preload();
  env.scope.setup();
  vm.runInContext('flock.length = 0', env.scope);

  const mouseObstacle = vm.runInContext('obstacles[0]', env.scope);
  const fixedObstacle = new env.Obstacle(950, 650, 24, 'green');
  env.scope.__fixedObstacle = fixedObstacle;
  vm.runInContext('obstacles.push(__fixedObstacle)', env.scope);
  const originalMousePosition = mouseObstacle.pos.copy();
  const mouseRadius = mouseObstacle.r;
  const fixedPosition = fixedObstacle.pos.copy();
  const obstacleShows = new Map([[mouseObstacle, []], [fixedObstacle, []]]);
  for (const obstacle of obstacleShows.keys()) {
    const show = obstacle.show.bind(obstacle);
    obstacle.show = () => {
      obstacleShows.get(obstacle).push(obstacle.pos.copy());
      return show();
    };
  }

  const fish = new env.Boid(100, 100);
  fish.pos.set(100, 100);
  fish.vel.set(0, 0);
  const fishObservations = {flock: 0, avoid: [], flee: [], apply: [], update: 0};
  const originalFlock = fish.flock.bind(fish);
  fish.flock = (...args) => {
    fishObservations.flock++;
    return originalFlock(...args);
  };
  const originalAvoid = fish.avoid.bind(fish);
  fish.avoid = obstacles => {
    fishObservations.avoid.push({
      instance: obstacles[0],
      position: obstacles[0].pos.copy()
    });
    return originalAvoid(obstacles);
  };
  const originalFlee = fish.fleeWithTargetRadius.bind(fish);
  fish.fleeWithTargetRadius = target => {
    if (target === mouseObstacle) {
      fishObservations.flee.push({instance: target, position: target.pos.copy()});
    }
    return originalFlee(target);
  };
  const applyFishForce = fish.applyForce.bind(fish);
  fish.applyForce = force => {
    fishObservations.apply.push(force.copy());
    return applyFishForce(force);
  };
  const updateFish = fish.update.bind(fish);
  fish.update = () => {
    fishObservations.update++;
    return updateFish();
  };
  fish.show = () => {};
  env.scope.__c2Fish = fish;
  vm.runInContext('flock.push(__c2Fish)', env.scope);

  const shark = vm.runInContext('requin', env.scope);
  shark.pos.set(1100, 700);
  let wanderCalls = 0;
  let sharkApplyCalls = 0;
  let sharkUpdateCalls = 0;
  let sharkEdgesCalls = 0;
  const wander = shark.wander.bind(shark);
  shark.wander = () => { wanderCalls++; return wander(); };
  const applySharkForce = shark.applyForce.bind(shark);
  shark.applyForce = force => { sharkApplyCalls++; return applySharkForce(force); };
  const updateShark = shark.update.bind(shark);
  shark.update = () => { sharkUpdateCalls++; return updateShark(); };
  const sharkEdges = shark.edges.bind(shark);
  shark.edges = () => { sharkEdgesCalls++; return sharkEdges(); };
  shark.show = () => {};

  env.setRandomSequence([0.5, 0.5]);
  const mousePositions = [[220, 150], [340, 260]];
  for (const [mouseX, mouseY] of mousePositions) {
    env.scope.mouseX = mouseX;
    env.scope.mouseY = mouseY;
    env.scope.draw();
  }

  const close = (vector, expected) => {
    assert.ok(Math.abs(vector.x - expected[0]) < 1e-10);
    assert.ok(Math.abs(vector.y - expected[1]) < 1e-10);
  };
  const expectedPositions = mousePositions.map(([x, y]) => [x, y]);
  assert.equal(vm.runInContext('obstacles[0]', env.scope), mouseObstacle);
  assert.ok(mouseObstacle instanceof env.Obstacle);
  assert.ok(mouseObstacle.pos instanceof env.Vector);
  assert.equal(mouseObstacle.r, mouseRadius);
  assert.equal(vm.runInContext('obstacles[1]', env.scope), fixedObstacle);
  close(fixedObstacle.pos, [fixedPosition.x, fixedPosition.y]);
  assert.notDeepEqual([originalMousePosition.x, originalMousePosition.y], expectedPositions[0]);

  for (const observations of [fishObservations.avoid, fishObservations.flee]) {
    assert.equal(observations.length, 2);
    observations.forEach((observation, index) => {
      assert.equal(observation.instance, mouseObstacle);
      close(observation.position, expectedPositions[index]);
    });
  }
  assert.equal(fishObservations.flock, 2);
  assert.equal(fishObservations.apply.length, 2);
  assert.ok(fishObservations.apply.every(force => force.mag() <= fish.maxForce + 1e-12));
  assert.equal(fishObservations.update, 2);
  assert.deepEqual(obstacleShows.get(mouseObstacle).map(({x, y}) => [x, y]), expectedPositions);
  assert.deepEqual(obstacleShows.get(fixedObstacle).map(({x, y}) => [x, y]), [
    [fixedPosition.x, fixedPosition.y], [fixedPosition.x, fixedPosition.y]
  ]);
  assert.equal(wanderCalls, 2);
  assert.equal(sharkApplyCalls, 2);
  assert.equal(sharkEdgesCalls, 2);
  assert.equal(sharkUpdateCalls, 2);
  assert.equal(env.randomEvents.length, 2, 'one unchanged Wander draw per frame');
});
