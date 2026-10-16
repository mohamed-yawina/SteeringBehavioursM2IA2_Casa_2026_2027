// Closed paths, including the two-point "line" traversed in both directions.
const LabScenarios = {
  line: [[100,300],[1000,300]],
  turn: [[150,200],[850,200],[850,230],[250,600]],
  crossing: [[200,150],[950,650],[200,650],[950,150]],
  degenerate: [[200,200],[200,200],[900,200],[900,600],[200,600]]
};
function scenarioPoints(name) {
  if (LabScenarios[name]) return LabScenarios[name].map(p=>p.slice());
  return Array.from({length:30},(_,i)=>{
    const a=i*Math.PI*2/30, radius=280+25*Math.sin(i*2.7);
    return [600+Math.cos(a)*radius,400+Math.sin(a)*radius];
  });
}
