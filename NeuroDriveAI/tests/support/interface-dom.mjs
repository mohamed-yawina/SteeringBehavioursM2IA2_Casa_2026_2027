import {gameDOM,Element} from './game-dom.mjs';
import {readFileSync} from 'node:fs';
export function interfaceDOM(){
  const d=gameDOM(),{root,nodes}=d;
  const equip=node=>{
    node.append=(...children)=>node.children.push(...children);node.removeAttribute=name=>{delete node[name];};node.getAttribute=name=>node[name]??null;
    node.focus=()=>{root.activeElement=node;};node.tabIndex=0;
    const values=new Set();node.classList={toggle(name,force){const enabled=force??!values.has(name);if(enabled)values.add(name);else values.delete(name);return enabled;},contains:name=>values.has(name)};
    return node;
  };
  for(const node of nodes.values())equip(node);
  const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  for(const match of html.matchAll(/<(h[1-6])\b[^>]*id="([^"]+)"[^>]*>/g))if(!nodes.has('#'+match[2]))nodes.set('#'+match[2],equip(new Element('',match[1].toUpperCase())));
  root.body=equip(new Element());root.createElement=tag=>equip(new Element('',tag.toUpperCase()));
  for(const [id,node]of nodes)if(id.startsWith('#metric-')){const card=equip(new Element());node.closest=()=>card;}
  const close=equip(new Element()),dialog=nodes.get('#tutorial-dialog');close.textContent='Fermer';
  dialog.querySelector=selector=>selector==='[data-close-tutorial]'?close:null;dialog.querySelectorAll=()=>[close];dialog.contains=node=>node===close;
  dialog.showModal=()=>{dialog.open=true;};dialog.close=()=>{dialog.open=false;};
  root.querySelectorAll=selector=>selector==='header,main,#app-navigation,#scientific-notice'?[nodes.get('#main-content'),nodes.get('#app-navigation'),nodes.get('#scientific-notice')]:[];
  return {...d,close,equip};
}
