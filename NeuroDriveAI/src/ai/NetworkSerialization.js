import { NeuralNetwork } from './NeuralNetwork.js';
export const NETWORK_FORMAT = 'NeuroDriveAI.feedforward';
export const NETWORK_VERSION = 1;
export const MAX_JSON_LENGTH = 4_000_000;
export function exportNetwork(network) {
  if (!(network instanceof NeuralNetwork)) throw new TypeError('Expected NeuralNetwork');
  return JSON.stringify({ format: NETWORK_FORMAT, version: NETWORK_VERSION,
    sizes: network.sizes, seed: network.seed, activation: network.activation,
    outputActivation: network.outputActivation, parameters: network.parameters }, null, 2);
}
export function importNetwork(text) {
  if (typeof text !== 'string' || text.length > MAX_JSON_LENGTH) throw new RangeError('Invalid or oversized JSON');
  const data = JSON.parse(text);
  if (!data || data.format !== NETWORK_FORMAT || data.version !== NETWORK_VERSION) throw new RangeError('Unsupported network format/version');
  // Require every field: missing parameters must never silently randomize a network.
  for (const key of ['sizes', 'seed', 'activation', 'outputActivation', 'parameters']) {
    if (!Object.hasOwn(data, key) || data[key] == null) throw new TypeError(`Missing ${key}`);
  }
  return new NeuralNetwork(data);
}
