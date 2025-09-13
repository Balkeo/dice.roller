// src/physics.ts
export const randomRange = (min: number, max: number) =>
  Math.random() * (max - min) + min;
export const randomSign = () => (Math.random() < 0.5 ? -1 : 1);

export function randomThrowVelocity(): [number, number, number] {
  return [
    randomRange(2.5, 4.5) * randomSign(),
    randomRange(6.5, 8.5),
    randomRange(2.5, 4.5) * randomSign(),
  ];
}
export function randomThrowAngular(): [number, number, number] {
  return [
    randomRange(6, 10) * randomSign(),
    randomRange(6, 10) * randomSign(),
    randomRange(6, 10) * randomSign(),
  ];
}
