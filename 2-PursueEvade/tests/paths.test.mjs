import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function localReferences(file, source, pattern) {
  return [...source.matchAll(pattern)].map(match => [file, match[1]])
    .filter(([, ref]) => !/^(https?:|data:|#|mailto:)/.test(ref));
}

test('all local page and stylesheet references resolve inside the TD2 folder', () => {
  const refs = [];
  for (const file of ['index.html', 'predator-prey.html', 'pursuit-lab.html']) {
    const source = readFileSync(path.join(root, file), 'utf8');
    refs.push(...localReferences(file, source, /(?:src|href)=["']([^"']+)["']/g));
  }
  for (const file of ['home.css', 'challenge.css', 'lab.css']) {
    const source = readFileSync(path.join(root, file), 'utf8');
    refs.push(...localReferences(file, source, /url\(["']?([^"')]+)["']?\)/g));
  }
  for (const [from, ref] of refs) {
    assert.ok(existsSync(path.resolve(root, path.dirname(from), ref)), `${from} references missing ${ref}`);
  }
  assert.ok(refs.length >= 25, 'Expected all app scripts/styles to be checked');
});

test('lab loads only its own controller and no game-specific UI or state scripts', () => {
  const html = readFileSync(path.join(root, 'pursuit-lab.html'), 'utf8');
  assert.match(html, /src="libraries\/p5\.min\.js"/);
  assert.match(html, /src="pursuit-lab\.js"/);
  assert.doesNotMatch(html, /src="(?:sketch|ui|storage|audio|achievement)\.js"/);
  assert.ok(html.indexOf('vehicle.js') < html.indexOf('target.js'));
  assert.ok(html.indexOf('target-selection.js') < html.indexOf('target.js'));
  assert.ok(html.indexOf('target.js') < html.indexOf('bouncingBall.js'));
  assert.ok(html.indexOf('lab-renderer.js') < html.indexOf('pursuit-lab.js'));
  for (const id of ['scenario-select', 'behavior-select', 'prediction-slider', 'speed-slider', 'force-slider', 'prey-speed-slider', 'prey-force-slider', 'vision-slider', 'sim-speed-slider', 'pause-button', 'resume-button', 'step-button', 'reset-button', 'export-button', 'simulation-canvas', 'distance-value']) {
    assert.ok(html.includes(`id="${id}"`), `Laboratory control/metric is absent: ${id}`);
  }
});

test('Challenge page preserves game modules and uses local p5 libraries', () => {
  const html = readFileSync(path.join(root, 'predator-prey.html'), 'utf8');
  for (const script of ['libraries/p5.min.js', 'libraries/p5.sound.min.js', 'vehicle.js', 'obstacle.js', 'target-selection.js', 'target.js', 'bouncingBall.js', 'achievement.js', 'audio.js', 'combo.js', 'particle.js', 'powerup.js', 'storage.js', 'ui.js', 'sketch.js']) {
    assert.ok(html.includes(`src="${script}"`), `Missing game dependency ${script}`);
  }
  assert.ok(html.indexOf('vehicle.js') < html.indexOf('obstacle.js'));
  assert.ok(html.indexOf('obstacle.js') < html.indexOf('sketch.js'));
  assert.doesNotMatch(html, /cdnjs\.cloudflare/);
  for (const id of ['difficulty-select', 'hunter-count', 'prey-count', 'challenge-reset', 'challenge-fps', 'challenge-captures', 'challenge-time', 'challenge-distance', 'challenge-last-capture']) {
    assert.ok(html.includes(`id="${id}"`), `Challenge control is absent: ${id}`);
  }
});
