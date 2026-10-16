const LabUI = {
 available(){return typeof document!=='undefined';},
 sync(){
   if(!this.available())return;
   const scenario=document.getElementById('scenario');scenario.value=LabController.scenario;
   for(const [key,value] of Object.entries(LabController.params)){
     const input=document.getElementById(key);input.value=value;
     document.getElementById(key+'-value').textContent=String(value);
   }
   const select=document.getElementById('vehicle');select.replaceChildren();
   vehicules.forEach((v,i)=>{const option=document.createElement('option');option.value=i;option.textContent='Véhicule '+(i+1);select.append(option);});
   select.value=LabController.selectedVehicle;
   const o=obstacles[LabController.selectedObstacle];
   document.getElementById('radius').disabled=!o;document.getElementById('remove').disabled=!o;
   if(o)document.getElementById('radius').value=o.r;
   document.getElementById('radius-value').textContent=o?String(o.r):'Sélectionner un obstacle';
   document.getElementById('edit').checked=LabController.editing;
   document.getElementById('mouse-target').checked=LabController.followMouse;
   document.getElementById('details').checked=LabController.details;
   document.getElementById('avoid-enabled').checked=LabController.avoidEnabled;
   document.getElementById('avoid-state').textContent='Poids configuré '+LabController.params.avoid+
     ' · poids effectif '+(LabController.avoidEnabled?LabController.params.avoid:0);
 },
 bind(){
   if(!this.available())return;
   const scenario=document.getElementById('scenario');scenario.replaceChildren();
   for(const [id,s] of Object.entries(LabScenarios)){
     const option=document.createElement('option');option.value=id;option.textContent=s.label;scenario.append(option);
   }
   scenario.onchange=e=>{LabController.reset(e.target.value);};
   document.getElementById('pause').onclick=()=>{LabController.paused=!LabController.paused;};
   document.getElementById('step').onclick=()=>LabController.requestStep();
   document.getElementById('reset').onclick=()=>LabController.reset();
   document.getElementById('vehicle').onchange=e=>{LabController.selectVehicle(Number(e.target.value));this.sync();};
   document.getElementById('details').onchange=e=>{LabController.details=e.target.checked;Vehicle.debug=e.target.checked;};
   document.getElementById('edit').onchange=e=>{LabController.editing=e.target.checked;if(e.target.checked)LabController.paused=true;};
   document.getElementById('mouse-target').onchange=e=>{LabController.followMouse=e.target.checked;};
   document.getElementById('avoid-enabled').onchange=e=>{
     LabController.setAvoidEnabled(e.target.checked);this.sync();
   };
   document.getElementById('radius').oninput=e=>{LabController.setRadius(Number(e.target.value));this.sync();};
   document.getElementById('remove').onclick=()=>LabController.removeObstacle();
   for(const key of ['maxSpeed','maxForce','shortHorizon','longHorizon','arrive','avoid','separate','boundaries']){
     document.getElementById(key).oninput=e=>{
       const ok=LabController.setParameter(key,Number(e.target.value));
       document.getElementById('validation').textContent=ok?'':'Valeur refusée : valeur finie, non négative et dans la plage ; horizons ordonnés.';
       this.sync();
     };
   }
   this.sync();
 },
 update(){
   if(!this.available())return;
   document.getElementById('pause').textContent=LabController.paused?'Reprendre':'Pause';
   document.getElementById('state').textContent=(LabController.paused?'En pause':'En cours')+' · pas '+LabController.steps;
   document.getElementById('goal').textContent=LabScenarios[LabController.scenario].goal;
   const defaults=LabController.avoidEnabled&&Object.keys(LabDefaults).every(k=>LabController.params[k]===LabDefaults[k]);
   document.getElementById('defaults').textContent=defaults?'Paramètres historiques':'Paramètres modifiés · Reset pour restaurer';
   const v=LabController.selected(),d=v?.copyAvoidDiagnostics(),f=v?.copyForceDiagnostics();
   const fmt=n=>Number.isFinite(n)?n.toFixed(4):'—';
   const vector=p=>p?'('+fmt(p.x)+', '+fmt(p.y)+')':'—';
   const reasons={'empty-list':'Aucun obstacle','no-valid-obstacle':'Aucun obstacle exploitable',
     'outside-threshold':'Distance ≥ seuil','zero-force-budget':'Budget maxForce nul',
     'coincident-sample':'Échantillon confondu avec C : direction nulle',
     'invalid-input':'Entrée invalide','detected':'Répulsion calculée'};
   document.getElementById('geometry').textContent=!d?'Effectuer un pas pour obtenir une décision.':[
     'Pas '+d.step+' · avant intégration', 'Xₙ '+vector(d.origin), 'Vₙ '+vector(d.velocity),
     'Qc '+vector(d.q15), 'Ql '+vector(d.q30), 'C '+vector(d.center)+' · R '+fmt(d.radius),
     'Échantillon '+(d.sampleName==='Q15'?'Qc ('+d.shortHorizon+')':d.sampleName==='Q30'?'Ql ('+d.longHorizon+')':d.sampleName??'—')+' '+vector(d.sample),
     'Distance min '+fmt(d.minDistance)+' px', 'Seuil R+marge '+fmt(d.threshold)+' px',
     'Détecté : '+(d.detected?'oui':'non'),
     'Avoid '+(f?.avoidEnabled?'activé':'désactivé')+(f?.avoidEnabled?'':' · détection informative, force non appliquée'),
     reasons[d.reason]??d.status
   ].join(String.fromCharCode(10));
   const body=document.getElementById('forces');body.replaceChildren();
   if(f?.status==='defined'){
     for(const name of ['arrive','avoid','separate','boundaries']){
       const row=document.createElement('tr');
       for(const value of [name,vector(f.raw[name]),fmt(f.raw[name].mag()),
         fmt(f.configuredWeights[name])+' → '+fmt(f.weights[name]),
         vector(f.weighted[name]),fmt(f.weighted[name].mag())]){
         const cell=document.createElement('td');cell.textContent=value;row.append(cell);
       }body.append(row);
     }
     document.getElementById('result').textContent='Pas '+f.step+' · norme avant plafond '+fmt(f.unclamped.mag())+
       ' → appliquée '+fmt(f.total.mag())+' / maxForce '+fmt(f.maxForce)+
       ' · maxSpeed '+fmt(f.maxSpeed)+' · total '+vector(f.total);
   }else document.getElementById('result').textContent='Pas de force mémorisée.';
 }
};
