import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {loadTD7} from './reference-harness.mjs';

const historicalURL = new URL('./references/historical-boids.js', import.meta.url);
const currentURL = new URL('../boids.js', import.meta.url);
const fixtureURL = new URL('./fixtures/historical-behaviors.json', import.meta.url);
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

test('historical and current loading modes are explicit and select their intended Boid source', () => {
  assert.throws(() => loadTD7(), /requires mode/);
  const historical = loadTD7({mode: 'historical'});
  const current = loadTD7({mode: 'current'});
  assert.equal(historical.mode, 'historical');
  assert.equal(historical.boidSourcePath, historicalURL.href);
  assert.equal(current.mode, 'current');
  assert.equal(current.boidSourcePath, currentURL.href);
  assert.notEqual(historical.Boid, current.Boid);
  assert.notEqual(historical.scope, current.scope);
  assert.notEqual(historical.Vector, current.Vector);
});

test('frozen historical Boid body matches the source recorded at the reference commit', () => {
  const source = readFileSync(historicalURL);
  const bodyOffset = source.indexOf(Buffer.from('// Flocking'));
  assert.ok(bodyOffset > 0, 'the test-only provenance banner precedes the original source');
  const banner = source.subarray(0, bodyOffset).toString('utf8');
  assert.match(banner, /HISTORICAL TEST REFERENCE ONLY/);
  assert.match(banner, /nonconforming pre-correction/);
  assert.match(banner, /3e371e7ed187fc66b5934badacdc6f09b9d6c72a/);
  assert.equal(
    sha256(source.subarray(bodyOffset)),
    '147ab119d3c8519d38b0a6d2cda55d7f9ad908b44728e94213c3d9a3e7af4028'
  );
});

test('application HTML never loads the test-only historical implementation', () => {
  const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
  assert.doesNotMatch(html, /historical-boids|tests\/references/);
});

test('historical sketch characterization loads its frozen pre-composition source', () => {
  const historical = loadTD7({mode: 'historical', includeSketch: true});
  const current = loadTD7({mode: 'current', includeSketch: true});
  assert.equal(historical.sketchSourcePath,
    new URL('./references/historical-sketch.js', import.meta.url).href);
  assert.equal(current.sketchSourcePath,
    new URL('../sketch.js', import.meta.url).href);
  const source = readFileSync(new URL('./references/historical-sketch.js', import.meta.url), 'utf8');
  assert.match(source, /HISTORICAL TEST REFERENCE ONLY/);
  assert.match(source, /56cb485dd7b9a2158ff460880e95c3923fdea644/);
});

test('historical fixtures remain byte-identical to the pre-isolation characterization', () => {
  assert.equal(
    sha256(readFileSync(fixtureURL)),
    '396c1a08cd293f7e3652859f15e2069eb712c6bf6e5178fc8f53e0215bcd17a5'
  );
});

test('VM classes, random streams and graphics captures do not leak between modes', () => {
  const historical = loadTD7({mode: 'historical'});
  const current = loadTD7({mode: 'current'});
  const historicalBoid = new historical.Boid(10, 20);
  const currentBoid = new current.Boid(10, 20);
  assert.notEqual(Object.getPrototypeOf(historicalBoid), Object.getPrototypeOf(currentBoid));

  historical.setRandomSequence([0.5]);
  current.setRandomSequence([0.25]);
  historical.Boid.debug = true;
  historicalBoid.wander();
  assert.ok(historical.graphics.length > 0);
  assert.equal(current.graphics.length, 0);
  assert.notEqual(historical.randomEvents, current.randomEvents);
  assert.notEqual(historical.warnings, current.warnings);
});
