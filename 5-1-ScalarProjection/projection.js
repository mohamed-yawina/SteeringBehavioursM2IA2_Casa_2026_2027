// Pure 2D geometry. Original construction: Daniel Shiffman / The Coding Train.
// No DOM, p5 lifecycle or physical simulation is involved.
(function (root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProjectionMath = api;
})(globalThis, function () {
  'use strict';
  const point = v => ({ x: v.x, y: v.y });
  const finitePoint = v => v && Number.isFinite(v.x) && Number.isFinite(v.y);
  function freeze(value) {
    if (value && typeof value === 'object') {
      Object.values(value).forEach(freeze);
      Object.freeze(value);
    }
    return value;
  }
  function project(O, P, B) {
    const empty = { valid: false, status: 'invalid', O: null, P: null, B: null,
      a: null, b: null, u: null, length: null, dot: null, scalar: null,
      vector: null, H: null, residual: null, distance: null, t: null,
      clampedT: null, segmentPoint: null, segmentDistance: null };
    if (![O, P, B].every(finitePoint)) return freeze(empty);
    const a = { x: P.x - O.x, y: P.y - O.y };
    const b = { x: B.x - O.x, y: B.y - O.y };
    const length = Math.hypot(b.x, b.y);
    const result = { ...empty, O: point(O), P: point(P), B: point(B) };
    if (![a, b].every(finitePoint) || !Number.isFinite(length)) return freeze({ ...result, status: 'range' });
    Object.assign(result, { a, b, length });
    if (length === 0) {
      const distance = Math.hypot(a.x, a.y);
      return freeze({ ...result, status: 'degenerate', segmentPoint: point(O),
        segmentDistance: Number.isFinite(distance) ? distance : null });
    }
    // Same formula as the supplied sketch: normalize b, dot a with it, multiply.
    const u = { x: b.x / length, y: b.y / length };
    const scalar = a.x * u.x + a.y * u.y;
    const vector = { x: scalar * u.x, y: scalar * u.y };
    const H = { x: O.x + vector.x, y: O.y + vector.y };
    const residual = { x: P.x - H.x, y: P.y - H.y };
    const t = scalar / length; // Equivalent to (a dot b)/(b dot b), avoids squaring tiny b.
    const clampedT = Math.min(1, Math.max(0, t));
    const segmentPoint = clampedT === 0 ? point(O) : clampedT === 1 ? point(B) : {
      x: O.x + clampedT * b.x, y: O.y + clampedT * b.y
    };
    const distance = Math.hypot(residual.x, residual.y);
    const segmentDistance = Math.hypot(P.x - segmentPoint.x, P.y - segmentPoint.y);
    const dot = scalar * length;
    if (![u, vector, H, residual, segmentPoint].every(finitePoint) ||
      ![scalar, t, distance, segmentDistance, dot].every(Number.isFinite)) {
      return freeze({ ...result, status: 'range' });
    }
    return freeze({ ...result, valid: true, status: 'defined', u, scalar, vector,
      H, residual, distance, t, clampedT, segmentPoint, segmentDistance, dot });
  }
  return Object.freeze({ project });
});
