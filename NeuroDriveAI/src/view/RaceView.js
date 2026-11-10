import {Renderer} from './Renderer.js';
export class RaceView{
  constructor(canvas){this.renderer=new Renderer(canvas);this.selectedIndex=0;}
  draw(race,showSensors=true){
    const selected=race.entrants[this.selectedIndex]??race.entrants[0];
    this.renderer.selectedColor=this.selectedIndex===1?'#c4b5fd':'#67e8f9';
    this.renderer.draw(selected.simulation,showSensors,race.entrants.map(e=>e.simulation.car));
    const ctx=this.renderer.context;
    race.entrants.forEach((entrant,index)=>{
      const car=entrant.simulation.car,color=index===0?'#67e8f9':'#c4b5fd';
      ctx.save();ctx.translate(car.position.x,car.position.y);ctx.rotate(car.orientation);
      // Offset outlines are display-only: both cars retain the exact same spawn.
      ctx.strokeStyle=car.crashed?'#ef7d77':color;ctx.lineWidth=2;
      ctx.beginPath();ctx.moveTo(-car.length/2,-car.width/2);ctx.lineTo(car.length/2,-car.width/2);ctx.lineTo(car.length/2,car.width/2);ctx.lineTo(-car.length/2,car.width/2);ctx.closePath();ctx.stroke();ctx.restore();
      ctx.fillStyle=color;ctx.font='12px system-ui';ctx.textAlign='center';ctx.fillText(`${index+1} · ${entrant.name}`,car.position.x,car.position.y-22-index*15);
    });
  }
}
