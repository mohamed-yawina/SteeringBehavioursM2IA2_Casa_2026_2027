import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import vm from 'node:vm';
import {load,vehicle,obstacles,xy} from './reference-harness.mjs';
const near=(a,b)=>assert.ok(Number.isFinite(a)&&Math.abs(a-b)<=1e-12,`${a} != ${b}`);
const lab=(dom=false)=>{const e=load(2027,{historical:false,dom});vm.runInContext('setup()',e.scope);return e;};
test('paramètres par défaut et horizons autorisés sans changement des valeurs physiques',()=>{
 const e=lab(),c=e.LabController,v=c.selected();
 assert.equal(v.maxSpeed,4);assert.equal(v.maxForce,.2);assert.equal(v.shortHorizon,15);assert.equal(v.longHorizon,30);
 assert.deepEqual(JSON.parse(JSON.stringify(c.params)),{maxSpeed:4,maxForce:.2,shortHorizon:15,longHorizon:30,arrive:.2,avoid:3,separate:.2,boundaries:3});
});
test('horizons réellement utilisés, zéro accepté, ordres incohérents rejetés',()=>{
 const e=lab(),c=e.LabController;c.reset('lateral');c.followMouse=false;
 assert.equal(c.setParameter('shortHorizon',0),true);assert.equal(c.setParameter('longHorizon',0),true);
 c.requestStep();c.step();const d=c.selected().copyAvoidDiagnostics();
 near(d.q15.x,d.origin.x);near(d.q30.x,d.origin.x);
 assert.equal(c.setParameter('shortHorizon',1),false);
 assert.equal(c.setParameter('longHorizon',5),true);
 assert.equal(c.setParameter('shortHorizon',2),true);
 c.requestStep();c.step();const next=c.selected().copyAvoidDiagnostics();
 near(next.q15.x,next.origin.x+2*next.velocity.x);near(next.q30.x,next.origin.x+5*next.velocity.x);
});
test('valeurs invalides ne modifient pas les paramètres ni les vecteurs',()=>{
 const e=lab(),c=e.LabController,before=JSON.stringify(c.params);
 for(const key of ['maxSpeed','maxForce','shortHorizon','longHorizon'])
  for(const n of [-1,Infinity,NaN,1000])assert.equal(c.setParameter(key,n),false);
 assert.equal(c.setParameter('inconnu',1),false);assert.equal(JSON.stringify(c.params),before);
});
test('maxSpeed et maxForce zéro restent fonctionnels',()=>{
 const e=lab(),c=e.LabController;
 assert.equal(c.setParameter('maxSpeed',0),true);assert.equal(c.setParameter('maxForce',0),true);
 const v=c.selected(),before=xy(v.pos);c.requestStep();c.step();
 assert.deepEqual(xy(v.pos),before);assert.equal(v.vel.mag(),0);assert.equal(v.copyForceDiagnostics().total.mag(),0);
});
test('pause reprise et pas unique: exactement une intégration par véhicule',()=>{
 const e=lab(),c=e.LabController;c.reset('narrow');c.paused=true;
 const counts=vm.runInContext('vehicules',e.scope).map(v=>{const result={n:0},update=v.update.bind(v);v.update=()=>{result.n++;update();};return result;});
 assert.equal(c.step(),false);c.requestStep();assert.equal(c.step(),true);assert.equal(c.step(),false);
 for(const result of counts)assert.equal(result.n,1);
 c.paused=false;c.step();for(const result of counts)assert.equal(result.n,2);
 assert.equal(c.steps,2);
});
test('huit scénarios et reset reproductible avec états initiaux explicites',()=>{
 const e=lab(),c=e.LabController;assert.equal(Object.keys(e.LabScenarios).length,8);
 for(const name of Object.keys(e.LabScenarios)){
  const run=()=>{c.reset(name);c.followMouse=false;c.paused=false;for(let i=0;i<5;i++)c.step();
   return JSON.stringify(vm.runInContext('vehicules.map(v=>[v.pos,v.vel,v.acc,v.copyAvoidDiagnostics(),v.copyForceDiagnostics()])',e.scope));};
  assert.equal(run(),run());assert.equal(c.steps,5);
 }
});
test('reset restaure géométrie, cible, paramètres et sélection du scénario',()=>{
 const e=lab(),c=e.LabController;c.reset('lateral');c.setParameter('maxSpeed',7);
 c.paused=true;c.editing=true;c.selectObstacle(0);c.editObstacle(0,700,500,5);
 c.selectVehicle(0);c.reset();assert.equal(c.scenario,'lateral');assert.equal(c.params.maxSpeed,4);
 const o=vm.runInContext('obstacles[0]',e.scope);assert.deepEqual([...xy(o.pos),o.r],[420,420,35]);
 assert.equal(c.steps,0);assert.equal(c.selectedObstacle,-1);assert.equal(c.selectedVehicle,0);
 assert.equal(c.reset('missing'),false);
});
test('phénomènes pédagogiques: frontal nul, menace masquée, trou, symétrie',()=>{
 const e=lab(),c=e.LabController;
 for(const name of ['frontal','masked','gap','symmetric']){
  c.reset(name);c.requestStep();c.step();const d=c.selected().copyAvoidDiagnostics();
  if(name==='frontal'){assert.equal(d.detected,true);assert.equal(d.reason,'coincident-sample');assert.equal(d.force.mag(),0);}
  if(name==='masked'){assert.equal(d.selectedIndex,0);assert.equal(d.detected,false);}
  if(name==='gap')assert.equal(d.detected,false);
  if(name==='symmetric'){assert.equal(d.selectedIndex,0);assert.equal(d.detected,true);}
 }
 c.reset('empty');c.requestStep();c.step();assert.equal(c.selected().copyAvoidDiagnostics().reason,'empty-list');
});
test('édition: pause obligatoire, géométrie validée, rayon zéro, suppression sûre',()=>{
 const e=lab(),c=e.LabController;c.reset('lateral');
 assert.equal(c.editObstacle(0,400,400,0),false);c.paused=true;c.editing=true;
 assert.equal(c.editObstacle(0,400,400,0),true);
 const o=vm.runInContext('obstacles[0]',e.scope);assert.equal(o.r,0);
 assert.equal(c.editObstacle(0,NaN,400,10),false);assert.equal(c.editObstacle(0,400,400,-1),false);
 assert.equal(c.addObstacle(100,100,0),true);assert.equal(c.addObstacle(100,100,Infinity),false);
 assert.equal(c.removeObstacle(),true);assert.equal(c.removeObstacle(),false);
});
test('sélection et paramètres ne mutent pas les anciens diagnostics ni le scénario',()=>{
 const e=lab(),c=e.LabController;c.reset('narrow');c.requestStep();c.step();
 const snapshot=c.selected().copyAvoidDiagnostics(),before=JSON.stringify(snapshot),scenario=JSON.stringify(e.LabScenarios);
 assert.equal(c.selectVehicle(1),true);assert.equal(c.selectVehicle(99),false);
 c.setParameter('maxForce',.1);assert.equal(c.selected().copyAvoidDiagnostics(),null);
 assert.equal(JSON.stringify(snapshot),before);assert.equal(JSON.stringify(e.LabScenarios),scenario);
});
test('diagnostics cohérents: même pas, avant intégration, norme et limites utilisées',()=>{
 const e=lab(),c=e.LabController;c.reset('lateral');c.requestStep();c.step();
 const v=c.selected(),d=v.copyAvoidDiagnostics(),f=v.copyForceDiagnostics();
 assert.equal(d.step,1);assert.equal(f.step,1);assert.equal(d.stage,'pre-integration');
 near(v.pos.x,d.origin.x+v.vel.x);near(v.pos.y,d.origin.y+v.vel.y);
 near(d.minDistance,20);near(d.threshold,59);
 assert.equal(f.maxForce,.2);assert.equal(f.maxSpeed,4);assert.ok(f.total.mag()<=f.maxForce+1e-12);
 d.velocity.x=999;d.distances.q15=999;f.weights.avoid=999;
 assert.notEqual(v.copyAvoidDiagnostics().velocity.x,999);assert.notEqual(v.copyForceDiagnostics().weights.avoid,999);
});
test('renderer et UI ne rappellent aucun steering ni intégrateur ni aléatoire',()=>{
 const e=lab(true),c=e.LabController;c.reset('lateral');c.requestStep();c.step();
 c.details=true;
 const v=c.selected(),before=JSON.stringify([v.pos,v.vel,v.acc,v.copyAvoidDiagnostics(),v.copyForceDiagnostics()]),calls=e.randomCalls();
 for(const method of ['avoid','arrive','separate','boundaries','update','applyBehaviors'])v[method]=()=>assert.fail(method+' during render');
 e.LabRenderer.draw();e.LabUI.update();
 assert.equal(JSON.stringify([v.pos,v.vel,v.acc,v.copyAvoidDiagnostics(),v.copyForceDiagnostics()]),before);
 assert.equal(e.randomCalls(),calls);assert.match(e.elements.get('geometry').textContent,/Pas 1/);
 assert.equal(e.elements.get('forces').children.length,4);
});
test('Obstacle et Target ne subissent jamais force ou intégration',()=>{
 const e=lab(),c=e.LabController;c.reset('narrow');
 const statics=vm.runInContext('[target,...obstacles]',e.scope);
 for(const o of statics){
  assert.ok(o instanceof e.Vehicle);o.update=()=>assert.fail('static update');o.applyForce=()=>assert.fail('static force');
 }
 for(let i=0;i<5;i++)vm.runInContext('draw()',e.scope);
});
test('UI raccordée: scénario, pause, pas, paramètres, rayon et visibilité',()=>{
 const e=lab(true),c=e.LabController,el=e.elements;
 el.get('scenario').onchange({target:{value:'lateral'}});
 el.get('pause').onclick();assert.equal(c.paused,true);
 el.get('step').onclick();c.step();assert.equal(c.steps,1);
 el.get('maxForce').oninput({target:{value:'0'}});assert.equal(c.params.maxForce,0);
 el.get('shortHorizon').oninput({target:{value:'40'}});assert.equal(c.params.shortHorizon,15);
 el.get('details').onchange({target:{checked:false}});assert.equal(c.details,false);
 el.get('edit').onchange({target:{checked:true}});c.selectObstacle(0);e.LabUI.sync();
 el.get('radius').oninput({target:{value:'0'}});assert.equal(vm.runInContext('obstacles[0].r',e.scope),0);
 el.get('reset').onclick();assert.equal(c.params.maxForce,.2);assert.equal(c.steps,0);
});
test('commandes historiques et édition sans conflit avec clic ajout',()=>{
 const e=lab(),c=e.LabController;
 const length=()=>vm.runInContext('obstacles.length',e.scope);
 vm.runInContext('mousePressed()',e.scope);assert.equal(length(),2);
 vm.runInContext('key="v";keyPressed();key="f";keyPressed()',e.scope);
 assert.equal(vm.runInContext('vehicules.length',e.scope),12);
 const old=c.details;vm.runInContext('key="d";keyPressed()',e.scope);assert.equal(c.details,!old);
 c.editing=true;c.paused=true;e.scope.mouseX=600;e.scope.mouseY=400;
 vm.runInContext('mousePressed();mouseDragged();mouseReleased()',e.scope);assert.equal(length(),2);
});
test('méthodes physiques protégées de phase 2 inchangées hors applyBehaviors autorisé',()=>{
 const methods=JSON.parse(readFileSync(new URL('./phase2-methods.json',import.meta.url),'utf8'));
 const code=readFileSync(new URL('../vehicle.js',import.meta.url),'utf8');
 const extract=name=>{const start=code.indexOf('  '+name+'('),body=code.indexOf('{',start);let depth=0;
 for(let i=body;i<code.length;i++){if(code[i]==='{')depth++;if(code[i]==='}'&&--depth===0)return code.slice(start,i+1).replace(/\r\n/g,'\n');}};
 for(const [name,expected] of Object.entries(methods))if(name!=='applyBehaviors')assert.equal(extract(name),expected,name);
});
test('poids configurables par défaut et diagnostics configuré/effectif',()=>{
 const e=lab(),c=e.LabController,v=c.selected();
 assert.deepEqual(JSON.parse(JSON.stringify(v.behaviorWeights)),{arrive:.2,avoid:3,separate:.2,boundaries:3});
 assert.equal(v.avoidEnabled,true);
 c.requestStep();c.step();const d=v.copyForceDiagnostics();
 assert.deepEqual(JSON.parse(JSON.stringify(d.configuredWeights)),{arrive:.2,avoid:3,separate:.2,boundaries:3});
 assert.deepEqual(JSON.parse(JSON.stringify(d.weights)),{arrive:.2,avoid:3,separate:.2,boundaries:3});
 assert.equal(d.avoidEnabled,true);
});
test('chaque coefficient modifié indépendamment est utilisé dans applyBehaviors',()=>{
 for(const [key,value] of [['arrive',1.3],['avoid',4.2],['separate',2.1],['boundaries',1.7]]){
  const e=lab(),c=e.LabController,v=c.selected();c.followMouse=false;
  for(const name of ['arrive','avoid','separate','boundaries'])v[name]=()=>new e.Vector(name===key?2:1,0);
  e.setVehicles([v]);assert.equal(c.setParameter(key,value),true);v.applyBehaviors(new e.Vector(300,100),[]);
  const d=v.copyForceDiagnostics();near(d.configuredWeights[key],value);near(d.weights[key],value);
  near(d.weighted[key].x,2*value);for(const name of ['arrive','avoid','separate','boundaries'])if(name!==key)near(d.weighted[name].x,1*c.params[name]);
  assert.ok(d.total.mag()<=v.maxForce+1e-12);
 }
});
test('poids zéro effectif, négatifs et valeurs non finies',()=>{
 const e=lab(),c=e.LabController,v=c.selected();
 for(const key of ['arrive','avoid','separate','boundaries'])assert.equal(c.setParameter(key,0),true);
 for(const key of ['arrive','avoid','separate','boundaries'])for(const value of [-.1,NaN,Infinity,-Infinity])assert.equal(c.setParameter(key,value),false);
 v.arrive=()=>new e.Vector(1,0);v.avoid=()=>new e.Vector(0,1);v.separate=()=>new e.Vector(-1,0);v.boundaries=()=>new e.Vector(0,-1);
 v.applyBehaviors(new e.Vector(300,100),[]);const d=v.copyForceDiagnostics();
 assert.deepEqual(JSON.parse(JSON.stringify(d.weights)),{arrive:0,avoid:0,separate:0,boundaries:0});
 assert.deepEqual(xy(d.unclamped),[0,0]);assert.deepEqual(xy(d.total),[0,0]);
});
test('Avoid désactivé garde la détection informative mais sa force effective est nulle',()=>{
 const e=lab(),c=e.LabController;c.reset('lateral');const v=c.selected();
 assert.equal(c.setParameter('avoid',4.5),true);assert.equal(c.setAvoidEnabled(false),true);
 c.requestStep();c.step();let a=v.copyAvoidDiagnostics(),f=v.copyForceDiagnostics();
 assert.equal(a.detected,true);near(f.configuredWeights.avoid,4.5);near(f.weights.avoid,0);
 assert.deepEqual(xy(f.weighted.avoid),[0,0]);assert.equal(f.avoidEnabled,false);
 const without=f.total.copy();
 assert.equal(c.setAvoidEnabled(true),true);near(c.params.avoid,4.5);c.requestStep();c.step();a=v.copyAvoidDiagnostics();f=v.copyForceDiagnostics();
 assert.equal(a.detected,true);near(f.configuredWeights.avoid,4.5);near(f.weights.avoid,4.5);
 assert.ok(f.weighted.avoid.mag()>0);assert.notDeepEqual(xy(f.total),xy(without));
});
test('poids configuré Avoid nul reste nul activé et désactivé',()=>{
 const e=lab(),c=e.LabController;c.reset('lateral');c.setParameter('avoid',0);
 for(const enabled of [true,false]){c.setAvoidEnabled(enabled);c.requestStep();c.step();const f=c.selected().copyForceDiagnostics();
  near(f.configuredWeights.avoid,0);near(f.weights.avoid,0);assert.deepEqual(xy(f.weighted.avoid),[0,0]);}
});
test('plafond global et application unique restent actifs avec poids élevés',()=>{
 const e=lab(),c=e.LabController,v=c.selected();let calls=0;const apply=v.applyForce.bind(v);v.applyForce=f=>{calls++;apply(f);};
 for(const key of ['arrive','avoid','separate','boundaries']){c.setParameter(key,10);v[key]=()=>new e.Vector(1,0);}
 assert.equal(v.applyBehaviors(new e.Vector(300,100),[]),true);const f=v.copyForceDiagnostics();
 assert.equal(calls,1);assert.ok(f.unclamped.mag()>f.maxForce);near(f.total.mag(),f.maxForce);
 near(f.total.x, f.maxForce);near(f.total.y,0);
});
test('reset restaure poids et commutateur; pas unique prend les nouveaux poids',()=>{
 const e=lab(),c=e.LabController;c.reset('lateral');c.setParameter('arrive',0);c.setParameter('avoid',7);c.setAvoidEnabled(false);
 c.paused=true;c.requestStep();assert.equal(c.step(),true);assert.equal(c.steps,1);
 assert.equal(c.selected().copyForceDiagnostics().weights.avoid,0);
 c.reset();assert.deepEqual(JSON.parse(JSON.stringify(c.params)),{...e.LabDefaults});assert.equal(c.avoidEnabled,true);
 c.paused=true;c.requestStep();c.step();assert.equal(c.selected().copyForceDiagnostics().weights.avoid,3);
});
test('contrôles UI reflètent et commandent les poids et Avoid effectifs',()=>{
 const e=lab(true),c=e.LabController,el=e.elements;
 el.get('arrive').oninput({target:{value:'0'}});el.get('avoid').oninput({target:{value:'4.5'}});
 el.get('separate').oninput({target:{value:'1.2'}});el.get('boundaries').oninput({target:{value:'0'}});
 assert.deepEqual(JSON.parse(JSON.stringify(c.params)),{maxSpeed:4,maxForce:.2,shortHorizon:15,longHorizon:30,arrive:0,avoid:4.5,separate:1.2,boundaries:0});
 el.get('avoid-enabled').onchange({target:{checked:false}});c.paused=true;c.requestStep();c.step();e.LabUI.update();
 assert.equal(el.get('avoid-value').textContent,'4.5');assert.equal(el.get('avoid-enabled').checked,false);
 assert.equal(el.get('avoid-state').textContent,'Poids configuré 4.5 · poids effectif 0');
 assert.match(el.get('forces').children[1].children[3].textContent,/4\.5000 → 0\.0000/);
 assert.match(el.get('result').textContent,/maxForce/);
});
test('références immuables: empreintes identiques à la phase 2',()=>{
 const files={
 'reference-trajectories.json':'2d7b11e2a1148f4fb9d8c57d2f1e087512be79ea3675574cd00e0a8683cd3fb0',
 'historical-sources.json':'8d24d618f77b943e62263af709e19c55ea4c626ba28fdbec1469db3a7158e22e',
 'corrected-trajectories.json':'a1e6c3931770c5efd2eb930f8ecc834e881879c81c7d13edc8980275a25fe557'
 };
 for(const [name,expected] of Object.entries(files))assert.equal(createHash('sha256').update(readFileSync(new URL('./'+name,import.meta.url))).digest('hex'),expected);
});
test('HTML: ressources présentes et ordre Vehicle Obstacle Target contrôleur sketch',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 const scripts=[...html.matchAll(/<script defer src="([^"]+)"/g)].map(m=>m[1]);
 assert.deepEqual(scripts,['libraries/p5.min.js','libraries/p5.sound.min.js','vehicle.js','obstacle.js','target.js','lab-scenarios.js','lab-controller.js','lab-renderer.js','lab-ui.js','sketch.js']);
 for(const name of scripts)assert.ok(readFileSync(new URL('../'+name,import.meta.url)).length>0);
 const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);assert.equal(new Set(ids).size,ids.length);
 for(const match of html.matchAll(/\bfor="([^"]+)"/g))assert.ok(ids.includes(match[1]));
});
