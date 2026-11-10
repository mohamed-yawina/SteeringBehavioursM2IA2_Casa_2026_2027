import { validateComparisonReport } from '../experiments/Statistics.js';
export class ExperimentPanel {
  constructor(root=document,load=path=>fetch(path)) {
    this.root=root;this.output=root.querySelector('#comparison-summary');
    if(!this.output)return;
    this.json=root.querySelector('#comparison-json');this.status=root.querySelector('#comparison-status');
    root.querySelector('#comparison-import').addEventListener('click',()=>this.show(this.json.value));
    root.querySelector('#comparison-load').addEventListener('click',async()=>{
      try{const response=await load('docs/experiments/etape-5/comparaison/resultats.json');
        if(!response.ok)throw new Error('Rapport livré indisponible');const text=await response.text();this.json.value=text;this.show(text);
      }catch(error){this.status.textContent=`Erreur : ${error.message}`;}
    });
  }
  show(text) {
    try {
      const report=validateComparisonReport(text);
      const number=n=>n===null?'—':n.toFixed(2);
      this.output.textContent='Stratégie | Réussites/graines | Fitness max moyenne ± écart-type | Médiane | Tours (épisodes) | Validation\n'+
        report.summary.map(s=>`${s.strategy} | ${s.successes}/${s.runCount} | ${number(s.metrics.maxFitness.mean)} ± ${number(s.metrics.maxFitness.standardDeviation)} | ${number(s.metrics.maxFitness.median)} | ${Math.round(s.metrics.totalLaps.mean*s.runCount)} | ${Math.round(s.validationSuccessRate*s.runCount)}/${s.runCount}`).join('\n');
      this.status.textContent=`Rapport valide : ${report.protocol.seeds.length} graines appariées, ${report.protocol.generations} générations. Résumé recalculé depuis les exécutions ; aucun apprentissage pendant l’import.`;
      return report;
    }catch(error){this.status.textContent=`Erreur : ${error.message}`;return null;}
  }
}
