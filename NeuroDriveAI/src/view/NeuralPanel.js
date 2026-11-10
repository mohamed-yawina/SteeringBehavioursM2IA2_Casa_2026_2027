import { NeuralNetwork } from '../ai/NeuralNetwork.js';
import { exportNetwork, importNetwork, MAX_JSON_LENGTH } from '../ai/NetworkSerialization.js';
import { INPUT_LABELS, encodeInputs } from '../ai/InputEncoder.js';
import { OUTPUT_LABELS } from '../ai/OutputDecoder.js';
import { NetworkView } from './NetworkView.js';

export class NeuralPanel {
  constructor(simulation, keyboard, clock, root = document) {
    this.simulation = simulation;
    this.root = root;
    this.mode = root.querySelector('#drive-mode');
    // Optional mounting keeps the original engine-only DOM contract supported.
    if (!this.mode) return;
    this.inputs = root.querySelector('#neural-inputs');
    this.outputs = root.querySelector('#neural-outputs');
    this.status = root.querySelector('#network-status');
    this.seed = root.querySelector('#network-seed');
    this.json = root.querySelector('#network-json');
    this.view = new NetworkView(root.querySelector('#network-canvas'));
    this.inspect = root.querySelector('#network-parameters');
    this.inspection = root.querySelector('#network-inspection');
    this.inspect.addEventListener('click', () => this.inspect.blur());
    this.mode.value = simulation.mode;
    this.mode.addEventListener('change', () => {
      if (!['training','multi-training','transfer'].includes(this.mode.value)) simulation.setMode(this.mode.value);
      keyboard.clear(); clock.reset(); this.mode.blur();
    });
    root.querySelector('#new-network').addEventListener('click', event => {
      this.perform(() => {
        const text = this.seed.value.trim();
        if (!/^\d+$/.test(text)) throw new Error('La graine doit être un entier uint32');
        simulation.setNetwork(new NeuralNetwork({ seed: Number(text) }));
        keyboard.clear(); clock.reset();
      }); event.currentTarget.blur();
    });
    root.querySelector('#export-network').addEventListener('click', () => this.perform(() => {
      this.json.value = exportNetwork(simulation.neuralController.network);
      this.json.focus(); this.json.select();
    }, 'JSON exporté dans le champ ci-dessous : copier pour le conserver.'));
    root.querySelector('#import-network').addEventListener('click', event => {
      this.perform(() => {
        const candidate = importNetwork(this.json.value);
        simulation.setNetwork(candidate); // validates driving compatibility before replacing
        this.seed.value = String(candidate.seed); keyboard.clear(); clock.reset();
      }, 'Réseau importé. Réinitialiser pour comparer depuis le départ.');
      event.currentTarget.blur();
    });
    this.json.maxLength = MAX_JSON_LENGTH;
  }
  perform(action, success = 'Réseau chargé. Réinitialiser pour comparer depuis le départ.') {
    try { action(); this.status.textContent = success; }
    catch (error) { this.status.textContent = `Erreur : ${error.message}`; }
  }
  render() {
    if (!this.mode) return;
    const sim = this.previewSimulation?.() ?? this.simulation, controller = sim.neuralController;
    const d = controller.diagnostics;
    const inputs = d?.inputs ?? encodeInputs(sim.car);
    const inputText = inputs.map((n, i) => `${i + 1}. ${INPUT_LABELS[i]} : ${n.toFixed(3)}`).join('\n');
    if(this.inputs.textContent!==inputText)this.inputs.textContent=inputText;
    const outputText = d
      ? d.outputs.map((n, i) => `${OUTPUT_LABELS[i]} : ${n.toFixed(3)}`).join('\n') + `\nBraquage demandé : ${d.commands.steer.toFixed(3)}\nAccélérateur : ${d.commands.throttle.toFixed(3)} · Frein : ${d.commands.brake.toFixed(3)}`
      : 'Aucune inférence — mode manuel ou réseau remplacé.';
    if(this.outputs.textContent!==outputText)this.outputs.textContent=outputText;
    const network = controller.network;
    for (const selector of ['#new-network','#export-network','#import-network','#network-seed']) {
      const control = this.root.querySelector(selector);
      if (control) control.disabled = ['training','multi-training','transfer'].includes(this.mode.value);
    }
    this.view.draw(network, d);
    if (this.inspect.checked && this.lastInspected !== network) {
      if (this.inspection) this.inspection.textContent = exportNetwork(network);
      else this.json.value = exportNetwork(network);
      this.lastInspected = network;
    }
    if (this.inspection) this.inspection.hidden = !this.inspect.checked;
    if (!this.inspect.checked) this.lastInspected = null;
  }
}
