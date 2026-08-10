/* Procedurally-drawn pixel-art cat, rendered on a low-res grid and scaled up
 * with crisp (non-smoothed) pixels so it reads as cute pixel art without
 * needing a hand-authored sprite sheet. */
(function () {
  const COLS = 32;
  const ROWS = 32;

  const COLOR = {
    ink: "#3a2e2e",
    fur: "#f6b26b",
    furDark: "#e0924a",
    white: "#fff8ef",
    pink: "#ffb6c9",
    pinkDark: "#f492ab",
    eye: "#2c2320",
    hilite: "#ffffff",
  };

  function inEllipse(x, y, cx, cy, rx, ry) {
    const dx = (x - cx) / rx;
    const dy = (y - cy) / ry;
    return dx * dx + dy * dy <= 1;
  }

  function inTriangle(px, py, ax, ay, bx, by, cx, cy) {
    const d1 = sign(px, py, ax, ay, bx, by);
    const d2 = sign(px, py, bx, by, cx, cy);
    const d3 = sign(px, py, cx, cy, ax, ay);
    const hasNeg = d1 < 0 || d2 < 0 || d3 < 0;
    const hasPos = d1 > 0 || d2 > 0 || d3 > 0;
    return !(hasNeg && hasPos);
  }

  function sign(px, py, ax, ay, bx, by) {
    return (px - bx) * (ay - by) - (ax - bx) * (py - by);
  }

  function buildGrid(t, opts) {
    opts = opts || {};
    const blink = !!opts.blink;
    const earTwitch = opts.earTwitch || 0; // -1..1, shifts right ear apex
    const tailPhase = opts.tailPhase || 0; // radians
    const bob = opts.bob || 0; // vertical offset applied at raster time
    const fur = (opts.palette && opts.palette.fur) || COLOR.fur;
    const furDark = (opts.palette && opts.palette.furDark) || COLOR.furDark;

    const grid = new Array(ROWS);
    for (let y = 0; y < ROWS; y++) grid[y] = new Array(COLS).fill(null);

    const set = (x, y, color) => {
      if (color == null) return;
      x = Math.round(x);
      y = Math.round(y);
      if (x >= 0 && x < COLS && y >= 0 && y < ROWS) grid[y][x] = color;
    };

    const fillEllipse = (cx, cy, rx, ry, color) => {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          if (inEllipse(x + 0.5, y + 0.5, cx, cy, rx, ry)) set(x, y, color);
        }
      }
    };

    const fillTriangle = (ax, ay, bx, by, cx, cy, color) => {
      const minX = Math.floor(Math.min(ax, bx, cx));
      const maxX = Math.ceil(Math.max(ax, bx, cx));
      const minY = Math.floor(Math.min(ay, by, cy));
      const maxY = Math.ceil(Math.max(ay, by, cy));
      for (let y = minY; y <= maxY; y++) {
        for (let x = minX; x <= maxX; x++) {
          if (inTriangle(x + 0.5, y + 0.5, ax, ay, bx, by, cx, cy)) set(x, y, color);
        }
      }
    };

    // ---- Tail (drawn first, sits behind body) ----
    const tailWag = Math.sin(tailPhase) * 2.2;
    for (let i = 0; i <= 24; i++) {
      const tt = i / 24;
      const px = 25 + tailWag * tt + Math.sin(tt * Math.PI * 0.9) * 3.5;
      const py = 27 - tt * 15;
      const r = 2.1 - tt * 1.1;
      fillEllipse(px, py, r, r, fur);
    }

    // ---- Ears ----
    fillTriangle(6, 12, 10, 3, 14, 12, fur);
    fillTriangle(18, 12, 22 + earTwitch, 3, 26, 12, fur);

    // ---- Head ----
    fillEllipse(16, 15, 9, 8, fur);

    // inner ears (after head so they win)
    fillTriangle(8.4, 10.6, 10, 5.4, 11.8, 10.6, COLOR.pink);
    fillTriangle(20.2 + earTwitch * 0.6, 10.6, 22 + earTwitch, 5.4, 23.8 + earTwitch * 0.6, 10.6, COLOR.pink);

    // muzzle / lower face patch
    fillEllipse(16, 19.2, 5.6, 4, COLOR.white);

    // cheeks blush
    fillEllipse(9.3, 18, 1.5, 1.1, COLOR.pink);
    fillEllipse(22.7, 18, 1.5, 1.1, COLOR.pink);

    // eyes
    if (blink) {
      for (let x = -1; x <= 1; x++) {
        set(12 + x, 16, COLOR.eye);
        set(20 + x, 16, COLOR.eye);
      }
    } else {
      fillEllipse(12, 16, 1.3, 1.6, COLOR.eye);
      fillEllipse(20, 16, 1.3, 1.6, COLOR.eye);
      set(11.5, 15.1, COLOR.hilite);
      set(19.5, 15.1, COLOR.hilite);
    }

    // nose + tiny mouth
    fillTriangle(15.2, 18.6, 16.8, 18.6, 16, 19.6, COLOR.pinkDark);
    set(14.5, 20.2, COLOR.ink);
    set(17.5, 20.2, COLOR.ink);

    // whisker dots
    set(6.5, 17, furDark);
    set(6.5, 18.6, furDark);
    set(25.5, 17, furDark);
    set(25.5, 18.6, furDark);

    // ---- Body ----
    fillEllipse(16, 26.2, 9.6, 5.6, fur);
    fillEllipse(16, 27.6, 6.2, 3.8, COLOR.white);

    return grid;
  }

  function rasterize(ctx, grid) {
    // outline pass: any empty cell adjacent to a filled cell becomes ink
    const outline = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        if (grid[y][x]) continue;
        const neighbors = [
          [x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) continue;
          if (grid[ny][nx]) {
            outline.push([x, y]);
            break;
          }
        }
      }
    }

    ctx.clearRect(0, 0, COLS, ROWS);
    ctx.fillStyle = COLOR.ink;
    for (const [x, y] of outline) ctx.fillRect(x, y, 1, 1);

    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const c = grid[y][x];
        if (!c) continue;
        ctx.fillStyle = c;
        ctx.fillRect(x, y, 1, 1);
      }
    }
  }

  class PixelCat {
    constructor(canvas) {
      this.canvas = canvas;
      canvas.width = COLS;
      canvas.height = ROWS;
      this.ctx = canvas.getContext("2d");
      this.ctx.imageSmoothingEnabled = false;

      this.startTime = performance.now();
      this.blinking = false;
      this.palette = null;
      this._scheduleBlink();
      this._raf = requestAnimationFrame(this._tick.bind(this));

      canvas.addEventListener("click", () => this.pulse());
      this._clickPulse = 0;
    }

    setPalette(palette) {
      this.palette = palette || null;
    }

    _scheduleBlink() {
      const delay = 2200 + Math.random() * 3200;
      this._blinkTimer = setTimeout(() => {
        this.blinking = true;
        setTimeout(() => {
          this.blinking = false;
          this._scheduleBlink();
        }, 140);
      }, delay);
    }

    pulse() {
      this._clickPulse = 1;
    }

    _tick(now) {
      const t = (now - this.startTime) / 1000;
      const bob = Math.sin(t * 1.6) * 0.4;
      const earTwitch = Math.sin(t * 0.7) > 0.85 ? Math.sin(t * 12) * 0.8 : 0;
      const tailPhase = t * 1.3 + (this._clickPulse ? Math.sin(t * 20) * 2 : 0);

      const grid = buildGrid(t, { blink: this.blinking, earTwitch, tailPhase, bob, palette: this.palette });
      this.ctx.save();
      this.ctx.translate(0, bob);
      rasterize(this.ctx, grid);
      this.ctx.restore();

      if (this._clickPulse > 0) this._clickPulse = Math.max(0, this._clickPulse - 0.05);

      this._raf = requestAnimationFrame(this._tick.bind(this));
    }

    destroy() {
      cancelAnimationFrame(this._raf);
      clearTimeout(this._blinkTimer);
    }
  }

  PixelCat.PALETTES = {
    orange: { fur: "#f6b26b", furDark: "#e0924a" },
    gray: { fur: "#b9bec6", furDark: "#9aa1ab" },
    black: { fur: "#54545c", furDark: "#3c3c44" },
  };

  window.PixelCat = PixelCat;
})();
