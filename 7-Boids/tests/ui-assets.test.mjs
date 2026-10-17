import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import {loadTD7} from './reference-harness.mjs';

const repoRoot = fileURLToPath(new URL('../../', import.meta.url));

function runPreloadAndSetup() {
  const env = loadTD7({mode: 'current', includeSketch: true, seed: 0x2d4b1});
  const imagePaths = [];
  const soundPaths = [];
  const sliders = [];
  const loadImage = env.scope.loadImage;
  const loadSound = env.scope.loadSound;
  const createSlider = env.scope.createSlider;
  env.scope.loadImage = assetPath => {
    imagePaths.push(assetPath);
    return loadImage(assetPath);
  };
  env.scope.loadSound = assetPath => {
    soundPaths.push(assetPath);
    return loadSound(assetPath);
  };
  env.scope.createSlider = (min, max, value, step) => {
    const slider = createSlider(min, max, value, step);
    sliders.push({min, max, value, step, slider});
    return slider;
  };
  env.scope.preload();
  env.scope.setup();
  return {env, imagePaths, soundPaths, sliders};
}

test('preload charge le sprite poisson avec la casse du fichier suivi; autres ressources inchangées', () => {
  const {imagePaths, soundPaths} = runPreloadAndSetup();
  const expectedFishPath = 'assets/niceFishTransparent.png';
  const assetDirectory = path.join(repoRoot, '7-Boids', 'assets');
  const trackedPath = '7-Boids/assets/niceFishTransparent.png';

  assert.ok(existsSync(path.join(assetDirectory, 'niceFishTransparent.png')));
  assert.ok(readdirSync(assetDirectory).includes('niceFishTransparent.png'));
  assert.equal(execFileSync('git', ['ls-files', '--error-unmatch', trackedPath], {
    cwd: repoRoot, encoding: 'utf8'
  }).trim(), trackedPath);
  assert.deepEqual(imagePaths, [
    expectedFishPath,
    'assets/SharkTransparent.png'
  ]);
  assert.ok(!readdirSync(assetDirectory).includes('niceFishtransparent.png'));
  assert.deepEqual(soundPaths, ['assets/eating.wav', 'assets/aie.wav', 'assets/ouuuu.ogg']);
});

test('les valeurs par défaut des sliders correspondent aux poids physiques initiaux des poissons', () => {
  const {env, sliders} = runPreloadAndSetup();
  const fish = vmFlock(env);
  const defaults = sliders.map(({min, max, value, step}) => [min, max, value, step]);

  assert.deepEqual(defaults, [
    [0, 2, 1.5, 0.1],
    [0, 2, 1, 0.1],
    [0, 15, 2, 0.1],
    [0, 15, 10, 1],
    [4, 40, 6, 1],
    [15, 60, 25, 1]
  ]);
  assert.ok(fish.length > 0);
  for (const boid of fish) {
    assert.deepEqual([
      boid.alignWeight, boid.cohesionWeight, boid.separationWeight,
      boid.boundariesWeight, boid.avoidWeight
    ], [1.5, 1, 2, 10, 15]);
  }
  assert.ok(fish.every(boid => boid.r >= 8 && boid.r <= 40),
    'the radius slider default does not replace the historical randomized radii at setup');

  const shark = vm.runInContext('requin', env.scope);
  assert.deepEqual([shark.r, shark.maxSpeed, shark.maxForce], [40, 7, 0.5]);
});

test('les callbacks réels des sliders continuent de propager leurs valeurs aux poissons présents', () => {
  const {env, sliders} = runPreloadAndSetup();
  const fish = vmFlock(env);
  const separation = sliders[2].slider;
  separation.currentValue = 4.2;
  separation.onInput();
  assert.ok(fish.every(boid => boid.separationWeight === 4.2));

  const radius = sliders[4].slider;
  radius.currentValue = 14;
  radius.onInput();
  assert.ok(fish.every(boid => boid.r === 14));

  const alignment = sliders[0].slider;
  alignment.currentValue = 0.7;
  alignment.onInput();
  assert.ok(fish.every(boid => boid.alignWeight === 0.7));
});

function vmFlock(env) {
  return vm.runInContext('Array.from(flock)', env.scope);
}

test('mouseDragged copie les cinq valeurs courantes des sliders sans changer rayons ni marge Avoid', () => {
  const {env, sliders} = runPreloadAndSetup();
  const sliderRefs = vm.runInContext(
    '[alignSlider, cohesionSlider, separationSlider, boundariesSlider, perceptionSlider]',
    env.scope
  );
  const sliderIndexes = [0, 1, 2, 3, 5];
  sliderIndexes.forEach((sliderIndex, index) => {
    assert.equal(sliderRefs[index], sliders[sliderIndex].slider);
  });
  const setCurrentSliderValues = values => {
    values.forEach((value, index) => {
      const slider = sliders[sliderIndexes[index]].slider;
      slider.currentValue = value;
      slider.onInput();
    });
  };
  const addFishWithRandomSequence = values => {
    env.setRandomSequence(values);
    env.scope.mouseX = 321;
    env.scope.mouseY = 234;
    env.scope.mouseDragged();
    const fish = vm.runInContext('flock[flock.length - 1]', env.scope);
    assert.deepEqual(env.randomEvents, [[Math.PI * 2, undefined], [2, 4], [8, 40]]);
    return fish;
  };

  setCurrentSliderValues([0.5, 1.8, 8, 12, 40]);
  const first = addFishWithRandomSequence([0.25, 0.5, 0.75]);
  assert.deepEqual([
    first.alignWeight, first.cohesionWeight, first.separationWeight,
    first.boundariesWeight, first.perceptionRadius
  ], [0.5, 1.8, 8, 12, 40]);
  assert.ok([
    first.alignWeight, first.cohesionWeight, first.separationWeight,
    first.boundariesWeight, first.perceptionRadius
  ].every(value => typeof value === 'number'));
  assert.equal(first.r, 32);
  assert.equal(first.largeurZoneEvitementDevantVaisseau, 3,
    'Avoid margin keeps its constructor value instead of being recomputed from random r');
  assert.equal(first.avoidWeight, 15);

  setCurrentSliderValues([0, 2, 0, 15, 60]);
  const firstAfterSliderCallbacks = [
    first.alignWeight, first.cohesionWeight, first.separationWeight,
    first.boundariesWeight, first.perceptionRadius
  ];
  const second = addFishWithRandomSequence([0.75, 0.25, 0.4]);
  assert.deepEqual([
    second.alignWeight, second.cohesionWeight, second.separationWeight,
    second.boundariesWeight, second.perceptionRadius
  ], [0, 2, 0, 15, 60]);
  assert.ok([
    second.alignWeight, second.cohesionWeight, second.separationWeight,
    second.boundariesWeight, second.perceptionRadius
  ].every(value => typeof value === 'number'));
  assert.deepEqual([
    first.alignWeight, first.cohesionWeight, first.separationWeight,
    first.boundariesWeight, first.perceptionRadius
  ], firstAfterSliderCallbacks, 'adding another fish does not change existing fish');
  assert.equal(second.r, 20.8);
  assert.ok(second.r >= 8 && second.r <= 40);
  assert.equal(second.largeurZoneEvitementDevantVaisseau, 3);
  assert.equal(second.avoidWeight, 15);
});

test('mousePressed et mouseDragged conservent les interactions historiques C6', () => {
  const {env} = runPreloadAndSetup();
  const fishCount = vm.runInContext('flock.length', env.scope);
  const obstacleCount = vm.runInContext('obstacles.length', env.scope);
  const initialMouseObstacle = vm.runInContext('obstacles[0]', env.scope);

  env.scope.mouseX = 470;
  env.scope.mouseY = 360;
  env.scope.mousePressed();
  assert.equal(vm.runInContext('obstacles.length', env.scope), obstacleCount + 1);

  env.scope.mouseDragged();
  assert.equal(vm.runInContext('flock.length', env.scope), fishCount + 1);
  const addedFish = vm.runInContext('flock[flock.length - 1]', env.scope);
  assert.deepEqual([addedFish.pos.x, addedFish.pos.y], [470, 360]);
  env.scope.mouseDragged();
  assert.equal(vm.runInContext('flock.length', env.scope), fishCount + 2);
  assert.equal(vm.runInContext('obstacles[0]', env.scope), initialMouseObstacle);
});
