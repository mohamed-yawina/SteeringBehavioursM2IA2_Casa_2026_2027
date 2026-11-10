export class NotificationCenter {
  constructor(root = document) {
    this.items = [];
    this.nextId = 1;
    this.slots = [0, 1, 2].map(index => ({
      container: root.getElementById(`notice-${index}`), text: root.getElementById(`notice-${index}-text`),
      close: root.getElementById(`notice-${index}-close`),
    }));
    this.abortController = new AbortController();
    for (const slot of this.slots) slot.close.addEventListener('click', () => {
      this.items = this.items.filter(item => item.id !== slot.itemId);
      this.render();
    }, { signal: this.abortController.signal });
    this.render();
  }

  push(message, { tone = 'info', key = message, duration = 4 } = {}) {
    if (!message || !['info', 'success', 'error'].includes(tone) || !Number.isFinite(duration) || duration <= 0) {
      throw new RangeError('Notification invalide.');
    }
    const existing = this.items.find(item => item.key === key);
    if (existing) { existing.remaining = duration; return; }
    this.items.push({ id: this.nextId++, key, message, tone, remaining: duration });
    if (this.items.length > 3) this.items.shift();
    this.render();
  }

  advance(seconds) {
    if (!Number.isFinite(seconds) || seconds <= 0) return;
    for (const item of this.items) item.remaining -= seconds;
    this.items = this.items.filter(item => item.remaining > 0);
    this.render();
  }

  render() {
    for (let index = 0; index < this.slots.length; index++) {
      const slot = this.slots[index], item = this.items[index];
      slot.container.hidden = !item;
      if (!item) continue;
      slot.itemId = item.id;
      slot.container.dataset.tone = item.tone;
      const prefix = item.tone === 'success' ? 'Réussite' : item.tone === 'error' ? 'Attention' : 'Information';
      const text = `${prefix} — ${item.message}`;
      if (slot.text.textContent !== text) slot.text.textContent = text;
    }
  }

  dispose() { this.abortController.abort(); }
}
