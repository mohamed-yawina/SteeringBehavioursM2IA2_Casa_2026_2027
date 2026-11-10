export class Random {
  constructor(seed = 2026) {
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be uint32');
    this.state = seed;
  }
  next() {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(this.state ^ this.state >>> 15, 1 | this.state);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  }
  uint32() { return Math.floor(this.next() * 4294967296); }
  normal() {
    const u = Math.max(Number.EPSILON, this.next());
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * this.next());
  }
}
