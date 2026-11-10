import {readFileSync} from 'node:fs';
export class Element{
  constructor(value='',tagName='DIV'){this.value=value;this.tagName=tagName;this.handlers=new Map();this.checked=false;this.hidden=false;this.children=[];this.textContent='';}
  addEventListener(type,fn){if(!this.handlers.has(type))this.handlers.set(type,[]);this.handlers.get(type).push(fn);}
  removeEventListener(type,fn){this.handlers.set(type,(this.handlers.get(type)??[]).filter(f=>f!==fn));}
  emit(type,extra={}){return Promise.all((this.handlers.get(type)??[]).map(fn=>fn({currentTarget:this,target:this,...extra})));}
  replaceChildren(){this.children=[];}append(child){this.children.push(child);}setAttribute(name,value){this[name]=value;}focus(){}blur(){}select(){}
}
export function gameDOM(){
  const html=readFileSync(new URL('../../index.html',import.meta.url),'utf8'),nodes=new Map(),draws=new Map();
  const context=id=>{const ctx={};for(const name of ['setTransform','fillRect','translate','scale','moveTo','lineTo','closePath','beginPath','fill','arc','save','rotate','restore','fillText','stroke'])ctx[name]=()=>{draws.set('#'+id,(draws.get('#'+id)??0)+1);};return ctx;};
  for(const match of html.matchAll(/<([a-z]+)\b([^>]*\bid="([^"]+)"[^>]*)>/g)){
    const [,tag,attrs,id]=match,node=new Element(attrs.match(/\bvalue="([^"]*)"/)?.[1]??'',tag.toUpperCase());node.checked=/\bchecked\b/.test(attrs);node.hidden=/\bhidden\b/.test(attrs);
    if(tag==='canvas'){const ctx=context(id);Object.assign(node,{width:0,height:0,clientWidth:1000,clientHeight:700,getContext:()=>ctx});}
    nodes.set('#'+id,node);
  }
  for(const match of html.matchAll(/<select\b[^>]*\bid="([^"]+)"[^>]*>([\s\S]*?)<\/select>/g)){const option=match[2].match(/<option\b[^>]*value="([^"]*)"/);if(option)nodes.get('#'+match[1]).value=option[1];}
  nodes.set('canvas',nodes.get('#simulation-canvas'));
  const root=new Element();root.querySelector=id=>nodes.get(id);root.createElement=tag=>new Element('',tag.toUpperCase());root.hidden=false;
  const win=new Element();win.devicePixelRatio=1;const memory={value:null,getItem(){return this.value;},setItem(key,text){this.value=text;}};win.localStorage=memory;
  const load=async path=>({ok:true,text:async()=>readFileSync(new URL('../../'+path,import.meta.url),'utf8')});
  return {root,win,memory,nodes,draws,load};
}
