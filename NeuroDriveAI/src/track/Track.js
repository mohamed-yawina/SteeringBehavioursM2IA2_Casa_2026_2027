import { vec, point, finite } from '../math/vector.js';

const closedSegments = points => points.map((a, i) => ({ a, b: points[(i + 1) % points.length] }));

// Geometry data only; no drawing or movement. Visible objects belong to Renderer.
export class Track {
  constructor({ id, inner, outer, checkpoints, start }) {
    if (!id || inner.length < 3 || outer.length < 3 || checkpoints.length < 2) throw new RangeError('Invalid track');
    this.id = id;
    this.inner = inner.map(point);
    this.outer = outer.map(point);
    for (const polygon of [this.inner, this.outer]) {
      for (let i = 0; i < polygon.length; i++) {
        if (polygon[i].dist(polygon[(i + 1) % polygon.length]) < 1e-8) throw new RangeError('Degenerate wall');
      }
    }
    this.walls = [...closedSegments(this.inner), ...closedSegments(this.outer)];
    this.checkpoints = checkpoints.map(cp => {
      const a = point(cp.a), b = point(cp.b), normal = point(cp.normal);
      if (a.dist(b) < 1e-8 || normal.mag() < 1e-8) throw new RangeError('Degenerate checkpoint');
      normal.normalize();
      if (Math.abs(normal.dot(b.copy().sub(a).normalize())) > 1e-6) throw new RangeError('Checkpoint normal must be perpendicular');
      return { a, b, normal };
    });
    this.finish = this.checkpoints[0];
    this.start = { position: point(start.position), orientation: finite(start.orientation, 'start orientation') };
    this.startZone = { position: this.start.position.copy(), radius: 24 };
  }
}

// Registry-ready factory: adding a track means providing another Track definition.
export function createOvalTrack({ id = 'oval', count = 96, gateCount = 12 } = {}) {
  if (!Number.isInteger(count) || count < 12 || !Number.isInteger(gateCount) || gateCount < 3 || count % gateCount !== 0) {
    throw new RangeError('Counts must divide evenly and define a closed track');
  }
  const sample = (theta, rx, ry) => vec(500 + rx * Math.cos(theta), 350 + ry * Math.sin(theta));
  const inner = [], outer = [];
  for (let i = 0; i < count; i++) {
    const theta = i * 2 * Math.PI / count;
    inner.push(sample(theta, 300, 170));
    outer.push(sample(theta, 420, 290));
  }
  const checkpoints = [];
  for (let i = 0; i < gateCount; i++) {
    const theta = i * 2 * Math.PI / gateCount;
    const a = sample(theta, 300, 170), b = sample(theta, 420, 290);
    const edge = b.copy().sub(a);
    checkpoints.push({ a, b, normal: vec(-edge.y, edge.x).normalize() });
  }
  const theta = 0.10; // just AFTER gate zero: must pass 1..N-1 then 0.
  return new Track({ id, inner, outer, checkpoints,
    start: { position: sample(theta, 360, 230), orientation: Math.atan2(230 * Math.cos(theta), -360 * Math.sin(theta)) } });
}

export const trackFactories = Object.freeze({ oval: createOvalTrack });
