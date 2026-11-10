import {MissionManager} from './MissionManager.js';
import {MissionProgress} from './MissionProgress.js';
import {ChampionRegistry} from './ChampionRegistry.js';
import {RaceManager} from './RaceManager.js';
export class GameManager{
  constructor({progress=new MissionProgress(),champions=new ChampionRegistry()}={}){this.progress=progress;this.champions=champions;this.mode='home';this.session=null;this.sessionMode=null;this.recorded=false;}
  get current(){return this.mode===this.sessionMode?this.session:null;}
  get race(){const session=this.current;return session instanceof MissionManager?session.race:session;}
  enter(mode){if(!['home','lab','career','human-ai','ai-ai'].includes(mode))throw new RangeError('Mode de jeu inconnu');this.race?.pause();this.mode=mode;}
  recordMission(){if(this.session instanceof MissionManager&&this.session.result&&!this.recorded){this.progress.record(this.session.result);this.recorded=true;}}
  replaceSession(candidate,mode){
    if(this.session instanceof MissionManager&&!this.session.result){this.session.abandon();this.recordMission();}
    else if(this.session instanceof RaceManager&&!this.session.result)this.session.abandonAll();
    this.session=candidate;this.sessionMode=mode;this.mode=mode;this.recorded=false;candidate.start();
  }
  startMission(id,{championId=null,countdown=3}={}){
    if(!this.progress.isAvailable(id))throw new Error('Terminer la mission précédente pour débloquer celle-ci');
    const champion=championId===null?null:this.champions.get(championId);
    const entrant=champion?{id:'player',name:champion.name,control:'ai',championId:champion.id,network:champion.network}:{id:'player',name:'Joueur',control:'human'};
    const candidate=new MissionManager(id,entrant,{countdown});this.replaceSession(candidate,'career');return candidate;
  }
  startRace(mode,{trackId='oval',championA,championB,maxDuration=90,countdown=3,laps=1}={}){
    if(!['human-ai','ai-ai'].includes(mode))throw new RangeError('Compétition inconnue');
    const a=this.champions.get(championA),ai=(champion,id)=>({id,name:champion.name,control:'ai',championId:champion.id,network:champion.network});
    const entrants=mode==='human-ai'?[{id:'player',name:'Joueur',control:'human'},ai(a,'ai-a')]:[ai(a,'ai-a'),ai(this.champions.get(championB),'ai-b')];
    const candidate=new RaceManager({trackId,entrants,maxDuration,countdown,goal:{type:'laps',target:laps}});this.replaceSession(candidate,mode);return candidate;
  }
  step(dt,command={}){const session=this.current;if(!session)return;session.step(dt,{player:command});this.recordMission();}
  pause(){this.race?.pause();}
  resume(){this.race?.resume();}
  abandon(){if(this.current instanceof MissionManager){this.current.abandon();this.recordMission();}else if(this.current)this.current.abandonAll();}
  retirePlayer(){if(this.mode!=='human-ai'||!this.race)throw new Error('Aucun duel humain actif');this.race.abandon('player');}
  restart(){const session=this.current;if(!session)throw new Error('Aucune partie à recommencer');if(session instanceof MissionManager&&!session.result){session.abandon();this.recordMission();}session.reset();this.recorded=false;session.start();}
}
