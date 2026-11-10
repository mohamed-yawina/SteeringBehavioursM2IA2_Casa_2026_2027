export class KeyboardController {
  constructor(target = window) {
    this.keys = new Set();
    this.target = target;
    this.allowed = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyZ', 'KeyQ']);
    this.down = event => {
      if (['INPUT', 'BUTTON', 'TEXTAREA', 'SELECT'].includes(event.target?.tagName)) return;
      if (this.allowed.has(event.code)) { event.preventDefault(); this.keys.add(event.code); }
    };
    this.up = event => this.keys.delete(event.code);
    this.clear = () => this.keys.clear();
    target.addEventListener('keydown', this.down);
    target.addEventListener('keyup', this.up);
    target.addEventListener('blur', this.clear);
  }
  read() {
    const held = (...codes) => codes.some(code => this.keys.has(code)) ? 1 : 0;
    return {
      throttle: held('ArrowUp', 'KeyW', 'KeyZ'),
      brake: held('ArrowDown', 'KeyS'),
      steer: held('ArrowRight', 'KeyD') - held('ArrowLeft', 'KeyA', 'KeyQ')
    };
  }
  dispose() {
    this.target.removeEventListener('keydown', this.down);
    this.target.removeEventListener('keyup', this.up);
    this.target.removeEventListener('blur', this.clear);
    this.clear();
  }
}
