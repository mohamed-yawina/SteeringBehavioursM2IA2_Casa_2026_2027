import { Track,createOvalTrack } from './Track.js';
import { vec } from '../math/vector.js';
export function createValidationTrack() {
  const source=createOvalTrack(),sx=.92,sy=1.08;
  const transform=p=>vec(500+(p.x-500)*sx,350+(p.y-350)*sy);
  return new Track({id:'oval-affine-v1',inner:source.inner.map(transform),outer:source.outer.map(transform),
    checkpoints:source.checkpoints.map(cp=>{const a=transform(cp.a),b=transform(cp.b);return {a,b,normal:vec(-(b.y-a.y),b.x-a.x).normalize()};}),
    start:{position:transform(source.start.position),orientation:Math.atan2(sy*Math.sin(source.start.orientation),sx*Math.cos(source.start.orientation))}});
}
