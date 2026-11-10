import {createRegisteredTrack} from '../track/TrackRegistry.js';import {Simulation} from '../simulation/Simulation.js';import {Renderer} from './Renderer.js';
export class TrackPanel{
 constructor(simulation,training,keyboard,clock,root=document){
  this.simulation=simulation;this.select=root.querySelector('#track-select');if(!this.select)return;
  const info=root.querySelector('#track-info'),canvas=root.querySelector('#track-preview');this.renderer=canvas?new Renderer(canvas):null;
  const choose=()=>{const track=createRegisteredTrack(this.select.value);training.engine?.pause();simulation.track=track;simulation.setMode('manual');simulation.reset();root.querySelector('#drive-mode').value='manual';keyboard.clear();clock.reset();
   this.preview=new Simulation(track);info.textContent=`${track.metadata.name} · ${track.metadata.difficulty} · ${track.validation.length.toFixed(0)} px · Largeur min ${track.validation.minimumWidth.toFixed(1)} px · Géométrie validée ; validation humaine à effectuer.`;};
  this.select.addEventListener('change',choose);choose();
 }
 render(){
  if(!this.renderer||!this.preview)return;
  const canvas=this.renderer.canvas,key=`${canvas.clientWidth}:${canvas.clientHeight}:${window.devicePixelRatio||1}:${this.renderer.effectsEnabled}`;
  if(this.lastPreview===this.preview&&this.lastKey===key)return;
  this.renderer.draw(this.preview,false);this.lastPreview=this.preview;this.lastKey=key;
 }
}
