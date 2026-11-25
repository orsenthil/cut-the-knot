"use strict";

/*
 * Colour Cycling on the Mandelbrot Set, from Alexander Bogomolny's applet
 * MandelCycle.
 *
 * For each point c of the plane, start with z = c and repeat z -> z*z + c. If
 * |z|^2 ever exceeds 4 the point escapes, and the number of rounds it took is
 * its index into a palette of 85 colours; points that have not escaped after
 * 85 rounds are taken to be in the set and are left uncoloured. Nothing in
 * the picture changes afterwards. "Colour cycling" turns the palette round by
 * one place at a time, so every pixel takes the colour of its neighbour in the
 * palette: the bands seem to flow in or out.
 *
 * The picture shows -2.2 <= Re c <= 0.8 and -1.4 <= Im c <= 1.4. The lower
 * half is the mirror of the upper half, as in the applet, which computes only
 * one half.
 */
const MandelCycleCore = (() => {
  const SIZE = 256;
  const MAX_ITER = 85;
  const ESCAPE = 4.0;
  const VIEW = { x: -2.2, y: -1.4, width: 3.0, height: 2.8 };

  /** Rounds before |z|^2 > 4, or MAX_ITER if it never does. z starts at c. */
  function iterate(cx, cy) {
    let x = cx, y = cy;
    for (let i = 0; i < MAX_ITER; i++) {
      const xx = x * x, yy = y * y;
      if (xx + yy > ESCAPE) return i;
      const nx = xx - yy + cx;
      y = 2 * x * y + cy;
      x = nx;
    }
    return MAX_ITER;
  }

  /**
   * The applet's buildpalette: for i = 0..len-1 the colour is
   * to*i/len + from*(len-i)/len, each part cut to a whole number as in Java.
   */
  function blend(palette, to, from, len, offset) {
    for (let i = 0; i < len; i++) {
      palette[offset + i] = [0, 1, 2].map((k) => Math.trunc((to[k] * i) / len) + Math.trunc((from[k] * (len - i)) / len));
    }
  }

  /** The 85 colours [r, g, b]: red to blue, blue to green, green to black. */
  function palette() {
    const p = new Array(MAX_ITER);
    blend(p, [0, 0, 255], [255, 0, 0], 10, 0);
    blend(p, [0, 255, 0], [0, 0, 255], 30, 10);
    blend(p, [0, 0, 0], [0, 255, 0], 45, 40);
    return p;
  }

  /**
   * One tick of cycling. out (the applet's default): each colour moves to the
   * place before it and the first becomes the last. in: the other way round.
   */
  function rotate(p, direction) {
    const n = p.length;
    if (direction === "in") return [p[n - 1]].concat(p.slice(0, n - 1));
    return p.slice(1).concat([p[0]]);
  }

  /**
   * The iteration counts of a size by size picture, row by row from the top.
   * Rows are computed for the upper half and mirrored, as in the applet.
   */
  function image(size = SIZE) {
    const out = new Uint8Array(size * size);
    const dx = VIEW.width / size, dy = VIEW.height / size;
    let cy = VIEW.y;
    for (let row = 0; row <= size / 2; row++) {
      let cx = VIEW.x;
      for (let col = 0; col < size; col++) {
        const n = iterate(cx, cy);
        out[row * size + col] = n;
        out[(size - row - 1) * size + col] = n;
        cx += dx;
      }
      cy += dy;
    }
    return out;
  }

  /** Pixels [r, g, b, a] for an image and a palette; points in the set get `inside`. */
  function paint(counts, pal, inside = [0, 0, 0]) {
    const px = new Uint8ClampedArray(counts.length * 4);
    for (let i = 0; i < counts.length; i++) {
      const c = counts[i] < MAX_ITER ? pal[counts[i]] : inside;
      px[4 * i] = c[0]; px[4 * i + 1] = c[1]; px[4 * i + 2] = c[2]; px[4 * i + 3] = 255;
    }
    return px;
  }

  /** The Delay of the applet: 0 for "Fast", 250 ms for "Slow". */
  const delayFor = (fast) => (fast ? 0 : 250);

  return { SIZE, MAX_ITER, VIEW, iterate, palette, rotate, image, paint, delayFor };
})();
