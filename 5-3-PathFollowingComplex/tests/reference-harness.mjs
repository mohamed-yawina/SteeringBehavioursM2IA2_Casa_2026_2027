import { readFileSync } from 'node:fs';
import vm from 'node:vm';

export class Vector {
  constructor(x = 0, y = 0) { this.set(x, y); }
  set(x, y) { this.x = x; this.y = y; return this; }
  copy() { return new Vector(this.x, this.y); }
  add(v, y) { this.x += typeof v === 'number' ? v : v.x; this.y += typeof v === 'number' ? y : v.y; return this; }
  sub(v) { this.x -= v.x; this.y -= v.y; return this; }
  mult(n) { this.x *= n; this.y *= n; return this; }
  div(n) { return this.mult(1 / n); }
  mag() { return Math.hypot(this.x, this.y); }
  normalize() { const magnitude = this.mag(); return magnitude ? this.div(magnitude) : this; }
  setMag(n) { return this.normalize().mult(n); }
  limit(n) { return this.mag() > n ? this.setMag(n) : this; }
  heading() { return Math.atan2(this.y, this.x); }
  dot(v) { return this.x * v.x + this.y * v.y; }
  static add(a, b) { return a.copy().add(b); }
  static sub(a, b) { return a.copy().sub(b); }
  static dist(a, b) { return Vector.sub(a, b).mag(); }
}

export function load(seed = 123456789) {
  let state = seed >>> 0, randomCalls = 0;
  const draws = [];
  const random = (a = 1, b) => {
    randomCalls++; state = (Math.imul(1664525, state) + 1013904223) >>> 0;
    const value = state / 4294967296;
    return b === undefined ? value * a : Math.min(a,b) + value * Math.abs(b-a);
  };
  const elements = new Map();
  const element = () => ({value:'',checked:false,textContent:'',disabled:false,events:{},
    addEventListener(type,fn){this.events[type]=fn;},replaceChildren(){this.children=[];},
    append(item){(this.children??=[]).push(item);}});

  for (const [id, value] of [['snake-follow', '2'], ['snake-separation', '1.2'],
    ['circuit-width', '20'], ['snake-spacing', '20'], ['snake-size', '22'],
    ['snake-follow-value', ''], ['snake-separation-value', ''],
    ['circuit-width-value', ''], ['snake-spacing-value', ''], ['snake-size-value', ''],
    ['snake-count', '']]) {
    elements.set(id, { value, events: {}, addEventListener(type, fn) { this.events[type] = fn; } });
  }
  const scope = vm.createContext({ p5: { Vector }, createVector: (x, y) => new Vector(x, y),
    PI: Math.PI, TWO_PI: Math.PI * 2, min: Math.min, max: Math.max, cos: Math.cos, sin: Math.sin,
    constrain: (v, a, b) => Math.max(a, Math.min(b, v)),
    random, randomSeed: value => {state=value>>>0;},
    frameRate(){},createCanvas:()=>({parent(){}}), background(){},
    push(){},pop(){},translate(){},rotate(){},strokeWeight(){},strokeJoin(){},
    beginShape(){},endShape(){},vertex(){},text(){},map:(v,a,b,c,d)=>c+(v-a)/(b-a)*(d-c),
    lerpColor:()=>[],ROUND:1,CLOSE:1,
    stroke() {}, fill() {}, noStroke() {}, noFill() {}, circle() {},
    line: (...args) => draws.push(['line', ...args]),
    ellipse: (...args) => draws.push(['ellipse', ...args]),
    color: (...args) => args, width: 1200, height: 800, mouseX: 500, mouseY: 300,
    document: { createElement:()=>element(), getElementById: id => {if(!elements.has(id))elements.set(id,element());return elements.get(id);}, activeElement: { matches: () => false } }
  });
  for (const file of ['vehicle.js', 'path.js', 'snakeSegment.js', 'snake.js', 'snakePathFollowing.js', 'lab-scenarios.js', 'lab-controller.js', 'lab-renderer.js', 'lab-ui.js', 'sketch.js']) {
    vm.runInContext(readFileSync(new URL(`../${file}`, import.meta.url), 'utf8'), scope);
  }
  return { scope, elements, draws, randomCalls: () => randomCalls, ...vm.runInContext('({Vehicle, Snake, SnakeSegment, SnakePathFollowing, Path, findProjection, LabController, LabRenderer, LabUI, scenarioPoints})', scope) };
}

export function makePath(env, points = [[0,0],[100,0]], radius = 20) {
  const path = new env.Path(); points.forEach(p => path.addPoint(...p)); path.radius = radius; return path;
}
// Read the exact calculation snapshot; no geometry is recomputed by tests.
export function inspectFollow(env, vehicle, path) {
  const force=vehicle.follow(path),d=vehicle.copyFollowDiagnostics();
  return {force,future:[d.future.x,d.future.y],normal:[d.normal.x,d.normal.y],target:[d.target.x,d.target.y]};
}
export function trajectory(kind, { inspectStep } = {}) {
  const env = load(246813579), path = makePath(env, [[0,0],[160,0],[160,140],[0,140]]);
  const snake = kind.startsWith('snake');
  const entity = snake ? new env.SnakePathFollowing(40,40,3) : new env.Vehicle(40,40,3,0.3);
  const agents = snake ? entity.anneaux : [entity], neighbor = new env.Vehicle(46,42,2,0.3);
  if (snake) {entity.followWeight=1; entity.separationWeight=kind.endsWith('separation')?1.2:0;}
  else {entity.followPathWeight=kind==='wander'?0:1; entity.separateWeight=kind.endsWith('separation')?1.2:0; entity.wanderWeight=kind==='wander'?1:0;}
  const frames=[];
  for(let step=0;step<5;step++){
    if(snake)entity.move(path,[neighbor]); else {entity.applyBehaviors([entity,neighbor],path);entity.update();}
    if(inspectStep) inspectStep(agents, step);
    frames.push(Array.from(agents,a=>[a.pos.x,a.pos.y,a.vel.x,a.vel.y,a.acc.x,a.acc.y]));
  }
  return frames;
}
