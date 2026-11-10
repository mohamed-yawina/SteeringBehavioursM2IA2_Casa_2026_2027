export const OUTPUT_LABELS = Object.freeze(['Braquage (− gauche / + droite)', 'Pédale (− frein / + accélérateur)']);
const signed = n => Math.max(-1, Math.min(1, n));
export function decodeOutputs(outputs) {
  if (!Array.isArray(outputs) || outputs.length !== 2 || Array.from(outputs).some(n => !Number.isFinite(n))) {
    return { steer: 0, throttle: 0, brake: 1 };
  }
  const [steer, pedal] = outputs.map(signed);
  return { steer, throttle: Math.max(0, pedal), brake: Math.max(0, -pedal) };
}
