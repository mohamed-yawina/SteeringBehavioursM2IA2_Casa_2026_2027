import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation } from '../src/simulation/Simulation.js';
import { NeuralPanel } from '../src/view/NeuralPanel.js';
import { exportNetwork } from '../src/ai/NetworkSerialization.js';
import { NeuralNetwork } from '../src/ai/NeuralNetwork.js';

test('neural panel mode, seed loading, diagnostics, inspection and JSON controls are wired', () => {
  class Element {
    constructor() { this.handlers = new Map(); this.value = ''; this.checked = false; this.textContent = ''; }
    addEventListener(name, fn) { this.handlers.set(name, fn); }
    emit(name) { this.handlers.get(name)?.({ currentTarget: this }); }
    blur() {} focus() {} select() {}
  }
  let connections = 0, nodes = 0;
  const context = { stroke: () => connections++, arc: () => nodes++ };
  for (const method of ['setTransform','fillRect','beginPath','moveTo','lineTo','fill','fillText']) context[method] = () => {};
  const selectors = ['#drive-mode','#neural-inputs','#neural-outputs','#network-status','#network-seed',
    '#network-json','#network-parameters','#new-network','#export-network','#import-network'];
  const elements = new Map(selectors.map(id => [id, new Element()]));
  elements.set('#network-canvas', { clientWidth: 500, width: 0, height: 0, getContext: () => context });
  const root = { querySelector: selector => elements.get(selector) };
  const sim = new Simulation(); let clears = 0, resets = 0;
  const previousWindow = globalThis.window; globalThis.window = { devicePixelRatio: 1 };
  try {
    const panel = new NeuralPanel(sim, { clear: () => clears++ }, { reset: () => resets++ }, root);
    panel.render(); assert.equal(connections, 120); assert.equal(nodes, 22);
    assert.match(elements.get('#neural-inputs').textContent, /8. Vitesse/);
    assert.match(elements.get('#neural-outputs').textContent, /Aucune inférence/);
    elements.get('#drive-mode').value = 'autonomous'; elements.get('#drive-mode').emit('change');
    assert.equal(sim.mode, 'autonomous'); assert.equal(clears, 1); assert.equal(resets, 1);
    sim.step(.01); panel.render(); assert.match(elements.get('#neural-outputs').textContent, /Braquage demandé/);
    elements.get('#network-seed').value = '123'; elements.get('#new-network').emit('click');
    assert.equal(sim.neuralController.network.seed, 123);
    elements.get('#export-network').emit('click');
    const json = elements.get('#network-json').value; assert.equal(JSON.parse(json).version, 1);
    const net = sim.neuralController.network;
    elements.get('#network-json').value = 'invalid'; elements.get('#import-network').emit('click');
    assert.equal(sim.neuralController.network, net); assert.match(elements.get('#network-status').textContent, /Erreur/);
    elements.get('#network-json').value = json; elements.get('#import-network').emit('click');
    assert.notEqual(sim.neuralController.network, net); assert.equal(exportNetwork(sim.neuralController.network), json);
    elements.get('#network-parameters').checked = true; panel.render(); assert.equal(elements.get('#network-json').value, json);
    elements.get('#network-seed').value = '-1'; elements.get('#new-network').emit('click'); assert.match(elements.get('#network-status').textContent, /Erreur/);
    elements.get('#network-json').value = exportNetwork(new NeuralNetwork({ sizes: [7, 2] }));
    const old = sim.neuralController.network; elements.get('#import-network').emit('click');
    assert.equal(sim.neuralController.network, old); assert.match(elements.get('#network-status').textContent, /Erreur/);
  } finally { globalThis.window = previousWindow; }
});
