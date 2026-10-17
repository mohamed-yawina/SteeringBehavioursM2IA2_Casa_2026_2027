import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Execute the actual Vector implementation bundled with the local p5 library.
export function loadTD7({mode, seed = 0x12345678, randomValues, includeSketch = false} = {}) {
  if (mode !== 'historical' && mode !== 'current') {
    throw new TypeError("loadTD7 requires mode: 'historical' or 'current'");
  }
  const warnings = [];
  const graphics = [];
  const scope = vm.createContext({console: {
    warn: (...args) => warnings.push(args.map(String).join(' ')),
    log: (...args) => warnings.push(args.map(String).join(' '))
  }});
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
  let randomState = seed >>> 0;
  let randomSequence = randomValues ? [...randomValues] : null;
  let randomIndex = 0;
  const random = (min = 1, max) => {
    randomEvents.push([min, max]);
    let unit;
    if (randomSequence) {
      if (randomIndex >= randomSequence.length) throw Error('Deterministic random sequence exhausted');
      unit = randomSequence[randomIndex++];
    } else {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      unit = randomState / 0x100000000;
    }
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
    windowWidth: 1200,
    windowHeight: 800,
    mouseX: 300,
    mouseY: 100,
    CENTER: 'center',
    dist: (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1),
    cos: Math.cos,
    sin: Math.sin,
    PI: Math.PI,
    createCanvas: () => ({width: 1200, height: 800}),
    soundFormats: () => {},
    loadImage: path => ({path, width: 120, height: 60}),
    loadSound: path => ({path, isPlaying: () => false, play: () => {}}),
    createSlider: (min, max, value, step) => {
      const slider = {min, max, step, currentValue: value, onInput: null,
        value() { return this.currentValue; },
        input(callback) { this.onInput = callback; },
        position() { return this; }};
      return slider;
    },
    createP: initial => ({textContent: initial, style() { return this; }, position() { return this; },
      html(value) { this.textContent = value; return this; }}),
    createSpan: initial => ({textContent: initial, style() { return this; }, position() { return this; },
      html(value) { this.textContent = value; return this; }})
  });
  for (const name of ['push', 'pop', 'fill', 'stroke', 'strokeWeight', 'noStroke', 'noFill',
    'translate', 'rotate', 'triangle', 'line', 'circle', 'ellipse', 'rect', 'image',
    'imageMode', 'point', 'background', 'noStroke'])
    scope[name] = (...args) => graphics.push({name, args});

  const boidSourcePath = mode === 'historical'
    ? new URL('./references/historical-boids.js', import.meta.url)
    : new URL('../boids.js', import.meta.url);
  const sketchSourcePath = mode === 'historical'
    ? new URL('./references/historical-sketch.js', import.meta.url)
    : new URL('../sketch.js', import.meta.url);
  vm.runInContext(readFileSync(new URL('../vehicle.js', import.meta.url), 'utf8'), scope,
    {filename: 'vehicle.js'});
  vm.runInContext(readFileSync(boidSourcePath, 'utf8'), scope,
    {filename: mode === 'historical' ? 'historical-boids.js' : 'boids.js'});
  vm.runInContext(readFileSync(new URL('../obstacle.js', import.meta.url), 'utf8'), scope,
    {filename: 'obstacle.js'});
  if (includeSketch) {
    vm.runInContext(readFileSync(sketchSourcePath, 'utf8'), scope,
      {filename: mode === 'historical' ? 'historical-sketch.js' : 'sketch.js'});
  }
  return {
    mode,
    boidSourcePath: boidSourcePath.href,
    sketchSourcePath: includeSketch ? sketchSourcePath.href : null,
    scope,
    Vector: P5.Vector,
    Vehicle: vm.runInContext('Vehicle', scope),
    Boid: vm.runInContext('Boid', scope),
    Obstacle: vm.runInContext('Obstacle', scope),
    randomEvents,
    warnings,
    graphics,
    setRandomSequence(values) {
      randomSequence = [...values];
      randomIndex = 0;
      randomEvents.length = 0;
    }
  };
}
