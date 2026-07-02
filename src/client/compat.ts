/**
 * src/client/compat.ts
 * --------------------
 * Tiny runtime polyfills for the older browsers the build target (es2020)
 * doesn't cover on the API side. Imported FIRST from main.ts so everything
 * downstream can use these calls unguarded.
 *
 * Only what the game actually uses:
 *   - CanvasRenderingContext2D.roundRect — Safari < 16, Firefox < 112. Used by
 *     the chat-bubble backing; without this the whole render frame throws.
 */

if (typeof CanvasRenderingContext2D !== "undefined" &&
    !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (
    x: number, y: number, w: number, h: number,
    radii?: number | DOMPointInit | (number | DOMPointInit)[],
  ): void {
    const r = Math.max(0, Math.min(
      typeof radii === "number" ? radii : Array.isArray(radii) ? Number(radii[0] ?? 0) : 0,
      w / 2, h / 2,
    ));
    this.moveTo(x + r, y);
    this.arcTo(x + w, y, x + w, y + h, r);
    this.arcTo(x + w, y + h, x, y + h, r);
    this.arcTo(x, y + h, x, y, r);
    this.arcTo(x, y, x + w, y, r);
    this.closePath();
  };
}

export {};
