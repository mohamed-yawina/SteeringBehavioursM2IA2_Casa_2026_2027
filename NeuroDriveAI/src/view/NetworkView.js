// Diagnostic Canvas renderer; network geometry is data, not a physical entity.
export class NetworkView {
  constructor(canvas) { this.canvas = canvas; this.context = canvas.getContext('2d'); this.renderCount=0;this.layoutBuilds=0;this.lastDraw=-Infinity;this.maxFps=15;this.effectsEnabled=true; }
  draw(network, diagnostics, {now=performance.now(),force=false}={}) {
    const ctx = this.context, canvas = this.canvas;
    const width = Math.max(300, canvas.clientWidth||300), height = Math.max(340,canvas.clientHeight||340);
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const changed=this.network!==network||this.width!==width||this.height!==height||this.ratio!==ratio;
    const styleChanged=this.lastEffects!==this.effectsEnabled;
    if(!changed&&!styleChanged&&!force&&(diagnostics===this.lastDiagnostics||now-this.lastDraw<1000/this.maxFps))return false;
    if (canvas.width !== Math.round(width * ratio) || canvas.height !== height * ratio) {
      canvas.width = Math.round(width * ratio); canvas.height = height * ratio;
    }
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = '#0b1423'; ctx.fillRect(0, 0, width, height);
    if(changed){this.nodes=network.sizes.map((size,layer)=>Array.from({length:size},(_,i)=>({x:64+layer*(width-128)/(network.sizes.length-1),y:38+(i+.5)*(height-62)/size})));this.network=network;this.width=width;this.height=height;this.ratio=ratio;this.layoutBuilds++;}
    const nodes=this.nodes;
    for (let layer = 0; layer < network.parameters.length; layer++) {
      network.parameters[layer].weights.forEach((row, target) => row.forEach((weight, source) => {
        const a = nodes[layer][source], b = nodes[layer + 1][target];
        ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y);
        ctx.strokeStyle = weight >= 0 ? '#67e8f94d' : '#c4b5fd4d';
        ctx.lineWidth = .3 + Math.min(Math.abs(weight), 2) * .7; ctx.stroke();
      }));
    }
    nodes.forEach((layer, index) => layer.forEach((p, i) => {
      const raw=diagnostics?.activations?.[index]?.[i],value=Number.isFinite(raw)?Math.max(-1,Math.min(1,raw)):0;
      ctx.shadowBlur=this.effectsEnabled&&Math.abs(value)>.5?10:0;ctx.shadowColor=value>=0?'#67e8f9':'#c4b5fd';
      ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI * 2);
      ctx.fillStyle = raw===undefined?'#50617a':value >= 0 ? `rgba(103,232,249,${.25 + Math.abs(value) * .75})`
        : `rgba(196,181,253,${.25 + Math.abs(value) * .75})`; ctx.fill();ctx.shadowBlur=0;
      if(index===0||index===nodes.length-1){ctx.fillStyle='#dce9fa';ctx.font='11px ui-monospace, monospace';ctx.textAlign=index===0?'right':'left';ctx.fillText(Number.isFinite(raw)?value.toFixed(2):'—',p.x+(index===0?-13:13),p.y+4);}
    }));
    ctx.fillStyle = '#c0d1dd'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
    nodes.forEach((layer, i) => ctx.fillText(`${i === 0 ? 'Entrées' : i === nodes.length - 1 ? 'Sorties' : 'Cachée'} (${layer.length})`, layer[0].x, 16));
    this.lastDraw=now;this.lastDiagnostics=diagnostics;this.lastEffects=this.effectsEnabled;this.renderCount++;return true;
  }
}
