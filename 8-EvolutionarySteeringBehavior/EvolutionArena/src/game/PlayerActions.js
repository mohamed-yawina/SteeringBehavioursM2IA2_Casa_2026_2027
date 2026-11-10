import { ProtectionZone } from '../entities/ProtectionZone.js';
import { seededRandom } from '../core/random.js';

export const ACTIONS = Object.freeze({
  food: Object.freeze({ label: 'Nourriture', cost: 12, cooldown: 6, duration: 0, amount: 10, radius: 45 }),
  cleanse: Object.freeze({ label: 'Retirer le poison', cost: 18, cooldown: 12, duration: 0, amount: 6, radius: 120 }),
  shelter: Object.freeze({ label: 'Zone de protection', cost: 28, cooldown: 25, duration: 8, radius: 95 }),
  abundance: Object.freeze({ label: 'Abondance', cost: 35, cooldown: 40, duration: 10, foodBonus: 6 }),
});

export class PlayerActions {
  constructor(world, points, definitions = ACTIONS) {
    this.world = world;
    this.points = points;
    this.definitions = definitions;
    this.readyAt = Object.fromEntries(Object.keys(definitions).map(key => [key, 0]));
    this.rng = seededRandom((world.seed ^ 0x27d4eb2d) >>> 0);
    this.enabled = true;
    this.zone = null;
    this.abundanceUntil = 0;
    this.lastEffect = null;
    this.used = 0;
  }

  cooldownRemaining(kind) { return Math.max(0, (this.readyAt[kind] ?? 0) - this.world.time); }

  availability(kind) {
    const action = Object.hasOwn(this.definitions, kind) ? this.definitions[kind] : null;
    if (!action) return 'Action inconnue.';
    if (!this.enabled || this.world.paused) return 'Mission inactive ou en pause.';
    if (this.cooldownRemaining(kind) > 1e-9) return 'Action en récupération.';
    if (!this.points.canAfford(action.cost)) return 'Points insuffisants.';
    if (kind === 'shelter' && this.zone && this.world.time < this.zone.expiresAt) return 'Une zone est déjà active.';
    return null;
  }

  isProtected(position, time = this.world.time) { return this.zone?.contains(position, time) ?? false; }
  foodRateBonus(time = this.world.time) { return time < this.abundanceUntil ? this.definitions.abundance.foodBonus : 0; }

  update() {
    if (this.zone && this.world.time >= this.zone.expiresAt) this.zone = null;
    if (this.lastEffect && this.world.time >= this.lastEffect.until) this.lastEffect = null;
  }

  perform(kind, x = this.world.width / 2, y = this.world.height / 2) {
    const blocked = this.availability(kind);
    if (blocked) return { ok: false, reason: blocked };
    if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0 || x > this.world.width || y > this.world.height) {
      return { ok: false, reason: 'Choisissez un point dans l’arène.' };
    }
    const action = this.definitions[kind];
    let affected = 0;
    if (kind === 'food') {
      const amount = Math.min(action.amount, this.world.settings.maxFood - this.world.food.length);
      if (amount <= 0) return { ok: false, reason: 'Réserve alimentaire au plafond.' };
      for (let i = 0; i < amount; i++) {
        const angle = this.rng() * Math.PI * 2, radius = Math.sqrt(this.rng()) * action.radius;
        if (this.world.addResource('food', Math.max(0, Math.min(this.world.width, x + Math.cos(angle) * radius)),
          Math.max(0, Math.min(this.world.height, y + Math.sin(angle) * radius)))) affected++;
      }
    } else if (kind === 'cleanse') {
      const candidates = this.world.poison.map(resource => ({ resource, distance: (resource.pos.x - x) ** 2 + (resource.pos.y - y) ** 2 }))
        .filter(item => item.distance < action.radius ** 2).sort((a, b) => a.distance - b.distance).slice(0, action.amount);
      if (!candidates.length) return { ok: false, reason: 'Aucun poison à portée.' };
      const removed = new Set(candidates.map(item => item.resource));
      this.world.poison = this.world.poison.filter(resource => !removed.has(resource));
      affected = removed.size;
    } else if (kind === 'shelter') {
      this.zone = new ProtectionZone(x, y, action.radius, this.world.time + action.duration);
    } else if (kind === 'abundance') {
      this.abundanceUntil = this.world.time + action.duration;
    }
    this.points.spend(action.cost);
    this.readyAt[kind] = this.world.time + action.cooldown;
    this.used++;
    this.world.interventions++;
    this.lastEffect = { kind, pos: createVector(x, y), radius: action.radius ?? 60, until: this.world.time + 1.2 };
    return { ok: true, affected, reason: `${action.label} : intervention appliquée (−${action.cost} points).` };
  }
}
