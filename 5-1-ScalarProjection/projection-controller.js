(function (root, factory) {
  const math = typeof module === 'object' && module.exports ? require('./projection.js') : root.ProjectionMath;
  const api = factory(math);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.ProjectionController = api;
})(globalThis, function (math) {
  'use strict';
  const scenarios = {
    oblique: { O: { x: 220, y: 380 }, P: { x: 610, y: 130 }, B: { x: 720, y: 260 } },
    parallel: { O: { x: 180, y: 350 }, P: { x: 480, y: 350 }, B: { x: 780, y: 350 } },
    perpendicular: { O: { x: 380, y: 400 }, P: { x: 380, y: 140 }, B: { x: 800, y: 400 } },
    negative: { O: { x: 470, y: 390 }, P: { x: 220, y: 140 }, B: { x: 820, y: 390 } },
    beyond: { O: { x: 160, y: 400 }, P: { x: 800, y: 150 }, B: { x: 520, y: 400 } },
    zero: { O: { x: 450, y: 370 }, P: { x: 660, y: 160 }, B: { x: 450, y: 370 } }
  };
  function create(onChange = () => {}) {
    let points, selected = 'P', step = 6, guided = false, scenario = 'oblique', lastAngle = 0;
    const options = { vectors: true, perpendicular: true, annotations: true };
    let snapshot;
    function commit() {
      const result = math.project(points.O, points.P, points.B);
      if (result.valid) lastAngle = Math.atan2(result.b.y, result.b.x) * 180 / Math.PI;
      snapshot = Object.freeze({ result, selected, step: guided ? step : 6, guided,
        scenario, angle: lastAngle, options: Object.freeze({ ...options }) });
      onChange(snapshot);
      return snapshot;
    }
    function load(name = 'oblique') {
      if (!scenarios[name]) return snapshot;
      points = Object.fromEntries(Object.entries(scenarios[name]).map(([key, p]) => [key, { ...p }]));
      scenario = name; lastAngle = 0; return commit();
    }
    function move(name, x, y) {
      if (!['O', 'P', 'B'].includes(name) || !Number.isFinite(x) || !Number.isFinite(y)) return snapshot;
      points[name] = { x: Math.min(960, Math.max(40, x)), y: Math.min(600, Math.max(40, y)) };
      scenario = 'custom'; return commit();
    }
    function direction(angle, length) {
      if (!Number.isFinite(angle) || !Number.isFinite(length) || length < 0) return snapshot;
      lastAngle = angle;
      const radians = angle * Math.PI / 180;
      const dx = Math.cos(radians), dy = Math.sin(radians);
      const reachX = Math.abs(dx) < 1e-14 ? Infinity : (dx > 0 ? 960 - points.O.x : 40 - points.O.x) / dx;
      const reachY = Math.abs(dy) < 1e-14 ? Infinity : (dy > 0 ? 600 - points.O.y : 40 - points.O.y) / dy;
      const boundedLength = Math.min(length, reachX, reachY);
      points.B = { x: points.O.x + boundedLength * dx, y: points.O.y + boundedLength * dy };
      scenario = 'custom'; return commit();
    }
    function select(name) { if (['O', 'P', 'B'].includes(name)) selected = name; return commit(); }
    function guide(enabled) { guided = !!enabled; if (guided) step = 1; return commit(); }
    function advance(value) { if (!Number.isFinite(value)) return snapshot; step = Math.max(1, Math.min(6, Math.round(value))); return commit(); }
    function option(key, enabled) { if (key in options) options[key] = !!enabled; return commit(); }
    function reset() {
      selected = 'P'; step = 6; guided = false;
      Object.keys(options).forEach(key => { options[key] = true; });
      return load('oblique');
    }
    load();
    return { load, move, direction, select, guide, advance, option, reset, get snapshot() { return snapshot; } };
  }
  return { create, scenarios: Object.keys(scenarios) };
});
