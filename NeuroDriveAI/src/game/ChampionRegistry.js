import {importChampion,exportChampion} from '../ai/ChampionSerialization.js';
import {NeuralController} from '../ai/NeuralController.js';
export const BUILTIN_CHAMPIONS=Object.freeze([
  {id:'oval-2026',name:'Oval · 2026',path:'docs/experiments/etape-6/champions/oval-2026.json'},
  {id:'oval-2028',name:'Oval · 2028',path:'docs/experiments/etape-6/champions/oval-2028.json'},
  {id:'desert-2028',name:'Desert · 2028',path:'docs/experiments/etape-6/champions/desert-2028.json'},
  {id:'desert-2029',name:'Desert · 2029',path:'docs/experiments/etape-6/champions/desert-2029.json'},
  {id:'mountain-2029',name:'Mountain · 2029 (expérimental)',path:'docs/experiments/etape-6/champions/mountain-2029.json'},
  {id:'championship-2026',name:'Championship · 2026 (expérimental)',path:'docs/experiments/etape-6/champions/championship-2026.json'},
  {id:'classic-2026',name:'Classique · 2026 (ancien format)',path:'docs/experiments/essai-2026/champion.json'},
  {id:'oval-c-2028',name:'Oval C · 2028 (étape 5)',path:'docs/experiments/etape-5/comparaison/champions/C-2028.json'}
].map(Object.freeze));
export class ChampionRegistry{
  constructor(){this.entries=new Map();this.importCounter=0;}
  register(id,name,text){
    if(typeof id!=='string'||!id||this.entries.has(id)||this.entries.size>=24||typeof name!=='string'||!name.trim()||name.length>80)throw new RangeError('Identité ou capacité du catalogue invalide');
    const champion=importChampion(text);new NeuralController(champion.network); // same driving contract as the lab
    const entry=Object.freeze({id,name:name.trim(),json:exportChampion(champion.network,champion.training)});this.entries.set(id,entry);return this.get(id);
  }
  importJSON(text,name='Champion importé'){const id='import-'+(this.importCounter+1);const entry=this.register(id,name,text);this.importCounter++;return entry;}
  get(id){const entry=this.entries.get(id);if(!entry)throw new RangeError('Champion non chargé');return Object.freeze({id:entry.id,name:entry.name,...importChampion(entry.json)});}
  list(){return [...this.entries.values()].map(({id,name})=>({id,name}));}
  async loadBuiltin(id,load=path=>fetch(path)){
    const info=BUILTIN_CHAMPIONS.find(c=>c.id===id);if(!info)throw new RangeError('Champion livré inconnu');
    if(this.entries.has(id))return this.get(id);
    const response=await load(info.path);if(!response.ok)throw new Error('Champion livré indisponible');const text=await response.text();
    // A concurrent click can complete after another load of the same champion.
    return this.entries.has(id)?this.get(id):this.register(id,info.name,text);
  }
}
