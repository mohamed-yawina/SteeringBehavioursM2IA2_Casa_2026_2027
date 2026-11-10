export const MAX_PARAMETER = 1e6;
export const ACTIVATIONS = Object.freeze({ tanh: Math.tanh,
  sigmoid: x => x >= 0 ? 1 / (1 + Math.exp(-x)) : Math.exp(x) / (1 + Math.exp(x)) });

function boundedNumber(value) {
  if (!Number.isFinite(value) || Math.abs(value) > MAX_PARAMETER) throw new TypeError('Expected a finite number within ±1e6');
  return value;
}
function validateSizes(sizes) {
  if (!Array.isArray(sizes) || sizes.length < 2 || sizes.length > 8 ||
      Array.from(sizes).some(n => !Number.isInteger(n) || n < 1 || n > 128)) throw new RangeError('Invalid network dimensions');
  const count = sizes.slice(1).reduce((sum, n, i) => sum + n * (sizes[i] + 1), 0);
  if (count > 65536) throw new RangeError('Too many network parameters');
}
function seededRandom(seed) {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let n = Math.imul(state ^ state >>> 15, 1 | state);
    n ^= n + Math.imul(n ^ n >>> 7, 61 | n);
    return ((n ^ n >>> 14) >>> 0) / 4294967296;
  };
}

export class NeuralNetwork {
  constructor({ sizes = [8, 12, 2], seed = 1, activation = 'tanh', outputActivation = 'tanh', parameters } = {}) {
    validateSizes(sizes);
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Seed must be uint32');
    if (!Object.hasOwn(ACTIVATIONS, activation) || !Object.hasOwn(ACTIVATIONS, outputActivation)) throw new RangeError('Unsupported activation');
    this.sizes = Object.freeze([...sizes]);
    this.seed = seed;
    this.activation = activation;
    this.outputActivation = outputActivation;
    const random = seededRandom(seed);
    if (parameters !== undefined && (!Array.isArray(parameters) || parameters.length !== sizes.length - 1)) throw new RangeError('Wrong layer count');
    this.parameters = Object.freeze(sizes.slice(1).map((outputs, layer) => {
      const inputs = sizes[layer], limit = Math.sqrt(6 / (inputs + outputs));
      const source = parameters === undefined ? {
        weights: Array.from({ length: outputs }, () => Array.from({ length: inputs }, () => (random() * 2 - 1) * limit)),
        biases: Array.from({ length: outputs }, () => (random() * 2 - 1) * limit)
      } : parameters[layer];
      if (!source || !Array.isArray(source.weights) || source.weights.length !== outputs ||
          !Array.isArray(source.biases) || source.biases.length !== outputs) throw new RangeError('Wrong parameter shape');
      const weights = Array.from(source.weights, row => {
        if (!Array.isArray(row) || row.length !== inputs) throw new RangeError('Wrong weight row size');
        return Object.freeze(Array.from(row, boundedNumber));
      });
      return Object.freeze({ weights: Object.freeze(weights), biases: Object.freeze(Array.from(source.biases, boundedNumber)) });
    }));
    Object.freeze(this);
  }

  get parameterCount() { return this.parameters.reduce((sum, l) => sum + l.biases.length + l.weights.reduce((n, row) => n + row.length, 0), 0); }

  forward(inputs) {
    if (!Array.isArray(inputs) || inputs.length !== this.sizes[0]) throw new RangeError('Wrong input dimension');
    const activations = [Array.from(inputs, boundedNumber)];
    for (let layer = 0; layer < this.parameters.length; layer++) {
      const { weights, biases } = this.parameters[layer], previous = activations.at(-1);
      const activate = ACTIVATIONS[layer === this.parameters.length - 1 ? this.outputActivation : this.activation];
      activations.push(weights.map((row, neuron) => {
        const sum = row.reduce((n, weight, i) => n + weight * previous[i], biases[neuron]);
        const value = activate(sum);
        if (!Number.isFinite(value)) throw new RangeError('Nonfinite activation');
        return value;
      }));
    }
    return { outputs: [...activations.at(-1)], activations };
  }
}
