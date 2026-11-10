import {createOvalTrack} from './Track.js';import {createTrackFromControls} from './TrackFactory.js';import {validateTrack} from './TrackValidator.js';
export const TRACKS=Object.freeze([
 {id:'oval',name:'Training Oval',description:'Circuit de référence inchangé.',difficulty:'Facile'},
 {id:'desert',name:'Desert Circuit',description:'Boucle asymétrique, courbes ouvertes et deux rentrants.',difficulty:'Modérée'},
 {id:'mountain',name:'Mountain Pass',description:'Épingles et alternance de changements de direction.',difficulty:'Difficile'},
 {id:'neon',name:'Neon City',description:'Boucle urbaine à angles arrondis et chicane intérieure.',difficulty:'Technique'},
 {id:'championship',name:'Evolution Championship',description:'Boucle longue, virages mixtes et enchaînements resserrés.',difficulty:'Exigeante'}
].map(t=>Object.freeze({...t,dimensions:Object.freeze({width:1000,height:700})})));
const definitions={
 desert:{width:88,gateCount:14,controls:[[830,310],[830,510],[680,580],[500,500],[300,570],[160,420],[190,190],[380,120],[560,210],[760,120]]},
 mountain:{width:64,gateCount:18,controls:[[850,170],[850,530],[690,560],[650,390],[550,350],[500,560],[330,560],[300,330],[170,300],[170,150],[360,140],[440,240],[600,160]]},
 neon:{width:76,gateCount:16,controls:[[850,150],[850,540],[600,540],[600,360],[400,360],[400,540],[150,540],[150,140],[420,140],[580,230],[700,140]]},
 championship:{width:66,gateCount:20,controls:[[870,180],[850,510],[700,570],[620,450],[500,570],[350,570],[330,390],[160,420],[150,180],[300,130],[420,260],[520,140],[700,130]]}
};
export function createRegisteredTrack(id='oval'){
 const metadata=TRACKS.find(t=>t.id===id);if(!metadata)throw new RangeError(`Unknown track: ${id}`);
 const track=id==='oval'?createOvalTrack():createTrackFromControls({id,...definitions[id]});
 if(!track.centerline)track.centerline=track.inner.map((p,i)=>({x:(p.x+track.outer[i].x)/2,y:(p.y+track.outer[i].y)/2}));
 track.metadata=metadata;
 const validation=validateTrack(track);if(!validation.valid)throw new Error(`${id}: ${validation.errors.join('; ')}`);
 track.validation=Object.freeze(validation);return track;
}
