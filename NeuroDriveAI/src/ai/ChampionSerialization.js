import {exportNetwork,importNetwork} from './NetworkSerialization.js';
export function validateTrainingMetadata(training){
 if(training===null)return null;
 if(!training||training.version!==1||!Array.isArray(training.trackIds)||!training.trackIds.length||training.trackIds.length>32||new Set(training.trackIds).size!==training.trackIds.length||training.trackIds.some(id=>typeof id!=='string'||!/^[a-z][a-z0-9-]{0,63}$/.test(id)))throw new TypeError('Invalid champion training metadata');
 if(!Number.isInteger(training.seed)||training.seed<0||training.seed>0xffffffff||!Number.isInteger(training.generation)||training.generation<1)throw new TypeError('Invalid champion provenance');
 return Object.freeze({...training,trackIds:Object.freeze([...training.trackIds])});
}
export function exportChampion(network,training=null){
 const data=JSON.parse(exportNetwork(network));if(training!==null)data.training=validateTrainingMetadata(training);return JSON.stringify(data,null,2);
}
export function importChampion(text){const network=importNetwork(text),data=JSON.parse(text);return {network,training:validateTrainingMetadata(data.training??null)};}
