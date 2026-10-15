import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

test('all studio pages resolve local styles, scripts and navigation destinations', async () => {
  for (const page of ['index.html', 'arrive-lab.html', 'arrive-challenge.html', 'text-studio.html']) {
    const html = await readFile(path.join(root, page), 'utf8');
    for (const [, reference] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (/^(?:https?:|mailto:|javascript:)/i.test(reference)) continue;
      await assert.doesNotReject(access(path.resolve(root, reference)), `${page} -> ${reference}`);
    }
  }
});

test('each application page exposes its canvas and loads shared application modules', async () => {
  for (const page of ['arrive-lab.html', 'arrive-challenge.html', 'text-studio.html']) {
    const html = await readFile(path.join(root, page), 'utf8');
    assert.match(html, /<canvas id="game"/);
    const vectorLibraryIndex = html.indexOf('src="libraries/p5.min.js"');
    const vehicleIndex = html.indexOf('src="js/vehicle.js"');
    assert.ok(vectorLibraryIndex >= 0 && vectorLibraryIndex < vehicleIndex, `${page} must load local p5 before Vehicle`);
    for (const script of ['js/vehicle.js', 'js/target.js', 'js/ui.js', 'js/game.js', 'js/main.js']) {
      assert.ok(html.includes(`src="${script}"`), `${page} must load ${script}`);
    }
  }
});
