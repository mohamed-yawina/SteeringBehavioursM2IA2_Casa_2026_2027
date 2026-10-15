// Test-only subset of p5.Vector used by the Node VM tests.
// It validates vector-based steering mechanics, not the actual p5 browser runtime.
export class TestP5Vector {
  constructor(x = 0, y = 0, z = 0) {
    this.x = x;
    this.y = y;
    this.z = z;
  }

  set(x, y, z = this.z) {
    if (typeof x === 'object' && x !== null) {
      this.x = x.x || 0;
      this.y = x.y || 0;
      this.z = x.z || 0;
    } else {
      this.x = x;
      this.y = y;
      this.z = z;
    }
    return this;
  }

  copy() { return new TestP5Vector(this.x, this.y, this.z); }
  add(x, y, z = 0) {
    if (typeof x === 'object') return this.set(this.x + x.x, this.y + x.y, this.z + (x.z || 0));
    this.x += x; this.y += y; this.z += z; return this;
  }
  sub(x, y, z = 0) {
    if (typeof x === 'object') return this.set(this.x - x.x, this.y - x.y, this.z - (x.z || 0));
    this.x -= x; this.y -= y; this.z -= z; return this;
  }
  mult(scalar) { this.x *= scalar; this.y *= scalar; this.z *= scalar; return this; }
  magSq() { return this.x * this.x + this.y * this.y + this.z * this.z; }
  mag() { return Math.sqrt(this.magSq()); }
  normalize() {
    const magnitude = this.mag();
    if (magnitude > 0) this.mult(1 / magnitude);
    return this;
  }
  limit(maximum) {
    const magnitude = this.mag();
    if (magnitude > maximum && magnitude > 0) this.mult(maximum / magnitude);
    return this;
  }
  static dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y, (a.z || 0) - (b.z || 0)); }
}
