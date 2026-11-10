import {MISSIONS,getMission,missionReward} from './MissionDefinitions.js';
export const SAVE_KEY='NeuroDriveAI.career.v1';
const emptyRecord=()=>({attempts:0,completed:false,bestScore:0,bestTime:null,stars:0});
const fresh=()=>({format:'NeuroDriveAI.career',version:1,missions:MISSIONS.map(m=>({id:m.id,human:emptyRecord(),ai:emptyRecord()}))});
export function validateProgress(text){
  if(typeof text!=='string'||text.length>16000)throw new TypeError('Sauvegarde trop volumineuse');
  const data=JSON.parse(text);
  if(data?.format!=='NeuroDriveAI.career'||data.version!==1||!Array.isArray(data.missions)||data.missions.length!==MISSIONS.length)throw new TypeError('Format de sauvegarde invalide');
  let unlocked=true;
  const missions=MISSIONS.map((mission,index)=>{
    const row=data.missions[index];if(row?.id!==mission.id)throw new TypeError('Ordre des missions invalide');
    const result={id:mission.id};
    for(const mode of ['human','ai']){
      const r=row[mode];
      if(!r||!Number.isInteger(r.attempts)||r.attempts<0||r.attempts>1e6||typeof r.completed!=='boolean'||!Number.isInteger(r.bestScore)||r.bestScore<0||!Number.isInteger(r.stars)||r.stars<0||r.stars>3)throw new TypeError('Progression invalide');
      if(!unlocked&&r.attempts>0)throw new TypeError('Mission verrouillée modifiée');
      if(r.completed){
        if(!r.attempts||!Number.isFinite(r.bestTime)||r.bestTime<=0||r.bestTime>mission.maxDuration)throw new TypeError('Temps de réussite invalide');
        const expected=missionReward(mission,true,r.bestTime,1);
        if(r.bestScore!==expected.score||r.stars!==expected.stars)throw new TypeError('Score ou étoiles incohérents');
      }else if(r.bestTime!==null||r.stars!==0||r.bestScore>99||r.attempts===0&&r.bestScore!==0)throw new TypeError('Échec incohérent');
      result[mode]={attempts:r.attempts,completed:r.completed,bestScore:r.bestScore,bestTime:r.bestTime,stars:r.stars};
    }
    unlocked=unlocked&&(result.human.completed||result.ai.completed);return result;
  });
  return {format:data.format,version:1,missions};
}
export class MissionProgress{
  constructor(storage=null){
    this.storage=storage;this.warning='';this.data=fresh();
    try{const text=storage?.getItem(SAVE_KEY);if(text!==null&&text!==undefined)this.data=validateProgress(text);}catch{this.warning='Sauvegarde ignorée : données invalides ou stockage inaccessible.';}
  }
  list(){let available=true;return this.data.missions.map(row=>{
    const completed=row.human.completed||row.ai.completed;
    const item={id:row.id,available,completed,human:{...row.human},ai:{...row.ai}};available=available&&completed;return item;
  });}
  isAvailable(id){getMission(id);return this.list().find(m=>m.id===id).available;}
  get rewardTotal(){return this.list().reduce((sum,row)=>sum+(row.completed?getMission(row.id).reward:0),0);}
  get stars(){return this.list().reduce((sum,row)=>sum+Math.max(row.human.stars,row.ai.stars),0);}
  save(){try{this.storage?.setItem(SAVE_KEY,JSON.stringify(this.data));if(!this.storage)this.warning='Progression conservée en mémoire seulement.';}catch{this.warning='Stockage indisponible : progression conservée en mémoire seulement.';}}
  record(result){
    const mission=getMission(result?.missionId);
    if(!this.isAvailable(mission.id)||!['human','ai'].includes(result.control)||!['victory','defeat'].includes(result.outcome)||result.trackId!==mission.trackId||result.weightsUnchanged!==true)throw new TypeError('Résultat non admissible');
    const success=result.outcome==='victory',expected=missionReward(mission,success,result.elapsed,result.progress);
    if(result.elapsed<=0&&success||result.score!==expected.score||result.stars!==expected.stars||!Number.isFinite(result.progress)||result.progress<0||result.progress>1||success&&(result.reason!=='finished'||result.progress!==1)||!success&&!mission.defeatConditions.includes(result.reason))throw new TypeError('Résultat incohérent');
    const candidate=JSON.parse(JSON.stringify(this.data)),row=candidate.missions.find(m=>m.id===mission.id)[result.control];
    row.attempts=Math.min(1e6,row.attempts+1);row.bestScore=Math.max(row.bestScore,result.score);
    if(success){row.completed=true;if(row.bestTime===null||result.elapsed<row.bestTime)row.bestTime=result.elapsed;row.stars=missionReward(mission,true,row.bestTime,1).stars;}
    this.data=validateProgress(JSON.stringify(candidate));this.save();
  }
  clear(){this.data=fresh();this.save();}
}
