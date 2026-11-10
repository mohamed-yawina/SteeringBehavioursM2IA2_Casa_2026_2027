import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyboardController } from '../src/controls/KeyboardController.js';
class Target {
  constructor() { this.handlers = new Map(); }
  addEventListener(name, fn) { this.handlers.set(name, fn); }
  removeEventListener(name) { this.handlers.delete(name); }
  send(name, code, tagName = 'BODY') {
    let prevented = false;
    this.handlers.get(name)?.({ code, target: { tagName }, preventDefault: () => { prevented = true; } });
    return prevented;
  }
}
test('keyboard maps arrows, AZERTY/QWERTY, key release and opposite directions', () => {
  const target = new Target(), keyboard = new KeyboardController(target);
  assert.equal(target.send('keydown', 'ArrowUp'), true);
  target.send('keydown', 'ArrowLeft'); assert.deepEqual(keyboard.read(), { throttle: 1, brake: 0, steer: -1 });
  target.send('keydown', 'ArrowRight'); assert.equal(keyboard.read().steer, 0);
  target.send('keyup', 'ArrowUp'); target.send('keydown', 'KeyS'); assert.equal(keyboard.read().brake, 1);
  target.send('keydown', 'KeyZ'); assert.equal(keyboard.read().throttle, 1);
  target.send('blur'); assert.deepEqual(keyboard.read(), { throttle: 0, brake: 0, steer: 0 });
  keyboard.dispose(); assert.equal(target.handlers.size, 0);
});
test('keyboard does not hijack form controls or unrelated keys', () => {
  const target = new Target(), keyboard = new KeyboardController(target);
  assert.equal(target.send('keydown', 'ArrowUp', 'INPUT'), false); assert.equal(keyboard.read().throttle, 0);
  assert.equal(target.send('keydown', 'KeyP'), false); keyboard.dispose();
});
