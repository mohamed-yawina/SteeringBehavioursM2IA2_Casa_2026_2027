import { Simulation } from './simulation/Simulation.js';
import { FixedStepClock } from './simulation/FixedStepClock.js';
import { KeyboardController } from './controls/KeyboardController.js';
import { Renderer } from './view/Renderer.js';
import { NeuralPanel } from './view/NeuralPanel.js';
import { TrainingPanel } from './view/TrainingPanel.js';
import { ExperimentPanel } from './view/ExperimentPanel.js';
import {TrackPanel} from './view/TrackPanel.js';import {TransferPanel} from './view/TransferPanel.js';
import {GeneralizationPanel} from './view/GeneralizationPanel.js';
import {GamePanel} from './view/GamePanel.js';
import {ApplicationUI} from './view/ApplicationUI.js';

const simulation = new Simulation();
const keyboard = new KeyboardController();
const renderer = new Renderer(document.querySelector('#simulation-canvas') ?? document.querySelector('canvas'));
const clock = new FixedStepClock();
const neuralPanel = new NeuralPanel(simulation, keyboard, clock);
const training = new TrainingPanel(simulation, keyboard, clock);
const tracks=new TrackPanel(simulation,training,keyboard,clock);
const transfer=new TransferPanel(simulation,training,keyboard,clock);
document.querySelector('#track-select')?.addEventListener('change',()=>{transfer.session=null;transfer.paused=true;});
new ExperimentPanel();
new GeneralizationPanel();
const gameplay=new GamePanel(keyboard,clock,{onModeChange:()=>{training.engine?.pause();transfer.paused=true;simulation.paused=true;}});
neuralPanel.previewSimulation = () => training.isSelected ? training.engine?.leader?.simulation ?? simulation : transfer.isSelected?transfer.session?.simulation??simulation:simulation;
const hud = document.querySelector('#hud');
const eventText = document.querySelector('#event');
const pauseButton = document.querySelector('#pause');
const sensors = document.querySelector('#sensors');
let last = performance.now(), fps = 0;
const interfaceUI=new ApplicationUI({gameplay,simulation,training,transfer,renderer,neuralPanel,tracks,pause:()=>setPaused(true)});

function setPaused(paused) {
  if(gameplay.isSelected)gameplay.setPaused(paused);
  simulation.paused = paused; clock.reset(); keyboard.clear();
  if (training.isSelected) training.setPaused(paused);
  if(transfer.isSelected)transfer.paused=paused;
  pauseButton.textContent = paused ? 'Reprendre' : 'Pause';
  pauseButton.setAttribute('aria-pressed', String(paused));
}
pauseButton.addEventListener('click', () => { setPaused(training.isSelected ? !training.paused : transfer.isSelected?!transfer.paused:!simulation.paused); pauseButton.blur(); });
document.querySelector('#reset').addEventListener('click', event => {
  if (training.isSelected) training.reset();
  else if(transfer.isSelected)transfer.reset();
  else { simulation.reset(); setPaused(false); }
  event.currentTarget.blur();
});
document.addEventListener('visibilitychange', () => { if (document.hidden) setPaused(true); });
window.addEventListener('blur', () => setPaused(true));

function frame(now) {
  const elapsed = Math.max(0, (now - last) / 1000); last = now;
  fps = elapsed > 0 ? fps * .9 + Math.min(1000, 1 / elapsed) * .1 : fps;
  interfaceUI.frame(now);
  if(interfaceUI.scienceActive){requestAnimationFrame(frame);return;}
  if(gameplay.isSelected){
    if(!gameplay.paused)clock.advance(elapsed,dt=>gameplay.step(dt,keyboard.read()));
    gameplay.render(fps);requestAnimationFrame(frame);return;
  }
  const paused = training.isSelected ? training.paused : transfer.isSelected?transfer.paused:simulation.paused;
  if (!paused) clock.advance(elapsed, dt => training.isSelected ? training.step(dt) : transfer.isSelected?transfer.step(dt):simulation.step(dt, keyboard.read()));
  const shown = training.isSelected ? training.engine?.leader?.simulation ?? simulation : transfer.isSelected?transfer.session?.simulation??simulation:simulation;
  renderer.draw(shown, sensors.checked, training.isSelected ? training.engine?.population.individuals.map(i=>i.simulation.car) ?? [] : []);
  const cp = shown.checkpoints;
  const state = shown.car.crashed ? 'Accidentée — réinitialiser' : paused ? 'En pause' : !shown.car.active ? 'Évaluation terminée' : 'Active';
  hud.textContent = `Vitesse : ${shown.car.speed.toFixed(1)} px/s · Prochain checkpoint : ${cp.nextIndex === 0 ? 'Arrivée' : cp.nextIndex} / ${cp.checkpoints.length - 1} · Tours : ${cp.laps} · État : ${state} · FPS : ${fps.toFixed(0)} · Distance : ${shown.car.distanceTravelled.toFixed(0)} px · Mode : ${training.isSelected ? 'Entraînement IA' : transfer.isSelected ? 'Transfert direct' : simulation.mode === 'manual' ? 'Manuel' : 'Autonome'}`;
  pauseButton.textContent = paused ? 'Reprendre' : 'Pause';
  pauseButton.setAttribute('aria-pressed', String(paused));
  training.render();tracks.render();transfer.render();
  neuralPanel.render();
  eventText.textContent = cp.lastEvent;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
