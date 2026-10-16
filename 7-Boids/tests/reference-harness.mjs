import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the actual Vector implementation bundled with the local p5 library.
export function loadTD7() {
  const scope = vm.createContext({console});
  const source = readFileSync(new URL('../libraries/p5.min.js', import.meta.url), 'utf8');
  const markers = [...source.matchAll(/(\d+):\[function\(e,t,r\)\{/g)];
  const anchor = source.indexOf('p5.Vector.prototype.mult:');
  const entry = markers.filter(match => match.index < anchor).at(-1);
  const next = markers.find(match => match.index > entry?.index);
  if (anchor < 0 || !entry || !next) throw Error('Unsupported local p5 bundle; cannot extract p5.Vector');

  const bundled = vm.runInContext(
    `(${source.slice(entry.index + entry[1].length + 1, next.index - 1)})`,
    scope
  );
  function P5() {}
  P5._friendlyError = () => {};
  bundled[0](name => {
    if (name.includes('core/main')) return {__esModule: true, default: P5};
    if (name.includes('constants')) return {TWO_PI: Math.PI * 2};
    if (name.startsWith('core-js/')) return {};
    throw Error(`Unexpected p5.Vector dependency: ${name}`);
  }, {exports: {}}, {});

  const randomEvents = [];
  let randomState = 0x12345678;
  const random = (min = 1, max) => {
    randomEvents.push([min, max]);
    randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
    const unit = randomState / 0x100000000;
    return max === undefined ? unit * min : Math.min(min, max) + unit * Math.abs(max - min);
  };
  P5.Vector.random2D = () => {
    const angle = random(Math.PI * 2);
    return new P5.Vector(Math.cos(angle), Math.sin(angle));
  };

  Object.assign(scope, {
    p5: P5,
    createVector: (x, y, z) => new P5.Vector(x, y, z),
    random,
    width: 1200,
    height: 800,
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    cos: Math.cos,
    sin: Math.sin,
    PI: Math.PI
  });
  for (const name of ['push', 'pop', 'fill', 'stroke', 'strokeWeight', 'noStroke', 'noFill',
    'translate', 'rotate', 'triangle', 'line', 'circle', 'ellipse', 'rect', 'image',
    'imageMode', 'point']) scope[name] = () => {};

  for (const filename of ['vehicle.js', 'boids.js', 'obstacle.js']) {
    vm.runInContext(readFileSync(new URL(`../${filename}`, import.meta.url), 'utf8'), scope, {filename});
  }
  return {
    scope,
    Vector: P5.Vector,
    Vehicle: vm.runInContext('Vehicle', scope),
    Boid: vm.runInContext('Boid', scope),
    Obstacle: vm.runInContext('Obstacle', scope),
    randomEvents
  };
}
