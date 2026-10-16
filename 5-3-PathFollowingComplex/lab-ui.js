const LabUI = {
  refreshAgents() {
    const select=document.getElementById('agent');if(!select)return;
    select.replaceChildren();
    LabController.agents().forEach((a,i)=>{
      const option=document.createElement('option');option.value=i;
      option.textContent=i<vehicles.length?'Véhicule '+(i+1):'Serpent '+(i-vehicles.length+1)+' · tête';
      select.append(option);
    });
    select.value=LabController.selectedIndex;this.sync();
  },
  sync() {
    const a=LabController.selected();if(!a)return;
    const snake=snakes.find(s=>s.head===a);
    for(const name of ['anticipationDistance','targetAdvance','maxSpeed','maxForce','followPathWeight','separateWeight','wanderWeight']){
      const el=document.getElementById(name);if(!el)continue;
      const value=name==='followPathWeight'&&snake?snake.followWeight:name==='separateWeight'&&snake?snake.separationWeight:a[name];
      el.value=value;
      el.disabled=name==='wanderWeight'&&!!snake;
      document.getElementById(name+'-value').textContent=Number(value).toFixed(2);
    }
  },
  bind() {
    document.getElementById('pause').onclick=()=>{LabController.paused=!LabController.paused;};
    document.getElementById('step').onclick=()=>LabController.requestStep();
    document.getElementById('reset').onclick=()=>LabController.reset();
    document.getElementById('scenario').onchange=e=>LabController.reset(e.target.value);
    document.getElementById('agent').onchange=e=>{LabController.select(Number(e.target.value));this.sync();};
    document.getElementById('details').onchange=e=>{debug=e.target.checked;};
    document.getElementById('edit').onchange=e=>{LabController.editing=e.target.checked;if(e.target.checked)LabController.paused=true;};
    for(const name of ['anticipationDistance','targetAdvance','maxSpeed','maxForce','followPathWeight','separateWeight','wanderWeight'])
      document.getElementById(name).oninput=e=>{LabController.setParameter(name,Number(e.target.value));this.sync();};
  },
  update() {
    document.getElementById('pause').textContent=LabController.paused?'Reprendre':'Pause';
    document.getElementById('state').textContent=(LabController.paused?'En pause':'En cours')+' · pas '+LabController.steps;
    const a=LabController.selected(),d=a?.copyFollowDiagnostics(),f=a?.copyForceDiagnostics();
    const fmt=n=>Number.isFinite(n)?n.toFixed(3):'—';
    const coordinates=p=>p?'('+fmt(p.x)+', '+fmt(p.y)+')':'—';
    document.getElementById('diagnostics').textContent=!d?'Effectuez un pas pour observer les diagnostics.':
      ['Dernier pas : '+d.status, 'Segment : '+(d.selectedIndex??'aucun'),
       'Correction suivi : '+(d.active?'active':'inactive'), 'FH : '+fmt(d.distance)+' px',
       'Rayon : '+fmt(d.radius)+' px', 'Candidats : '+d.candidates.length,
       'F : '+coordinates(d.future), 'H : '+coordinates(d.normal), 'T : '+coordinates(d.target),
       'Force suivi individuelle : '+fmt(d.force.mag()),
       'Séparation pondérée : '+fmt(f?.weighted.separation?.mag()),
       'Somme ponderee : '+fmt(f?.unclamped.mag()),
       'Resultante appliquee : '+fmt(f?.total.mag()),
       'Segments degeneres : '+d.candidates.filter(c=>c.status==='undefined').length].join(String.fromCharCode(10));
  }
};
