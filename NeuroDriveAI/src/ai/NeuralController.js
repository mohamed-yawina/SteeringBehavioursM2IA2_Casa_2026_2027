import { NeuralNetwork } from './NeuralNetwork.js';
import { encodeInputs } from './InputEncoder.js';
import { decodeOutputs } from './OutputDecoder.js';

export class NeuralController {
  constructor(network = new NeuralNetwork()) { this.setNetwork(network); }
  setNetwork(network) {
    if (!(network instanceof NeuralNetwork) || network.sizes[0] !== 8 || network.sizes.at(-1) !== 2 || network.outputActivation !== 'tanh') {
      throw new RangeError('Driving requires 8 inputs, 2 outputs and tanh outputs');
    }
    this.network = network;
    this.diagnostics = null;
  }
  decide(car) {
    const inputs = encodeInputs(car);
    const result = this.network.forward(inputs);
    const commands = car.active && !car.crashed ? decodeOutputs(result.outputs) : { steer: 0, throttle: 0, brake: 0 };
    this.diagnostics = { inputs, outputs: result.outputs, activations: result.activations, commands, active: car.active && !car.crashed };
    return commands;
  }
}
