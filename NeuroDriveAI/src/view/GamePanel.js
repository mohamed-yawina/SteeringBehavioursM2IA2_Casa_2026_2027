import {GameManager} from '../game/GameManager.js';
import {MissionProgress} from '../game/MissionProgress.js';
import {MissionManager} from '../game/MissionManager.js';
import {MISSIONS,getMission} from '../game/MissionDefinitions.js';
import {BUILTIN_CHAMPIONS} from '../game/ChampionRegistry.js';
import {TRACKS} from '../track/TrackRegistry.js';
import {MAX_JSON_LENGTH} from '../ai/NetworkSerialization.js';
import {RaceView} from './RaceView.js';

const time=value=>value===null?'—':value.toFixed(2)+' s';
const competitor=row=>(row.id==='ai-a'?'IA A · ':row.id==='ai-b'?'IA B · ':'')+row.name;
function browserStorage(){try{return window.localStorage??null;}catch{return null;}}
export class GamePanel{
  constructor(keyboard,clock,{root=document,onModeChange=()=>{},load=path=>fetch(path),storage}={}){
    this.root=root;this.screen=root.querySelector('#game-screen');if(!this.screen)return;
    this.keyboard=keyboard;this.clock=clock;this.load=load;this.onModeChange=onModeChange;
    this.manager=new GameManager({progress:new MissionProgress(storage===undefined?browserStorage():storage)});
    this.canvas=root.querySelector('#game-canvas');this.view=new RaceView(this.canvas);
    this.status=root.querySelector('#game-status');this.selectMission=root.querySelector('#game-mission');this.championA=root.querySelector('#game-champion-a');this.championB=root.querySelector('#game-champion-b');
    this.option=root.createElement?()=>root.createElement('option'):()=>document.createElement('option');
    this.populate(root.querySelector('#game-race-track'),TRACKS.map(t=>({value:t.id,label:t.name})));
    this.populate(root.querySelector('#game-catalog'),BUILTIN_CHAMPIONS.map(c=>({value:c.id,label:c.name})));
    const modes={'#go-home':'home','#go-lab':'lab','#go-career':'career','#go-human-ai':'human-ai','#go-ai-ai':'ai-ai','#home-career':'career','#home-human-ai':'human-ai','#home-ai-ai':'ai-ai'};
    for(const [id,mode]of Object.entries(modes))root.querySelector(id)?.addEventListener('click',()=>this.enter(mode));
    this.selectMission.addEventListener('change',()=>this.renderMissionDescription());
    root.querySelector('#game-start').addEventListener('click',()=>this.perform(()=>this.start()));
    root.querySelector('#game-pause').addEventListener('click',()=>this.setPaused(true));
    root.querySelector('#game-resume').addEventListener('click',()=>this.setPaused(false));
    root.querySelector('#game-restart').addEventListener('click',()=>this.perform(()=>{this.manager.restart();this.refreshProgress();this.clearControls();this.canvas.focus?.();}));
    root.querySelector('#game-abandon').addEventListener('click',()=>{this.manager.abandon();this.clearControls();this.refreshProgress();});
    root.querySelector('#game-retire')?.addEventListener('click',()=>this.perform(()=>{this.manager.retirePlayer();this.clearControls();this.canvas.focus?.();}));
    root.querySelector('#game-load-champion').addEventListener('click',async()=>{
      try{const c=await this.manager.champions.loadBuiltin(root.querySelector('#game-catalog').value,load);this.refreshChampions(c.id);this.status.textContent='Champion chargé : '+c.name;}catch(error){this.status.textContent='Erreur : '+error.message;}
    });
    root.querySelector('#game-import-champion').addEventListener('click',()=>this.perform(()=>this.importChampion(root.querySelector('#game-champion-json').value)));
    root.querySelector('#game-champion-file').addEventListener('change',async event=>{
      try{const file=event.currentTarget.files?.[0];if(!file)return;if(file.size>MAX_JSON_LENGTH)throw new Error('Fichier JSON trop volumineux');this.importChampion(await file.text());}catch(error){this.status.textContent='Erreur : '+error.message;}
    });
    root.querySelector('#game-champion-json').maxLength=MAX_JSON_LENGTH;
    this.refreshProgress();this.enter('home');
    this.ready=Promise.allSettled(BUILTIN_CHAMPIONS.map(c=>this.manager.champions.loadBuiltin(c.id,load))).then(results=>{
      this.refreshChampions();const failed=results.filter(r=>r.status==='rejected').length;
      this.status.textContent=failed?`${failed} champion(s) indisponible(s). Le mode manuel et l’import restent disponibles.`:'Huit champions chargés. Les champions expérimentaux ne garantissent pas les défis techniques.';
    });
  }
  populate(select,rows){const old=select.value;select.replaceChildren();for(const row of rows){const option=this.option();option.value=row.value;option.textContent=row.label;option.disabled=row.disabled??false;select.append(option);}if(rows.some(r=>r.value===old&&!r.disabled))select.value=old;else select.value=rows.find(r=>!r.disabled)?.value??'';}
  refreshChampions(preferred=null){const oldA=this.championA.value,oldB=this.championB.value,rows=this.manager.champions.list().map(c=>({value:c.id,label:c.name}));this.populate(this.championA,rows);this.populate(this.championB,rows);if(preferred)this.championA.value=preferred;else if(!oldA&&rows.some(r=>r.value==='oval-2026'))this.championA.value='oval-2026';if(!oldB&&rows.some(r=>r.value==='oval-2028'))this.championB.value='oval-2028';}
  importChampion(text){const name=this.root.querySelector('#game-champion-name').value.trim()||'Champion importé',champion=this.manager.champions.importJSON(text,name);this.refreshChampions(champion.id);this.status.textContent='Champion importé : '+champion.name;}
  refreshProgress(){
    const rows=this.manager.progress.list();this.populate(this.selectMission,rows.map(r=>({value:r.id,label:`${getMission(r.id).name} — ${r.completed?'terminée':r.available?'disponible':'verrouillée'}`,disabled:!r.available})));
    this.root.querySelector('#game-progress').textContent=`Récompenses uniques : ${this.manager.progress.rewardTotal} · Étoiles : ${this.manager.progress.stars}/15\n`+rows.map(r=>{
      const record=mode=>{const p=r[mode];return `${mode==='human'?'Humain':'IA'} : ${p.stars}★, score ${p.bestScore}, temps ${time(p.bestTime)}, essais ${p.attempts}`;};
      return `${getMission(r.id).name} : ${r.completed?'terminée':r.available?'disponible':'verrouillée'}\n${record('human')} | ${record('ai')}`;
    }).join('\n');this.renderMissionDescription();
  }
  renderMissionDescription(){if(!this.selectMission.value)return;const mission=getMission(this.selectMission.value);this.root.querySelector('#game-mission-description').textContent=`${mission.description} Limite : ${mission.maxDuration} s. Défaite : collision, temps écoulé ou abandon. Récompense unique : ${mission.reward}.`+(['mountain','championship'].includes(mission.trackId)?' Défi manuel conseillé : aucun champion livré n’a encore démontré cet objectif.':'');}
  get isSelected(){return Boolean(this.screen)&&this.manager.mode!=='lab';}
  get paused(){const race=this.manager?.race;return !race||race.paused||race.phase==='finished';}
  clearControls(){this.keyboard.clear();this.clock.reset();}
  enter(mode){this.manager.enter(mode);this.onModeChange(mode);this.clearControls();this.screen.hidden=mode==='lab';
    const lab=this.root.querySelector('#lab-screen'),controls=this.root.querySelector('#lab-controls');if(lab)lab.hidden=mode!=='lab';if(controls)controls.hidden=mode!=='lab';
    this.root.querySelector('#championship-home').hidden=mode!=='home';this.root.querySelector('#career-setup').hidden=mode!=='career';this.root.querySelector('#race-setup').hidden=!['human-ai','ai-ai'].includes(mode);
    this.root.querySelector('#game-champion-b-field').hidden=mode!=='ai-ai';this.root.querySelector('#game-start').hidden=['home','lab'].includes(mode);this.render();
    const retire=this.root.querySelector('#game-retire');if(retire)retire.hidden=mode!=='human-ai';
  }
  start(){
    const mode=this.manager.mode;
    if(mode==='career')this.manager.startMission(this.selectMission.value,{championId:this.root.querySelector('#game-mission-control').value==='ai'?this.championA.value:null});
    else this.manager.startRace(mode,{trackId:this.root.querySelector('#game-race-track').value,championA:this.championA.value,championB:this.championB.value,maxDuration:Number(this.root.querySelector('#game-race-duration').value),laps:Number(this.root.querySelector('#game-race-laps').value)});
    this.clearControls();this.canvas.focus?.();
  }
  perform(action){try{action();}catch(error){this.status.textContent='Erreur : '+error.message;}this.render();}
  setPaused(paused){if(!this.manager)return;if(paused)this.manager.pause();else this.manager.resume();this.clearControls();if(!paused)this.canvas.focus?.();}
  step(dt,command){const before=this.manager.current?.result;this.manager.step(dt,command);if(!before&&this.manager.current?.result)this.refreshProgress();}
  render(fps=0,now=performance.now()){
    if(!this.screen||!this.isSelected)return;
    this.root.querySelector('#game-save-status').textContent=this.manager.progress.warning||'Progression locale validée ; scores humains et IA séparés.';
    const race=this.manager.race,area=this.root.querySelector('#game-race-area');area.hidden=!race;
    if(!race)return;
    this.view.draw(race,this.root.querySelector('#game-sensors').checked);
    if(this.hudRace===race&&this.hudPhase===race.phase&&this.hudPaused===race.paused&&this.hudResult===race.result&&now-(this.hudTime??-Infinity)<100)return;
    this.hudRace=race;this.hudPhase=race.phase;this.hudPaused=race.paused;this.hudResult=race.result;this.hudTime=now;
    this.root.querySelector('#game-hud').textContent=`${this.manager.mode} · ${race.track.id} · ${race.phase==='countdown'?'Départ dans '+Math.ceil(race.countdownLeft):race.phase} ${race.paused?'(pause)':''} · Temps ${race.elapsed.toFixed(2)} / ${race.maxDuration} s · FPS ${fps.toFixed(0)}`;
    this.root.querySelector('#game-results').textContent='Rang | Concurrent | Progression stricte | CP | Tours | Temps arrivée / arrêt | État | Vitesse moyenne\n'+race.standings.map(r=>`${r.rank} | ${competitor(r)} | ${(100*r.progress).toFixed(0)} % | ${r.checkpoints} | ${r.laps} | ${time(r.finishTime??r.elapsed)} | ${r.status} | ${r.averageSpeed.toFixed(1)} px/s`).join('\n');
    let verdict='Course fantôme : cyan = concurrent 1, violet = concurrent 2. Murs et capteurs indépendants ; aucun contact entre voitures.';
    if(race.result){const mission=this.manager.current;
      if(mission instanceof MissionManager){const r=mission.result;verdict=r.outcome==='victory'?`VICTOIRE — ${r.stars} étoiles · Score ${r.score} · ${time(r.elapsed)} · ${r.control==='ai'?'pilotage IA':'pilotage humain'}`:`DÉFAITE — ${r.reason} · Progression ${(100*r.progress).toFixed(0)} %`;
      }else verdict=race.result.winnerIds.length?(race.result.tie?'ÉGALITÉ — arrivées au même pas de simulation.':(this.manager.mode==='human-ai'?(race.result.winnerIds.includes('player')?'VICTOIRE — ':'DÉFAITE — '):'VAINQUEUR — ')+competitor(race.result.ranking.find(r=>r.id===race.result.winnerIds[0]))):'AUCUN VAINQUEUR — aucun concurrent n’a terminé l’objectif.';
      verdict+=' Poids IA inchangés : '+(race.result.ranking.every(r=>r.weightsUnchanged)?'oui':'NON');
    }
    this.root.querySelector('#game-verdict').textContent=verdict;
    const endScreen=this.root.querySelector('#game-end-screen');if(endScreen){endScreen.hidden=!race.result;const title=this.root.querySelector('#game-end-title');if(title)title.textContent=race.result?(verdict.startsWith('VICTOIRE')?'Victoire':verdict.startsWith('DÉFAITE')?'Défaite':race.result.tie?'Égalité':'Résultats de la course'):'';}
    this.root.querySelector('#game-save-status').textContent=this.manager.progress.warning||'Progression locale validée ; scores humains et IA séparés.';
  }
}
