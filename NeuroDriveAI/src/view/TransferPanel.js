import {importChampion} from '../ai/ChampionSerialization.js';import {TransferSession} from '../experiments/TransferSession.js';
export class TransferPanel{
 constructor(simulation,training,keyboard,clock,root=document){
  this.base=simulation;this.training=training;this.keyboard=keyboard;this.clock=clock;this.root=root;this.session=null;this.paused=true;
  this.start=root.querySelector('#transfer-start');if(!this.start)return;this.mode=root.querySelector('#drive-mode');this.output=root.querySelector('#transfer-results');
  this.start.addEventListener('click',()=>{try{this.loaded=importChampion(root.querySelector('#network-json').value);this.reset();}catch(error){this.output.textContent=`Erreur : ${error.message}`;}});
 }
 get isSelected(){return this.mode?.value==='transfer';}
 reset(){if(!this.loaded)return;this.training.engine?.pause();this.session=new TransferSession(this.loaded.network,this.base.track,{training:this.loaded.training,horizon:30});this.paused=false;this.mode.value='transfer';this.keyboard.clear();this.clock.reset();}
 step(dt){if(!this.paused)this.session?.step(dt);}
 render(){if(!this.output||!this.session)return;const s=this.session.simulation,r=this.session.result;
  this.output.textContent=`Transfert direct, sans réentraînement\nCircuit d’entraînement déclaré : ${this.loaded.training?.trackIds.join(', ')??'inconnu (ancien JSON sans métadonnées)'}\nCircuit de test : ${s.track.id}\nCheckpoints : ${s.checkpoints.validated} · Tours : ${s.checkpoints.laps} · Temps : ${s.elapsed.toFixed(2)} s\nCollision : ${s.car.crashed?'oui':'non'} · Résultat : ${r?(r.laps>0?'tour légal terminé':'aucun tour complet'):'en cours'}\nPoids gelés : ${r?r.weightsUnchanged:'oui'}`;
 }
}
