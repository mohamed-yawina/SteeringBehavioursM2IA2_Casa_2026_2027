// =====================================================================
// BehaviorManager — associé à chaque Vehicle.
// API exigée par le cours (page 60) :
//   add, remove, activate, deactivate, changeWeight,
//   getBehavior, getSteeringForce
// =====================================================================

class BehaviorManager {
  constructor(owner) {
    this.owner = owner;
    // behaviors : Map<name, { fn, weight, active }>
    this.behaviors = new Map();
  }

  // Ajoute un comportement nommé. fn(context) → force vectorielle
  add(name, fn, weight = 1, active = true) {
    this.behaviors.set(name, { fn, weight, active });
    return this;
  }

  remove(name) { this.behaviors.delete(name); return this; }

  activate(name) {
    const b = this.behaviors.get(name); if (b) b.active = true; return this;
  }
  deactivate(name) {
    const b = this.behaviors.get(name); if (b) b.active = false; return this;
  }
  changeWeight(name, weight) {
    const b = this.behaviors.get(name); if (b) b.weight = weight; return this;
  }
  getBehavior(name) { return this.behaviors.get(name); }

  // Calcule la somme pondérée de tous les comportements actifs.
  // Le contexte contient : food, poison, predators, obstacles, neighbors, etc.
  getSteeringForce(context = {}) {
    const total = createVector(0, 0);
    for (const [name, b] of this.behaviors) {
      if (!b.active) continue;
      const f = b.fn(context);
      if (f) total.add(f.copy().mult(b.weight));
    }
    return total.limit(this.owner.maxForce * 3);
  }

  // Pour l'UI : liste des comportements nommés
  list() { return Array.from(this.behaviors.keys()); }
}