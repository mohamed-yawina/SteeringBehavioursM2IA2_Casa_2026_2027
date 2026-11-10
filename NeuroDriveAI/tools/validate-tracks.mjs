import '../tests/support/p5.mjs';
import {writeFileSync} from 'node:fs';
import {TRACKS,createRegisteredTrack} from '../src/track/TrackRegistry.js';
import {Simulation} from '../src/simulation/Simulation.js';
import {createFeasibilityDriver} from '../src/diagnostics/FeasibilityDriver.js';

const tracks=TRACKS.map(info=>{
 const track=createRegisteredTrack(info.id),simulation=new Simulation(track),drive=createFeasibilityDriver(track);
 for(let step=0;step<120*60&&simulation.car.active&&simulation.checkpoints.laps===0;step++)simulation.step(1/120,drive(simulation.car));
 const result={id:info.id,name:info.name,geometry:track.validation,referenceDriver:{laps:simulation.checkpoints.laps,checkpoints:simulation.checkpoints.validated,elapsed:simulation.elapsed,collision:simulation.car.crashed},humanValidated:false};
 if(!result.geometry.valid||result.referenceDriver.laps!==1||result.referenceDriver.collision)throw new Error('Invalid / infeasible track: '+info.id);
 return result;
});
const report={format:'NeuroDriveAI.track-validation',version:1,dt:1/120,referenceSpeed:55,disclaimer:'Diagnostic driver only: not a neural policy or evidence of learning. Human validation pending.',tracks};
const json=JSON.stringify(report,null,2);if(process.argv[2])writeFileSync(process.argv[2],json);console.log(json);
