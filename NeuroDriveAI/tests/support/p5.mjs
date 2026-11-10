import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';

// Load the REAL p5.Vector module from the bundled p5 1.7.0 Browserify artifact.
// Only its core main/constants imports are substituted: no vector test double.
const source = readFileSync(new URL('../../vendor/p5.min.js', import.meta.url), 'utf8');
const start = source.indexOf('306:[function');
const end = source.indexOf('307:[function', start);
if (start < 0 || end < 0) throw new Error('Unsupported p5 bundle; update Vector module loader');
const chunk = source.slice(start, end);
const factory = runInThisContext(`(${chunk.slice(chunk.indexOf('function'), chunk.lastIndexOf('},{') + 1)})`);
const P5 = function () {};
P5._friendlyError = message => { throw new Error(message); };
const module = { exports: {} };
factory(name => {
  if (name === '../core/main') return P5;
  if (name === '../core/constants') return { TWO_PI: 2 * Math.PI };
  if (name.startsWith('core-js/')) return {}; // modern Node already provides these polyfills
  throw new Error(`Unexpected p5.Vector dependency: ${name}`);
}, module, module.exports);
globalThis.p5 = { Vector: module.exports.default };
