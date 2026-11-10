import {TelemetryView,telemetrySnapshot} from './TelemetryView.js';
import {TutorialDialog} from './TutorialDialog.js';
import {NetworkView} from './NetworkView.js';
import {Renderer} from './Renderer.js';
import {Simulation} from '../simulation/Simulation.js';
import {TRACKS,createRegisteredTrack} from '../track/TrackRegistry.js';
import {MISSIONS} from '../game/MissionDefinitions.js';

const text=(node,value)=>{if(node&&node.textContent!==String(value))node.textContent=String(value);};
export class ApplicationUI{
  constructor({gameplay,simulation,training,transfer,renderer,neuralPanel,tracks,root=document,pause=()=>{}}){
    this.root=root;this.mounted=Boolean(root.querySelector('#interface-tools')&&root.body?.classList);this.scienceActive=false;if(!this.mounted)return;
    Object.assign(this,{gameplay,simulation,training,transfer,renderer,neuralPanel,tracks,pause});this.telemetry=new TelemetryView(root);this.lastUpdate=-Infinity;this.effects=true;this.trails=false;this.selectedIndex=0;
    this.dialog=new TutorialDialog(root.querySelector('#tutorial-dialog'),{root,onOpen:pause});
    root.querySelector('#tutorial-open').addEventListener('click',event=>this.dialog.open(event.currentTarget));
    this.presentationButton=root.querySelector('#presentation-toggle');this.presentationButton.addEventListener('click',()=>this.setPresentation(!this.presentation));
    root.querySelector('#visual-effects').addEventListener('change',event=>{this.effects=event.currentTarget.checked;root.body.classList.toggle('effects-off',!this.effects);this.applyVisualOptions();});
    root.querySelector('#trail-toggle').addEventListener('change',event=>{this.trails=event.currentTarget.checked;this.applyVisualOptions();});
    const prior=gameplay.onModeChange;gameplay.onModeChange=mode=>{prior(mode);this.showMode(mode);};
    root.querySelector('#home-lab').addEventListener('click',()=>gameplay.enter('lab'));
    for(const id of ['#go-science','#home-science'])root.querySelector(id).addEventListener('click',()=>{gameplay.enter('lab');this.showMode('science');});
    this.selection=root.querySelector('#selected-racer');this.selection.addEventListener('change',()=>{this.selectedIndex=Math.max(0,Math.min(1,Number(this.selection.value)||0));gameplay.view.selectedIndex=this.selectedIndex;this.lastUpdate=-Infinity;});
    this.gameNetwork=new NetworkView(root.querySelector('#game-network-canvas'));
    this.missionCards=new Map();const cards=root.querySelector('#mission-cards');
    for(const mission of MISSIONS){
      const card=root.createElement('button');card.type='button';card.className='mission-card';
      const label=root.createElement('strong'),description=root.createElement('span'),state=root.createElement('span');label.textContent=mission.name;description.textContent=mission.description;
      card.append(label,description,state);card.addEventListener('click',()=>{if(!gameplay.manager.progress.isAvailable(mission.id))return;gameplay.selectMission.value=mission.id;gameplay.renderMissionDescription();gameplay.selectMission.focus();});cards.append(card);this.missionCards.set(mission.id,{card,state});
    }
    const preview=root.querySelector('#hero-track');this.previewRenderer=new Renderer(preview);this.previewSimulation=new Simulation(createRegisteredTrack('oval'));
    this.showMode(gameplay.manager.mode);this.applyVisualOptions();
  }
  setPresentation(enabled){if(!this.mounted)return;this.presentation=Boolean(enabled);this.root.body.classList.toggle('presentation',this.presentation);this.presentationButton.setAttribute('aria-pressed',String(this.presentation));text(this.presentationButton,this.presentation?'Quitter Presentation Mode':'Presentation Mode');this.previewSize=null;}
  showMode(mode){
    this.scienceActive=mode==='science';const root=this.root;root.querySelector('#science-screen').hidden=!this.scienceActive;
    if(this.scienceActive){root.querySelector('#lab-screen').hidden=true;root.querySelector('#lab-controls').hidden=true;root.querySelector('#game-screen').hidden=true;}
    const labels={home:'Mission control',lab:'AI Laboratory',career:'Championship','human-ai':'Racing Arena / Human vs AI','ai-ai':'Racing Arena / AI vs AI',science:'Science Center'};
    text(root.querySelector('#workspace-title'),labels[mode]);
    const current={home:'#go-home',lab:'#go-lab',career:'#go-career','human-ai':'#go-human-ai','ai-ai':'#go-ai-ai',science:'#go-science'}[mode];
    for(const id of ['#go-home','#go-lab','#go-career','#go-human-ai','#go-ai-ai','#go-science']){const node=root.querySelector(id);if(id===current)node.setAttribute('aria-current','page');else node.removeAttribute('aria-current');}
    this.telemetry.render(null);this.lastUpdate=-Infinity;
  }
  applyVisualOptions(){
    if(this.lastEffects===this.effects&&this.lastTrails===this.trails)return;
    for(const view of [this.renderer,this.gameplay.view?.renderer,this.previewRenderer,this.tracks?.renderer])if(view){view.effectsEnabled=this.effects;if(this.lastTrails!==this.trails)view.trails=new WeakMap();view.trailsEnabled=view===this.previewRenderer||view===this.tracks?.renderer?false:this.trails;}
    if(this.neuralPanel.view)this.neuralPanel.view.effectsEnabled=this.effects;if(this.gameNetwork)this.gameNetwork.effectsEnabled=this.effects;
    this.lastEffects=this.effects;this.lastTrails=this.trails;this.previewSize=null;
  }
  frame(now=performance.now()){
    if(!this.mounted)return;
    const root=this.root,game=this.gameplay.manager,mode=game.mode;
    if(mode==='home'){
      const canvas=this.previewRenderer.canvas,size=canvas.clientWidth+':'+canvas.clientHeight;
      if(size!==this.previewSize){this.previewRenderer.draw(this.previewSimulation,false);this.previewSize=size;}
      text(root.querySelector('#home-tracks'),TRACKS.length);text(root.querySelector('#home-champions'),game.champions.list().length);text(root.querySelector('#home-completed'),`${game.progress.list().filter(m=>m.completed).length} / 5`);text(root.querySelector('#home-stars'),`${game.progress.stars} / 15`);
    }
    if(game.progress.data!==this.progressData){
      for(const row of game.progress.list()){const {card,state}=this.missionCards.get(row.id);card.disabled=!row.available;card.setAttribute('aria-disabled',String(!row.available));text(state,`${row.completed?'TERMINÉE':row.available?'DISPONIBLE':'VERROUILLÉE'} · ${Math.max(row.human.stars,row.ai.stars)} / 3 ★${['mountain-explorer','evolution-champion'].includes(row.id)?' · DÉFI AVANCÉ':''}`);}
      this.progressData=game.progress.data;
    }
    this.applyVisualOptions();
    if(this.scienceActive||mode==='home'){this.telemetry.render(null);return;}
    const race=this.gameplay.isSelected?game.race:null;
    if(this.gameplay.isSelected&&!race){this.telemetry.render(null);return;}
    if(race&&race!==this.lastRace){
      this.selection.replaceChildren();race.entrants.forEach((e,index)=>{const option=root.createElement('option');option.value=String(index);option.textContent=`${index+1} · ${e.name}`;this.selection.append(option);});this.selectedIndex=0;this.selection.value='0';this.gameplay.view.selectedIndex=0;this.lastRace=race;
    }
    if(now-this.lastUpdate<100)return;this.lastUpdate=now;
    const labMode=this.training.isSelected?(this.training.engine?.trainingTrackIds.length>1?'multi-training':'training'):this.transfer.isSelected?'transfer':this.simulation.mode;
    const sim=race?.entrants[this.selectedIndex]?.simulation??(this.training.isSelected?this.training.engine?.leader?.simulation:this.transfer.isSelected?this.transfer.session?.simulation:this.simulation);
    this.telemetry.render(sim?telemetrySnapshot({simulation:sim,mode:race?mode:labMode,engine:this.training.isSelected&&!race?this.training.engine:null,race,selectedIndex:this.selectedIndex}):null);
    if(race&&sim){
      const d=sim.neuralController.diagnostics;this.gameNetwork.draw(sim.neuralController.network,d,{now});
      const values=d?`Entrées : ${d.inputs.map(v=>v.toFixed(2)).join(' · ')}\nBraquage : ${d.outputs[0].toFixed(3)}\nPédale : ${d.outputs[1].toFixed(3)}`:'Pilotage humain : aucune inférence appliquée.\nLes capteurs et la vitesse sont mesurés par le moteur.';
      text(root.querySelector('#game-network-values'),values);
    }
  }
}
