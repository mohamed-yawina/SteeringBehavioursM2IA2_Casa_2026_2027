export class EcosystemPoints {
  constructor({ initial = 60, maximum = 100, regeneration = 0.35 } = {}) {
    if (![initial, maximum, regeneration].every(Number.isFinite)
      || maximum <= 0 || initial < 0 || initial > maximum || regeneration < 0) throw new RangeError('Budget invalide.');
    this.available = initial;
    this.maximum = maximum;
    this.regeneration = regeneration;
    this.spent = 0;
  }

  canAfford(cost) { return Number.isFinite(cost) && cost >= 0 && this.available + 1e-9 >= cost; }

  spend(cost) {
    if (!Number.isFinite(cost) || cost < 0) throw new RangeError('Coût invalide.');
    if (!this.canAfford(cost)) return false;
    this.available = Math.max(0, this.available - cost);
    this.spent += cost;
    return true;
  }

  tick(dt) {
    if (!Number.isFinite(dt) || dt < 0) throw new RangeError('Durée invalide.');
    this.available = Math.min(this.maximum, this.available + dt * this.regeneration);
  }
}
