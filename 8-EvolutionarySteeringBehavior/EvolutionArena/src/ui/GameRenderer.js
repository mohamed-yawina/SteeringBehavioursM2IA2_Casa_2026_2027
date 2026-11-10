import { DEFAULT_DISPLAY_SETTINGS } from './DisplaySettings.js';

export class GameRenderer {
  constructor(sketch, settings = null) { this.p = sketch; this.settings = settings; }

  draw(manager) {
    if (!manager.world || !manager.actions) return;
    const p = this.p, world = manager.world, actions = manager.actions;
    const view = this.settings?.values ?? DEFAULT_DISPLAY_SETTINGS;
    p.push(); p.scale(p.width / world.width, p.height / world.height);
    if (actions.foodRateBonus() > 0) {
      p.noFill(); p.stroke('#80ecab'); p.strokeWeight(4); p.rect(6, 6, world.width - 12, world.height - 12, 10);
    }
    if (actions.zone && world.time < actions.zone.expiresAt) {
      p.fill(100, 210, 255, 20); p.stroke('#8ddaff'); p.strokeWeight(2);
      p.circle(actions.zone.pos.x, actions.zone.pos.y, actions.zone.radius * 2);
      if (view.quality !== 'economy') {
        p.noFill(); p.stroke(141, 218, 255, 120);
        p.circle(actions.zone.pos.x, actions.zone.pos.y, actions.zone.radius * 2 - 10);
      }
    }
    if (view.effects && actions.lastEffect && world.time < actions.lastEffect.until) {
      const effect = actions.lastEffect;
      p.noFill(); p.stroke(effect.kind === 'cleanse' ? '#cfabff' : '#80ecab'); p.strokeWeight(2);
      p.circle(effect.pos.x, effect.pos.y, effect.radius * 2);
    }
    p.pop();
  }
}
