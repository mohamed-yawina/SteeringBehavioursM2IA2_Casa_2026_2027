const bounded = (x, max = 1e6) => Number.isFinite(x) ? Math.max(0, Math.min(max, x)) : 0;
export function referenceFitness(record) {
  // Original TP9: pow(2, checkpoints), NOT checkpoints squared.
  return 2 ** Math.min(1023, Math.floor(bounded(record.checkpoints)));
}
export function improvedFitness(record, maxDuration) {
  if (!Number.isFinite(maxDuration) || maxDuration <= 0) throw new RangeError('Invalid episode duration');
  const checkpoints = Math.floor(bounded(record.checkpoints)), laps = Math.floor(bounded(record.laps));
  const fraction = bounded(record.fraction, .999);
  const base = 100 * checkpoints + 50 * fraction + 500 * laps;
  const time = 1 / (1 + bounded(record.elapsed) / maxDuration);
  return base * time * (record.crashed ? .75 : 1) * (record.reason === 'stagnation' ? .5 : 1);
}
export function evaluateFitness(record, mode, maxDuration) {
  if (mode === 'reference') return referenceFitness(record);
  if (mode === 'improved') return improvedFitness(record, maxDuration);
  if (mode === 'optimized') return optimizedFitness(record, maxDuration);
  throw new RangeError('Unknown fitness mode');
}

// Version 5: incomplete progress gets no benefit from dying early.
export function optimizedFitness(record, maxDuration) {
  if (!Number.isFinite(maxDuration) || maxDuration<=0) throw new RangeError('Invalid episode duration');
  const C=Math.floor(bounded(record.checkpoints)),L=Math.floor(bounded(record.laps));
  const base=100*C+25*bounded(record.fraction,.999)+4000*L;
  const firstLap=Number.isFinite(record.firstLapTime) && record.firstLapTime>=0 ? bounded(record.firstLapTime)
    : Number.isFinite(record.elapsed) && record.elapsed>=0 ? bounded(record.elapsed) : maxDuration;
  const speedBonus=L>0?200*Math.max(0,Math.min(1,1-firstLap/maxDuration)):0;
  const quality=record.crashed ? .4 : record.reason==='stagnation' ? .6 : 1;
  return (base+speedBonus)*quality;
}

// Projection only within the CURRENT ordered sector. It cannot award gates.
export function sectorFraction(simulation) {
  const { track, car, checkpoints } = simulation;
  const middle = cp => ({ x: (cp.a.x + cp.b.x) / 2, y: (cp.a.y + cp.b.y) / 2 });
  const from = checkpoints.validated === 0 ? track.start.position : middle(track.checkpoints[(checkpoints.nextIndex - 1 + track.checkpoints.length) % track.checkpoints.length]);
  const to = middle(track.checkpoints[checkpoints.nextIndex]);
  const dx = to.x - from.x, dy = to.y - from.y, lengthSq = dx * dx + dy * dy;
  if (lengthSq < 1e-12) return 0;
  return bounded(((car.position.x - from.x) * dx + (car.position.y - from.y) * dy) / lengthSq, .999);
}
