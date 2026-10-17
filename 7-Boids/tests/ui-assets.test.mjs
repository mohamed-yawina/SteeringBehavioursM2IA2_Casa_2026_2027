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
