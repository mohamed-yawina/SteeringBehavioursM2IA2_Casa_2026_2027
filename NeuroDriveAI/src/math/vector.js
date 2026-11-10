// Browser: real p5.js, loaded before the entry module. Node tests load the same
// distribution's Vector module without starting the DOM-dependent p5 runtime.
export const Vector = globalThis.p5?.Vector;
if (!Vector) throw new Error('p5.Vector must be loaded before the simulation.');
export const vec = (x = 0, y = 0) => new Vector(finite(x, 'x'), finite(y, 'y'));
export const finite = (value, name = 'value') => {
  if (!Number.isFinite(value)) throw new TypeError(`${name} must be finite`);
  return value;
};
export function point(p) {
  if (!p) throw new TypeError('A point is required');
  return vec(finite(p.x, 'x'), finite(p.y, 'y'));
}
export function positive(value, name) {
  finite(value, name);
  if (value <= 0) throw new RangeError(`${name} must be positive`);
  return value;
}
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export const angleWrap = a => Math.atan2(Math.sin(a), Math.cos(a));
