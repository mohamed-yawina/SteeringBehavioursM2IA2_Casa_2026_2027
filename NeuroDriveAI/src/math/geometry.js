import { vec, point, positive, clamp } from './vector.js';
export const EPS = 1e-9;
export const cross = (a, b) => a.x * b.y - a.y * b.x;
export const sub = (a, b) => vec(a.x - b.x, a.y - b.y);
export const dot = (a, b) => a.x * b.x + a.y * b.y;
export const at = (a, b, t) => vec(a.x + (b.x - a.x) * t, a.y + (b.y - a.y) * t);

export function pointSegmentDistance(p, a, b) {
  p = point(p); a = point(a); b = point(b);
  const d = sub(b, a), lengthSq = dot(d, d);
  const t = lengthSq <= EPS * EPS ? 0 : clamp(dot(sub(p, a), d) / lengthSq, 0, 1);
  return Math.hypot(p.x - a.x - t * d.x, p.y - a.y - t * d.y);
}

// Returns distance along a normalized ray; null means no hit in range.
// Includes endpoints, origin contact, collinear overlap and point-walls.
export function raySegment(origin, direction, a, b, range) {
  origin = point(origin); direction = point(direction); a = point(a); b = point(b);
  positive(range, 'range');
  const length = Math.hypot(direction.x, direction.y);
  if (length <= EPS) throw new RangeError('Ray direction must be nonzero');
  const d = vec(direction.x / length, direction.y / length);
  const s = sub(b, a), q = sub(a, origin), den = cross(d, s);
  let distance;
  if (Math.abs(den) <= EPS * Math.max(1, Math.hypot(s.x, s.y))) {
    if (Math.abs(cross(q, d)) > EPS) return null;
    const t0 = dot(q, d), t1 = dot(sub(b, origin), d);
    if (Math.max(t0, t1) < -EPS) return null;
    distance = Math.max(0, Math.min(t0, t1));
  } else {
    distance = cross(q, s) / den;
    const u = cross(q, d) / den;
    if (distance < -EPS || u < -EPS || u > 1 + EPS) return null;
  }
  return distance <= range + EPS ? clamp(distance, 0, range) : null;
}

// First contact of a moving disk with a segment: strip + endpoint circles.
// This is a continuous capsule test, not endpoint collision sampling.
export function sweepDiskSegment(from, to, radius, a, b) {
  from = point(from); to = point(to); a = point(a); b = point(b);
  positive(radius, 'radius');
  if (pointSegmentDistance(from, a, b) <= radius + EPS) return 0;
  const v = sub(to, from), vv = dot(v, v);
  if (vv <= EPS * EPS) return null;
  const candidates = [];
  for (const endpoint of [a, b]) {
    const q = sub(from, endpoint), B = 2 * dot(q, v);
    const C = dot(q, q) - radius * radius;
    const disc = B * B - 4 * vv * C;
    if (disc >= -EPS) {
      const t = (-B - Math.sqrt(Math.max(0, disc))) / (2 * vv);
      if (t >= -EPS && t <= 1 + EPS) candidates.push(clamp(t, 0, 1));
    }
  }
  const edge = sub(b, a), length = Math.hypot(edge.x, edge.y);
  if (length > EPS) {
    const tangent = vec(edge.x / length, edge.y / length);
    const normal = vec(-tangent.y, tangent.x);
    const offset = dot(sub(from, a), normal), normalSpeed = dot(v, normal);
    if (Math.abs(normalSpeed) > EPS) {
      for (const sign of [-1, 1]) {
        const t = (sign * radius - offset) / normalSpeed;
        if (t >= -EPS && t <= 1 + EPS) {
          const p = at(from, to, clamp(t, 0, 1));
          const along = dot(sub(p, a), tangent);
          if (along >= -EPS && along <= length + EPS) candidates.push(clamp(t, 0, 1));
        }
      }
    }
  }
  return candidates.length ? Math.min(...candidates) : null;
}

export function firstCollision(from, to, radius, walls) {
  let first = null;
  for (const wall of walls) {
    const t = sweepDiskSegment(from, to, radius, wall.a, wall.b);
    if (t !== null && (first === null || t < first)) first = t;
  }
  return first;
}

// Directed crossing of a finite checkpoint. Arrival on the line counts;
// departure from the line does not, preventing a double validation.
export function checkpointCrossing(from, to, checkpoint) {
  from = point(from); to = point(to);
  const { a, b, normal } = checkpoint;
  const before = dot(sub(from, a), normal), after = dot(sub(to, a), normal);
  if (!(before < -EPS && after >= -EPS)) return null;
  const t = clamp(-before / (after - before), 0, 1);
  const p = at(from, to, t), edge = sub(b, a), lengthSq = dot(edge, edge);
  if (lengthSq <= EPS * EPS) return null;
  const u = dot(sub(p, a), edge) / lengthSq;
  return u >= -EPS && u <= 1 + EPS ? t : null;
}
