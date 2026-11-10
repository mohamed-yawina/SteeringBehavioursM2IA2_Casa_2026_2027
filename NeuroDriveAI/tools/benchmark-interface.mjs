import '../tests/support/p5.mjs';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {Simulation} from '../src/simulation/Simulation.js';
import {importChampion} from '../src/ai/ChampionSerialization.js';
import {exportNetwork} from '../src/ai/NetworkSerialization.js';
import {Renderer} from '../src/view/Renderer.js';
import {NetworkView} from '../src/view/NetworkView.js';

// Synthetic Canvas records JS drawing calls. This is NOT a browser FPS test.
let operations=0;
const ctx={};for(const name of ['setTransform','fillRect','beginPath','moveTo','lineTo','fill','save','restore','translate','rotate','scale','closePath','stroke','arc','fillText'])ctx[name]=()=>operations++;
const canvas=()=>({clientWidth:640,clientHeight:380,width:0,height:0,getContext:()=>ctx});
globalThis.window={devicePixelRatio:1};
const json=readFileSync(new URL('../docs/experiments/etape-5/comparaison/champions/C-2028.json',import.meta.url),'utf8');
const visible=new Simulation(),reference=new Simulation();for(const sim of [visible,reference]){sim.setNetwork(importChampion(json).network);sim.setMode('autonomous');}
const before=exportNetwork(visible.neuralController.network),renderer=new Renderer(canvas()),network=new NetworkView(canvas());renderer.trailsEnabled=true;
const started=performance.now();
for(let frame=0;frame<600;frame++){
 for(let step=0;step<2;step++){visible.step(1/120);reference.step(1/120);}
 renderer.draw(visible,true);network.draw(visible.neuralController.network,visible.neuralController.diagnostics,{now:frame*1000/60});
}
const elapsedMs=performance.now()-started;
const state=sim=>JSON.stringify({position:sim.car.position,velocity:sim.car.velocity,orientation:sim.car.orientation,distance:sim.car.distanceTravelled,checkpoints:sim.checkpoints.validated,laps:sim.checkpoints.laps});
const report={format:'NeuroDriveAI.interface-benchmark',version:1,node:process.version,frames:600,physicsStepsPerSimulation:1200,simulatedSeconds:visible.elapsed,
 networkDraws:network.renderCount,layoutBuilds:network.layoutBuilds,tracePoints:renderer.trails.get(visible.car).points.length,syntheticCanvasOperations:operations,elapsedMs,
 trajectoryUnchanged:state(visible)===state(reference),weightsUnchanged:before===exportNetwork(visible.neuralController.network),activeAtEnd:visible.car.active,
 limitation:'Synthetic Canvas and Node JS only: no browser layout, rasterization, GPU timing or real FPS measured.'};
if(!report.trajectoryUnchanged||!report.weightsUnchanged||report.networkDraws>151||report.layoutBuilds!==1||report.tracePoints>180||!report.activeAtEnd)throw new Error('UI performance invariant failed');
if(process.argv[2]){const output=resolve(process.argv[2]);if(existsSync(output))throw new Error('Choose a new benchmark output file');mkdirSync(dirname(output),{recursive:true});writeFileSync(output,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));
