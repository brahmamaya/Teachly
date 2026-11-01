// Small fill-ins so Teachly also runs on older Android boards (older
// WebView / Chrome) without errors.

const proto = (globalThis as unknown as { CanvasRenderingContext2D?: { prototype: CanvasRenderingContext2D } }).CanvasRenderingContext2D?.prototype;
if (proto && !proto.roundRect) {
  proto.roundRect = function (this: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radii?: number | DOMPointInit | (number | DOMPointInit)[]) {
    const r0 = Array.isArray(radii) ? radii[0] : radii;
    const r = Math.max(0, Math.min(typeof r0 === 'number' ? r0 : 0, Math.abs(w) / 2, Math.abs(h) / 2));
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

if (typeof globalThis.structuredClone !== 'function') {
  (globalThis as unknown as { structuredClone: <T>(v: T) => T }).structuredClone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;
}
