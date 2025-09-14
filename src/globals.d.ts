// src/globals.d.ts
interface AccelerometerData {
  x: number | null;
  y: number | null;
  z: number | null;
}

interface Accelerometer extends Sensor {
  readonly x: number | null;
  readonly y: number | null;
  readonly z: number | null;
  onreading: ((this: Accelerometer, ev: Event) => any) | null;
  onactivate: ((this: Accelerometer, ev: Event) => any) | null;
  onerror: ((this: Accelerometer, ev: Event) => any) | null;
}

declare var Accelerometer: {
  prototype: Accelerometer;
  new(options?: SensorOptions): Accelerometer;
};