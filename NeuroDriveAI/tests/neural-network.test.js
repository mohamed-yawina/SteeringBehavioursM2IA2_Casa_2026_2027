import test from 'node:test';
import assert from 'node:assert/strict';
import { NeuralNetwork, MAX_PARAMETER } from '../src/ai/NeuralNetwork.js';
import { exportNetwork, importNetwork, MAX_JSON_LENGTH } from '../src/ai/NetworkSerialization.js';
const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-12, `${a} != ${b}`);

test('default 8→12→2 network has 134 parameters and correct diagnostic dimensions', () => {
  const net = new NeuralNetwork(), result = net.forward(Array(8).fill(.5));
  assert.deepEqual(net.sizes, [8, 12, 2]); assert.equal(net.parameterCount, 134);
  assert.deepEqual(result.activations.map(a => a.length), [8, 12, 2]);
  assert.equal(net.parameters[0].weights.length, 12); assert.equal(net.parameters[0].weights[0].length, 8);
  assert.equal(net.parameters[1].biases.length, 2);
});
test('known weights and biases produce the exact hand-calculated feedforward result', () => {
  const net = new NeuralNetwork({ sizes: [2, 2, 1], parameters: [
    { weights: [[1, 2], [-1, .5]], biases: [.1, -.2] },
    { weights: [[.3, -.4]], biases: [.7] }
  ] });
  const a = Math.tanh(.2 + 2 * .4 + .1), b = Math.tanh(-.2 + .5 * .4 - .2);
  const result = net.forward([.2, .4]);
  near(result.activations[1][0], a); near(result.activations[1][1], b);
  near(result.outputs[0], Math.tanh(.3 * a - .4 * b + .7));
});
test('configurable hidden layers and stable sigmoid/tanh avoid exponential overflow', () => {
  for (const outputActivation of ['tanh', 'sigmoid']) {
    const net = new NeuralNetwork({ sizes: [1, 1], outputActivation,
      parameters: [{ weights: [[MAX_PARAMETER]], biases: [MAX_PARAMETER] }] });
    for (const value of [-MAX_PARAMETER, MAX_PARAMETER]) {
      const out = net.forward([value]).outputs[0]; assert.ok(Number.isFinite(out)); assert.ok(out >= -1 && out <= 1);
      if (outputActivation === 'sigmoid') assert.ok(out >= 0);
    }
  }
  assert.deepEqual(new NeuralNetwork({ sizes: [3, 5, 4, 2] }).forward([0, .5, 1]).activations.map(a => a.length), [3, 5, 4, 2]);
});
test('same seed reproduces all weights, biases and outputs; different seeds differ', () => {
  for (const seed of [0, 42, 0xffffffff]) {
    const a = new NeuralNetwork({ seed }), b = new NeuralNetwork({ seed });
    assert.deepEqual(a.parameters, b.parameters); assert.deepEqual(a.forward(Array(8).fill(.25)), b.forward(Array(8).fill(.25)));
  }
  assert.notDeepEqual(new NeuralNetwork({ seed: 1 }).parameters, new NeuralNetwork({ seed: 2 }).parameters);
  assert.ok(new NeuralNetwork().parameters[0].biases.some(b => b !== 0));
});
test('parameters are defensively copied and immutable; forward results cannot alter the network', () => {
  const parameters = [{ weights: [[1]], biases: [.5] }];
  const net = new NeuralNetwork({ sizes: [1, 1], parameters });
  parameters[0].weights[0][0] = 100;
  near(net.forward([0]).outputs[0], Math.tanh(.5));
  assert.throws(() => { net.parameters[0].weights[0][0] = 3; });
  const result = net.forward([1]); result.outputs[0] = 99; result.activations[0][0] = 99;
  near(net.forward([1]).outputs[0], Math.tanh(1.5));
});
test('invalid dimensions, seeds, activations, sparse arrays and weights are rejected', () => {
  for (const sizes of [[], [1], [0, 2], [129, 2], [1.5, 2], Array(3), [128,128,128,128,128,128,128,128]]) assert.throws(() => new NeuralNetwork({ sizes }));
  for (const seed of [NaN, Infinity, -1, .1, '42', 2 ** 32]) assert.throws(() => new NeuralNetwork({ seed }));
  assert.throws(() => new NeuralNetwork({ activation: 'relu' }));
  for (const weight of [NaN, Infinity, -Infinity, '1', MAX_PARAMETER + 1]) {
    assert.throws(() => new NeuralNetwork({ sizes: [1,1], parameters: [{ weights: [[weight]], biases: [0] }] }));
  }
  assert.throws(() => new NeuralNetwork({ sizes: [1,1], parameters: [{ weights: Array(1), biases: [0] }] }));
  assert.throws(() => new NeuralNetwork({ sizes: [1,1], parameters: [{ weights: [[1,2]], biases: [0] }] }));
});
test('forward rejects wrong dimensions/nonfinite/sparse input instead of returning NaN', () => {
  const net = new NeuralNetwork();
  for (const inputs of [[], [1], Array(8), [...Array(7).fill(0), NaN], [...Array(7).fill(0), Infinity]]) assert.throws(() => net.forward(inputs));
});
test('versioned JSON preserves every parameter and reproduces exact outputs', () => {
  const original = new NeuralNetwork({ seed: 1234 }), json = exportNetwork(original), copy = importNetwork(json);
  assert.deepEqual(copy.parameters, original.parameters); assert.deepEqual(copy.sizes, original.sizes);
  for (const inputs of [Array(8).fill(0), Array(8).fill(1), [.1,.2,.3,.4,.5,.6,.7,.8]]) assert.deepEqual(copy.forward(inputs), original.forward(inputs));
  assert.equal(exportNetwork(copy), json);
});
test('import rejects malformed/versionless/oversized/nonfinite/dimensionally invalid payloads', () => {
  for (const text of ['oops', 'null', '{}', '[]', ' '.repeat(MAX_JSON_LENGTH + 1)]) assert.throws(() => importNetwork(text));
  const good = JSON.parse(exportNetwork(new NeuralNetwork()));
  const changed = edit => { const d = structuredClone(good); edit(d); assert.throws(() => importNetwork(JSON.stringify(d))); };
  changed(d => { d.version = 2; }); changed(d => { d.format = 'other'; });
  for (const field of ['sizes','seed','activation','outputActivation','parameters']) changed(d => { delete d[field]; });
  changed(d => { d.parameters[0].weights[0].pop(); });
  changed(d => { d.parameters[0].biases[0] = null; });
  changed(d => { d.parameters[1].weights[0][0] = 'NaN'; });
  assert.throws(() => importNetwork(exportNetwork(new NeuralNetwork()).replace(/"seed": \d+/, '"seed": 1e999')));
});
test('2,000 deterministic predictions with mixed normalized inputs stay finite and bounded', () => {
  const net = new NeuralNetwork({ seed: 128 });
  for (let i = 0; i < 2000; i++) {
    const inputs = Array.from({ length: 8 }, (_, k) => (Math.sin(i * (k + 1)) + 1) / 2);
    for (const n of net.forward(inputs).activations.flat()) assert.ok(Number.isFinite(n) && n >= -1 && n <= 1);
  }
});

test('near-maximum supported networks remain exportable and reimportable', () => {
  const net = new NeuralNetwork({ sizes: [128,128,128,128,120] });
  const text = exportNetwork(net);
  assert.ok(text.length <= MAX_JSON_LENGTH);
  const restored = importNetwork(text);
  assert.equal(restored.parameterCount, 65016);
  assert.deepEqual(restored.forward(Array(128).fill(.2)).outputs, net.forward(Array(128).fill(.2)).outputs);
});
