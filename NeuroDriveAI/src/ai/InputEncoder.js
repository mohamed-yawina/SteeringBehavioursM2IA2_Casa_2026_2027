export const INPUT_LABELS = Object.freeze(['Distance −90°', 'Distance −60°', 'Distance −30°',
  'Distance 0°', 'Distance +30°', 'Distance +60°', 'Distance +90°', 'Vitesse']);
export const SENSOR_ANGLES = Object.freeze([-90, -60, -30, 0, 30, 60, 90].map(d => d * Math.PI / 180));
const unit = value => Math.max(0, Math.min(1, value));

export function encodeInputs(car) {
  if (!car?.active || car.crashed) return Array(8).fill(0);
  const { sensors } = car;
  if (sensors?.angles?.length !== 7 || Array.from(sensors.angles).some((a, i) => !Number.isFinite(a) || Math.abs(a - SENSOR_ANGLES[i]) > 1e-9)) {
    throw new RangeError('Neural driving requires the seven ordered default sensor angles');
  }
  const rangeOK = Number.isFinite(sensors.range) && sensors.range > 0;
  const inputs = SENSOR_ANGLES.map((_, i) => {
    const reading = sensors.readings?.[i];
    if (!rangeOK || !reading) return 0; // unknown means obstructed, not clear
    if (reading.hit === false) return 1;
    return Number.isFinite(reading.distance) ? unit(reading.distance / sensors.range) : 0;
  });
  inputs.push(Number.isFinite(car.speed) && Number.isFinite(car.maxSpeed) && car.maxSpeed > 0 ? unit(car.speed / car.maxSpeed) : 0);
  return inputs;
}
