import {readGeneralizationReport} from '../experiments/GeneralizationReport.js';
export class GeneralizationPanel{
 constructor(root=document,load=path=>fetch(path)){
  this.output=root.querySelector('#generalization-summary');if(!this.output)return;
  this.status=root.querySelector('#generalization-status');this.select=root.querySelector('#generalization-condition');this.json=root.querySelector('#generalization-json');
  this.select.addEventListener('change',()=>this.render());
  root.querySelector('#generalization-import').addEventListener('click',()=>this.show(this.json.value));
  root.querySelector('#generalization-load').addEventListener('click',async()=>{try{const response=await load('docs/experiments/etape-6/resultats.json');if(!response.ok)throw new Error('Rapport indisponible');this.json.value=await response.text();this.show(this.json.value);}catch(error){this.status.textContent='Erreur : '+error.message;}});
 }
 show(text){try{
  const candidate=readGeneralizationReport(text);this.report=candidate;
  this.select.replaceChildren();for(const condition of new Set(candidate.runs.map(r=>r.condition))){const option=document.createElement('option');option.value=condition;option.textContent=condition;this.select.append(option);}
  this.select.value=candidate.runs[0].condition;this.render();this.status.textContent=`${candidate.protocol.seeds.length} graines appariées ; poids inchangés. Statistiques recalculées. Aucun réentraînement pendant la consultation.`;return candidate;
 }catch(error){this.status.textContent='Erreur : '+error.message;return null;}}
 render(){if(!this.report)return;this.output.textContent='Circuit test | Tours réussis / graines | Progression moyenne ± écart-type | Collisions | Survie moyenne\n'+this.report.summary.filter(s=>s.condition===this.select.value).map(s=>`${s.testTrack} | ${s.successes}/${s.count} | ${(100*s.progress.mean).toFixed(1)} ± ${(100*s.progress.standardDeviation).toFixed(1)} % | ${(100*s.collisionRate).toFixed(0)} % | ${s.survival.mean.toFixed(2)} s`).join('\n');}
}
