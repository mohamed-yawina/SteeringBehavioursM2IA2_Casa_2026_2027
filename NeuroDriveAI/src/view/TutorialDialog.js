export class TutorialDialog{
  constructor(dialog,{root=document,onOpen=()=>{}}={}){
    this.dialog=dialog;this.root=root;this.onOpen=onOpen;this.opened=false;this.opener=null;this.inertBefore=[];
    if(!dialog)return;
    dialog.querySelector('[data-close-tutorial]')?.addEventListener('click',()=>this.close());
    dialog.addEventListener('cancel',event=>{event.preventDefault();this.close();});
    dialog.addEventListener('keydown',event=>{
      if(event.key==='Escape'){event.preventDefault();this.close();return;}
      if(event.key!=='Tab')return;
      const controls=[...dialog.querySelectorAll('button,a[href],input,select,textarea,[tabindex]')].filter(e=>!e.disabled&&!e.hidden&&e.tabIndex!==-1);
      if(!controls.length){event.preventDefault();dialog.focus();return;}
      const first=controls[0],last=controls.at(-1),active=root.activeElement;
      if(event.shiftKey&&(active===first||!dialog.contains(active))){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&(active===last||!dialog.contains(active))){event.preventDefault();first.focus();}
    });
  }
  open(opener=this.root.activeElement){
    if(!this.dialog||this.opened)return;this.opener=opener;this.onOpen();this.opened=true;
    if(this.dialog.showModal)this.dialog.showModal();else{
      this.dialog.setAttribute('open','');this.inertBefore=[...this.root.querySelectorAll('header,main,#app-navigation,#scientific-notice')].map(e=>[e,e.inert]);this.inertBefore.forEach(([e])=>{e.inert=true;});
    }
    this.dialog.querySelector('[data-close-tutorial]')?.focus();
  }
  close(){if(!this.opened)return;this.opened=false;if(this.dialog.close)this.dialog.close();else this.dialog.removeAttribute('open');this.inertBefore.forEach(([e,value])=>{e.inert=value;});this.inertBefore=[];this.opener?.focus();}
}
