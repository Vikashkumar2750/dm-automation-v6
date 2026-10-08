export type Point = { x: number; y: number };
export function zoomAt(pan: Point, current: number, next: number, anchor: Point) {
  const zoom = Math.min(1.5, Math.max(0.4, next));
  return { zoom, pan: { x: anchor.x - (anchor.x - pan.x) * zoom / current, y: anchor.y - (anchor.y - pan.y) * zoom / current } };
}
export function wheelPixels(delta: number, mode: number, pageHeight: number) {
  return delta * (mode === 1 ? 16 : mode === 2 ? pageHeight : 1);
}