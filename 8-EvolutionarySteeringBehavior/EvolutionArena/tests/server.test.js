import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createArenaServer } from '../tools/serve.mjs';

test('serveur HTTP : page et tous les scripts/modules locaux accessibles avec MIME correct', async t => {
  const server = createArenaServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const base = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(base);
  assert.equal(response.status, 200); assert.match(response.headers.get('content-type'), /text\/html/);
  const html = await response.text(); assert.match(html, /EVOLUTION/);
  for (const match of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
    if (match[1].startsWith('data:')) continue;
    const asset = await fetch(`${base}/${match[1]}`);
    assert.equal(asset.status, 200, match[1]);
  }
  async function modules(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await modules(new URL(`${entry.name}/`, directory));
      else if (entry.name.endsWith('.js')) {
        const file = new URL(entry.name, directory);
        const relative = file.href.split('/EvolutionArena/')[1];
        const asset = await fetch(`${base}/${relative}`);
        assert.equal(asset.status, 200); assert.match(asset.headers.get('content-type'), /text\/javascript/);
        const source = await readFile(file, 'utf8');
        for (const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
          const imported = new URL(match[1], file).href.split('/EvolutionArena/')[1];
          assert.equal((await fetch(`${base}/${imported}`)).status, 200, imported);
        }
      }
    }
  }
  await modules(new URL('../src/', import.meta.url));
  assert.equal((await fetch(`${base}/missing.js`)).status, 404);
  assert.equal((await fetch(`${base}/..%2f..%2fvehicle.js`)).status, 403);
});

test('syntaxe JavaScript vérifiée pour tous les modules du projet', async () => {
  async function check(directory) {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      if (entry.isDirectory()) await check(new URL(`${entry.name}/`, directory));
      else if (/\.(js|mjs)$/.test(entry.name)) {
        const file = new URL(entry.name, directory);
        const result = spawnSync(process.execPath, ['--check', fileURLToPath(file)], { encoding: 'utf8' });
        assert.equal(result.status, 0, `${file}: ${result.stderr}`);
      }
    }
  }
  await check(new URL('../src/', import.meta.url));
  await check(new URL('../tools/', import.meta.url));
});
