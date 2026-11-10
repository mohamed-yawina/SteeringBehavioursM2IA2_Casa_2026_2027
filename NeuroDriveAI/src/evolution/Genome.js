import { NeuralNetwork } from '../ai/NeuralNetwork.js';
export const GENE_COUNT = 134;
export const GENE_BOUND = 5;
export class Genome {
  constructor(values, seed = 1) {
    if (!Array.isArray(values) || values.length !== GENE_COUNT || Array.from(values).some(v => !Number.isFinite(v) || Math.abs(v) > GENE_BOUND)) {
      throw new RangeError('Genome requires 134 finite genes in [-5,5]');
    }
    if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) throw new RangeError('Invalid genome seed');
    this.values = Object.freeze([...values]); this.seed = seed; Object.freeze(this);
  }
  static fromNetwork(network) {
    if (!(network instanceof NeuralNetwork) || network.sizes.join(',') !== '8,12,2' || network.activation !== 'tanh' || network.outputActivation !== 'tanh') {
      throw new RangeError('Evolution requires 8→12→2 tanh networks');
    }
    return new Genome(network.parameters.flatMap(layer => [...layer.weights.flat(), ...layer.biases]), network.seed);
  }
  copy() { return new Genome(this.values, this.seed); }
  toNetwork() {
    let offset = 0;
    const parameters = [[8,12],[12,2]].map(([inputs,outputs]) => ({
      weights: Array.from({ length: outputs }, () => { const row = this.values.slice(offset, offset + inputs); offset += inputs; return row; }),
      biases: (() => { const biases = this.values.slice(offset, offset + outputs); offset += outputs; return biases; })()
    }));
    return new NeuralNetwork({ seed: this.seed, parameters });
  }
}
